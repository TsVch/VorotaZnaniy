"""Generator — constructs the RAG prompt and parses LLM responses with citations.

Builds a structured prompt from retrieved chunks, calls OpenAI gpt-4o-mini,
and parses source citations marked with [N] syntax.
"""

import logging
import re
from typing import Any

from openai import AsyncOpenAI, APIError

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# LLM model for answer generation.
ANSWER_MODEL = "gpt-4o-mini"

# Max tokens for the answer itself.
MAX_ANSWER_TOKENS = 1024

# Temperature — low for factual accuracy.
TEMPERATURE = 0.3

# Max total context tokens (sum of all chunk texts).
MAX_CONTEXT_TOKENS = 3000

# ---------------------------------------------------------------------------
# System prompt (RAG instruction)
# ---------------------------------------------------------------------------

QA_SYSTEM_PROMPT = (
    "You are a helpful assistant that answers questions about a specific "
    "document. Use ONLY the context provided below to answer. "
    "If the answer is not in the context, say "
    '"I don\'t have enough information to answer this question." '
    "Cite sources using [1], [2] markers that correspond to the context items. "
    "Keep your answer concise and accurate."
)

# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------


def _build_context(context_items: list[dict[str, Any]]) -> str:
    """Build a formatted context block from retrieved chunks.

    Each chunk is prefixed with its citation marker [1], [2], etc.
    The total context is truncated to ~MAX_CONTEXT_TOKENS characters as a
    rough heuristic (character count / 4 ≈ token count).
    """
    max_chars = MAX_CONTEXT_TOKENS * 4  # ~12 000 chars
    parts: list[str] = []
    total = 0

    for i, item in enumerate(context_items, start=1):
        chunk_text = item.get("chunk_text", item.get("text", ""))
        formatted = f"[{i}] {chunk_text} (page {item.get('chunk_index', '?')})\n"
        total += len(formatted)
        if total > max_chars:
            # Truncate the last chunk to fit
            remaining = max_chars - (total - len(formatted))
            if remaining > 50:
                formatted = formatted[:remaining] + "..."
                parts.append(formatted)
            break
        parts.append(formatted)

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Citation parser
# ---------------------------------------------------------------------------

# Regex to find citation markers like [1], [12], [3, 5]
_CITATION_RE = re.compile(r"\[(\d+)\]")


def _parse_citations(
    answer: str,
    context_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Extract cited sources from the LLM answer.

    Returns a list of ``{chunkIndex: int, text: str}`` dicts corresponding
    to the [N] markers found in the answer text.
    """
    cited_numbers: set[int] = set()
    for match in _CITATION_RE.finditer(answer):
        try:
            num = int(match.group(1))
            cited_numbers.add(num)
        except ValueError:
            continue

    sources: list[dict[str, Any]] = []
    for num in sorted(cited_numbers):
        idx = num - 1  # [1] → index 0
        if 0 <= idx < len(context_items):
            item = context_items[idx]
            sources.append(
                {
                    "chunkIndex": item.get(
                        "chunk_index", item.get("chunkIndex", idx)
                    ),
                    "text": item.get("chunk_text", item.get("text", "")),
                }
            )

    return sources


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    """Lazy-initialise the OpenAI client."""
    global _client  # noqa: PLW0603
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def generate_answer(
    question: str,
    context_items: list[dict[str, Any]],
) -> dict[str, Any]:
    """Generate an answer using the RAG pipeline.

    Args:
        question: The user's question (3–500 chars).
        context_items: List of chunk dicts with ``chunk_text``, ``chunk_index``.

    Returns:
        Dict with ``answer`` (str) and ``sources`` (list of dicts).
    """
    if not context_items:
        return {
            "answer": "I don't have enough information to answer this question.",
            "sources": [],
        }

    context_block = _build_context(context_items)

    logger.info(
        "Generating answer: question_len=%d, context_chunks=%d, context_len=%d",
        len(question),
        len(context_items),
        len(context_block),
    )

    try:
        client = _get_client()
        response = await client.chat.completions.create(
            model=ANSWER_MODEL,
            messages=[
                {"role": "system", "content": QA_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Context:\n{context_block}\n\n"
                        f"Question: {question}"
                    ),
                },
            ],
            max_tokens=MAX_ANSWER_TOKENS,
            temperature=TEMPERATURE,
        )
    except APIError as exc:
        logger.error("OpenAI API error during answer generation: %s", exc)
        raise
    except RuntimeError as exc:
        logger.error("Configuration error: %s", exc)
        raise

    answer = response.choices[0].message.content or ""
    answer = answer.strip()

    if not answer:
        logger.warning("OpenAI returned empty answer")
        return {
            "answer": "I don't have enough information to answer this question.",
            "sources": [],
        }

    # Parse citations from the answer
    sources = _parse_citations(answer, context_items)

    # Clean citation markers from answer text (keep [N] for frontend rendering)
    # Actually keep them — the frontend may use them for highlighting

    logger.info(
        "Answer generated: %d chars, %d sources cited",
        len(answer),
        len(sources),
    )

    return {"answer": answer, "sources": sources}


async def close_client() -> None:
    """Close the OpenAI client (call on shutdown)."""
    global _client  # noqa: PLW0603
    if _client is not None:
        await _client.close()
        _client = None
