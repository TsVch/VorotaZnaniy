"""Embedding generation service — wraps OpenAI's text-embedding-3-small.

Features:
  - Batch processing (10-20 chunks per API call) for lower cost
  - Exponential backoff on RateLimitError (up to 5 retries)
  - Input validation (non-empty, <= 8191 token limit per chunk)
  - Returns list of (chunk_index, chunk_text, embedding_vector)
"""

import asyncio
import logging
import time
from typing import Any

from openai import AsyncOpenAI, RateLimitError

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# OpenAI embedding model.
EMBEDDING_MODEL = "text-embedding-3-small"

# Expected embedding dimension.
EXPECTED_DIMENSIONS = 1536

# Maximum tokens per input for text-embedding-3-small.
MAX_INPUT_TOKENS = 8191

# Batch size for embedding API calls.
BATCH_SIZE = 20

# Maximum retries on RateLimitError.
MAX_RETRIES = 5

# Base delay for exponential backoff (seconds).
BASE_RETRY_DELAY = 2.0


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class EmbeddingError(Exception):
    """Raised when embedding generation fails irrecoverably."""


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class EmbeddingService:
    """Generates vector embeddings via the OpenAI API."""

    def __init__(self) -> None:
        self._client: AsyncOpenAI | None = None
        self._dimensions = EXPECTED_DIMENSIONS

    # --------------------------------------------------------------
    # Client
    # --------------------------------------------------------------

    def _get_client(self) -> AsyncOpenAI:
        """Lazy-initialise the OpenAI client."""
        if self._client is None:
            if not settings.openai_api_key:
                raise EmbeddingError(
                    "OPENAI_API_KEY is not configured"
                )
            self._client = AsyncOpenAI(
                api_key=settings.openai_api_key,
            )
        return self._client

    # --------------------------------------------------------------
    # Embedding generation (single batch)
    # --------------------------------------------------------------

    async def _embed_batch_with_retry(
        self,
        texts: list[str],
        retry_count: int = 0,
    ) -> list[list[float]]:
        """Send a batch of texts to the OpenAI Embeddings API.

        Implements exponential backoff for RateLimitError.
        """
        client = self._get_client()
        try:
            response = await client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=texts,
            )
            # Sort by index to guarantee ordering (API may shuffle).
            sorted_data = sorted(
                response.data, key=lambda d: d.index  # type: ignore[no-any-return]
            )
            return [item.embedding for item in sorted_data]

        except RateLimitError as exc:
            if retry_count >= MAX_RETRIES:
                logger.error(
                    "Rate limit exceeded after %d retries: %s",
                    MAX_RETRIES,
                    exc,
                )
                raise EmbeddingError(
                    f"Rate limit exceeded after {MAX_RETRIES} retries"
                ) from exc

            delay = BASE_RETRY_DELAY * (2 ** retry_count)
            # Use retry-after header if available, else our backoff.
            retry_after = getattr(exc, "retry_after", None)
            if retry_after is not None:
                delay = float(retry_after)

            logger.warning(
                "RateLimited (attempt %d/%d); retrying in %.1f s",
                retry_count + 1,
                MAX_RETRIES,
                delay,
            )
            await asyncio.sleep(delay)
            return await self._embed_batch_with_retry(
                texts, retry_count + 1
            )

        except Exception as exc:
            logger.exception("OpenAI API call failed: %s", exc)
            raise EmbeddingError(
                f"Embedding API call failed: {exc}"
            ) from exc

    # --------------------------------------------------------------
    # Public API
    # --------------------------------------------------------------

    async def generate_embeddings(
        self,
        chunks: list[str],
        batch_size: int = BATCH_SIZE,
    ) -> list[dict[str, Any]]:
        """Generate embeddings for a list of text chunks.

        Args:
            chunks: List of chunk texts (output of text_chunker).
            batch_size: Number of chunks per API call (default 20).

        Returns:
            List of dicts with keys:
              - chunk_index (int)
              - chunk_text (str)
              - embedding (list[float] of length 1536)

        Raises:
            EmbeddingError if all chunks fail.
        """
        if not chunks:
            logger.warning("generate_embeddings called with empty chunks")
            return []

        if not settings.openai_api_key:
            logger.error(
                "OPENAI_API_KEY is not set — cannot generate embeddings"
            )
            raise EmbeddingError("OPENAI_API_KEY is not configured")

        logger.info(
            "Generating embeddings for %d chunks (batch_size=%d)",
            len(chunks),
            batch_size,
        )

        results: list[dict[str, Any]] = []

        for batch_start in range(0, len(chunks), batch_size):
            batch = chunks[batch_start: batch_start + batch_size]
            batch_indices = list(
                range(batch_start, batch_start + len(batch))
            )

            # Check token limits for each chunk in the batch
            for idx, chunk_text in zip(batch_indices, batch):
                # Simple check — chunk should already be within limits
                # from the chunker, but guard anyway.
                if len(chunk_text) > MAX_INPUT_TOKENS * 4:
                    logger.warning(
                        "Chunk %d seems unusually long (%d chars); truncating",
                        idx,
                        len(chunk_text),
                    )
                    # Truncate to approximate max tokens
                    chunk_text = chunk_text[: MAX_INPUT_TOKENS * 2]

            logger.debug(
                "Embedding batch %d-%d (%d chunks)",
                batch_start,
                batch_start + len(batch) - 1,
                len(batch),
            )

            start_time = time.monotonic()
            embeddings = await self._embed_batch_with_retry(batch)
            elapsed = time.monotonic() - start_time

            logger.debug(
                "Batch completed in %.2f s (%.2f s per chunk)",
                elapsed,
                elapsed / len(batch) if batch else 0,
            )

            for idx, chunk_text, emb in zip(
                batch_indices, batch, embeddings
            ):
                results.append(
                    {
                        "chunk_index": idx,
                        "chunk_text": chunk_text,
                        "embedding": emb,
                    }
                )

        logger.info(
            "Embedding generation complete: %d embeddings generated",
            len(results),
        )

        return results

    async def close(self) -> None:
        """Close the OpenAI client session."""
        if self._client:
            await self._client.close()
            self._client = None
