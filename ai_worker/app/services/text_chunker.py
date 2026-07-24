"""Text chunking service — splits extracted text into overlapping chunks.

Uses tiktoken (OpenAI's tokeniser) to count tokens accurately so that
chunk sizes stay within the configured token budget, ensuring reliable
embedding generation via the OpenAI API.

Strategy:
  - Primary split by paragraph (double newline).
  - Secondary split by sentence (simple regex).
  - Each chunk is capped at *max_tokens*.
  - Consecutive chunks overlap by *overlap_tokens* tokens.
"""

import logging
import re
from typing import Iterator

import tiktoken

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

# Tokenizer model — matches text-embedding-3-small (cl100k_base).
TOKENIZER_MODEL = "cl100k_base"

# Maximum tokens per chunk.  Kept well under the 8191 limit of
# text-embedding-3-small to leave room for formatting overhead.
DEFAULT_MAX_TOKENS = 800

# Number of overlapping tokens between consecutive chunks.
DEFAULT_OVERLAP_TOKENS = 150

# Regex for splitting on sentence boundaries.
# Matches ". " / "! " / "? " followed by a capital letter or end-of-string.
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")

_LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tokenisation helpers
# ---------------------------------------------------------------------------

def _get_encoder() -> tiktoken.Encoding:
    """Return the tiktoken encoder for the configured model."""
    return tiktoken.get_encoding(TOKENIZER_MODEL)


def count_tokens(text: str) -> int:
    """Return the exact token count for *text* using tiktoken."""
    encoder = _get_encoder()
    return len(encoder.encode(text, disallowed_special=()))


def encode(text: str) -> list[int]:
    """Tokenise *text* into a list of token IDs."""
    encoder = _get_encoder()
    return encoder.encode(text, disallowed_special=())


def decode(tokens: list[int]) -> str:
    """Decode a list of token IDs back into a string."""
    encoder = _get_encoder()
    return encoder.decode(tokens)


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------


