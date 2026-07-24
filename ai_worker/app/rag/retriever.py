"""Retriever — queries the NestJS semantic search endpoint for relevant chunks.

Uses the ADR-004 HTTP Bridge pattern with X-Internal-API-Key authentication.
"""

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# HTTP timeout for the semantic search call (seconds)
SEMANTIC_SEARCH_TIMEOUT = 30.0

# Default number of chunks to retrieve
DEFAULT_TOP_K = 5


class SemanticSearchResult:
    """A single chunk returned from semantic search."""

    def __init__(self, chunk_index: int, text: str, similarity: float) -> None:
        self.chunk_index = chunk_index
        self.text = text
        self.similarity = similarity


class Retriever:
    """Retrieves relevant document chunks via NestJS semantic search."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Lazy-initialise the HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=settings.internal_api_url,
                headers={
                    "X-Internal-API-Key": settings.internal_api_key,
                    "Content-Type": "application/json",
                },
                timeout=SEMANTIC_SEARCH_TIMEOUT,
            )
        return self._client

    async def retrieve(
        self,
        document_id: str,
        query_embedding: list[float],
        top_k: int = DEFAULT_TOP_K,
    ) -> list[SemanticSearchResult]:
        """Fetch the top-K most relevant chunks for a query embedding.

        Args:
            document_id: UUID of the document to search within.
            query_embedding: 1536-dimensional embedding vector.
            top_k: Number of results to return (default 5, max 20).

        Returns:
            List of SemanticSearchResult sorted by similarity descending.
        """
        client = await self._get_client()

        payload = {
            "documentId": document_id,
            "queryEmbedding": query_embedding,
            "topK": top_k,
        }

        try:
            resp = await client.post(
                "/internal/search/semantic",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])

            logger.info(
                "Semantic search returned %d results for document %s",
                len(results),
                document_id,
            )

            return [
                SemanticSearchResult(
                    chunk_index=item["chunkIndex"],
                    text=item["chunkText"],
                    similarity=item["similarity"],
                )
                for item in results
            ]

        except httpx.HTTPStatusError as exc:
            logger.error(
                "Semantic search HTTP error for document %s: %d %s",
                document_id,
                exc.response.status_code,
                exc.response.text,
            )
            raise
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            logger.error(
                "Semantic search request failed for document %s: %s",
                document_id,
                exc,
            )
            raise

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