def _split_paragraphs(text: str) -> list[str]:
    """Split text into paragraphs (separated by one or more blank lines)."""
    raw = re.split(r"\n\s*\n", text.strip())
    return [p.strip() for p in raw if p.strip()]


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences on sentence-ending punctuation."""
    parts = _SENTENCE_SPLIT_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


def chunk_text(
    text: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
) -> list[str]:
    """Split *text* into overlapping chunks of at most *max_tokens* tokens.

    The algorithm:
      1. Split the text into paragraphs.
      2. Merge paragraphs until the accumulated tokens reach
         *max_tokens*, at which point a chunk is emitted.
      3. After emitting, the last *overlap_tokens* tokens worth of
         text from the emitted chunk are prepended to the next chunk
         to preserve cross-boundary context.
      4. If a single paragraph exceeds *max_tokens*, it is further
         split by sentence.

    Args:
        text: The full document text.
        max_tokens: Soft cap on tokens per chunk (default 800).
        overlap_tokens: Number of overlapping tokens between
                        consecutive chunks (default 150).

    Returns:
        A list of chunk strings.
    """
    if not text or not text.strip():
        _LOGGER.warning("chunk_text received empty text")
        return []

    _LOGGER.info(
        "Chunking %d characters (max_tokens=%d, overlap=%d)",
        len(text),
        max_tokens,
        overlap_tokens,
    )

    encoder = _get_encoder()

    paragraphs = _split_paragraphs(text)

    chunks: list[str] = []
    current_tokens: list[int] = []  # token IDs for the current chunk
    overlap_window: list[str] = []  # stores the last *overlap_tokens* of the previous chunk

    def _emit_chunk() -> str | None:
        """Finalise the current chunk, apply overlap, and return the text."""
        nonlocal current_tokens, overlap_window
        if not current_tokens:
            return None
        chunk_text = decoder(current_tokens)
        # Remember the tail of this chunk for the next overlap
        overlap_window = _get_overlap_tokens(current_tokens, overlap_tokens, encoder)
        chunks.append(chunk_text)
        # Preserve the overlap tokens for the next chunk
        current_tokens = list(overlap_window)  # start next chunk with overlap
        return chunk_text

    def _try_add_tokens(
        new_tokens: list[int],
    ) -> bool:
        """Try adding *new_tokens* to the current chunk.

        Returns True if they fit, False if they would exceed max_tokens
        (caller should emit first, then retry).
        """
        nonlocal current_tokens
        return len(current_tokens) + len(new_tokens) <= max_tokens

    def _add_tokens(new_tokens: list[int]) -> None:
        nonlocal current_tokens
        current_tokens.extend(new_tokens)

    decoder = encoder.decode  # local alias for speed

    for para in paragraphs:
        para_tokens = list(encoder.encode(para, disallowed_special=()))
        para_len = len(para_tokens)

        if current_tokens and not _try_add_tokens(para_tokens):
            # Current chunk is full — emit it
            _emit_chunk()
            # Now retry (current_tokens now contains the overlap of the emitted chunk)
            # The overlap might already be long enough, but if not...
            if not _try_add_tokens(para_tokens):
                # Paragraph is still too big even after overlap — split further
                sub_chunks = _split_large_paragraph(para, max_tokens, overlap_tokens)
                for sc in sub_chunks:
                    sc_tokens = list(
                        encoder.encode(sc, disallowed_special=())
                    )
                    if len(sc_tokens) > max_tokens:
                        # Shouldn't happen, but guard against it
                        sc_tokens = sc_tokens[:max_tokens]
                    # Emit the previous partial (if any) before adding sub-chunk
                    if current_tokens and not _try_add_tokens(sc_tokens):
                        _emit_chunk()
                    _add_tokens(sc_tokens)
                continue

        _add_tokens(para_tokens)

    # Emit the final chunk if there's anything left
    _emit_chunk()

    _LOGGER.info(
        "Chunking complete: %d chunks for %d characters",
        len(chunks),
        len(text),
    )

    return chunks


def _get_overlap_tokens(
    tokens: list[int],
    overlap_count: int,
    encoder: tiktoken.Encoding,
) -> list[int]:
    """Return the last *overlap_count* tokens as decoded text for overlap."""
    if len(tokens) <= overlap_count:
        return list(tokens)
    return tokens[-overlap_count:]


def _split_large_paragraph(
    paragraph: str,
    max_tokens: int,
    overlap_tokens: int,
) -> list[str]:
    """Split a single paragraph that exceeds *max_tokens* by sentence."""
    sentences = _split_sentences(paragraph)
    encoder = _get_encoder()
    chunks: list[str] = []
    current_tokens: list[int] = []
    overlap_window: list[int] = []

    for sent in sentences:
        sent_tokens = list(encoder.encode(sent, disallowed_special=()))
        if not current_tokens:
            # Start with the overlap from the previous chunk
            current_tokens = list(overlap_window)

        if len(current_tokens) + len(sent_tokens) > max_tokens and current_tokens:
            # Current sentence doesn't fit — emit chunk
            chunk_text = encoder.decode(current_tokens)
            chunks.append(chunk_text)
            overlap_window = current_tokens[-overlap_tokens:] if len(current_tokens) >= overlap_tokens else list(current_tokens)
            current_tokens = list(overlap_window)

        current_tokens.extend(sent_tokens)

    if current_tokens:
        # Remove the overlap prefix if it's the only content
        text_only = encoder.decode(current_tokens)
        if text_only.strip():
            chunks.append(text_only)

    return chunks


def chunk_text_iterator(
    text: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
) -> Iterator[str]:
    """Yield chunks lazily.

    Useful for very long documents where building the full list in
    memory may be undesirable.  The logic is identical to
    :func:`chunk_text`.
    """
    chunks = chunk_text(text, max_tokens, overlap_tokens)
    yield from chunks
