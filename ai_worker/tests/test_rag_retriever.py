"""Unit tests for the RAG retriever module."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.rag.retriever import Retriever, SemanticSearchResult


@pytest.fixture
def retriever() -> Retriever:
    """Return a Retriever with a mocked HTTP client."""
    r = Retriever()
    r._client = AsyncMock(spec=httpx.AsyncClient)
    return r


class TestRetriever:
    """Tests for the Retriever class."""

    @pytest.mark.asyncio
    async def test_retrieve_returns_results(self, retriever: Retriever) -> None:
        """retrieve should parse and return SemanticSearchResults."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {
                    "chunkIndex": 0,
                    "chunkText": "Relevant content about AI",
                    "similarity": 0.95,
                },
                {
                    "chunkIndex": 2,
                    "chunkText": "More relevant content",
                    "similarity": 0.87,
                },
            ],
        }
        retriever._client.post.return_value = mock_response  # type: ignore[attr-defined]

        results = await retriever.retrieve(
            "doc-uuid", [0.1] * 1536, top_k=5
        )

        assert len(results) == 2
        assert isinstance(results[0], SemanticSearchResult)
        assert results[0].chunk_index == 0
        assert results[0].text == "Relevant content about AI"
        assert results[0].similarity == 0.95
        assert results[1].chunk_index == 2

    @pytest.mark.asyncio
    async def test_retrieve_empty_results(self, retriever: Retriever) -> None:
        """retrieve should return empty list when no results found."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {"results": []}
        retriever._client.post.return_value = mock_response  # type: ignore[attr-defined]

        results = await retriever.retrieve(
            "doc-uuid", [0.1] * 1536
        )

        assert results == []

    @pytest.mark.asyncio
    async def test_retrieve_http_error(self, retriever: Retriever) -> None:
        """retrieve should raise when backend returns error."""
        retriever._client.post.side_effect = (  # type: ignore[attr-defined]
            httpx.HTTPStatusError(
                "502 Server Error",
                request=MagicMock(),
                response=MagicMock(status_code=502),
            )
        )

        with pytest.raises(httpx.HTTPStatusError):
            await retriever.retrieve("doc-uuid", [0.1] * 1536)

    @pytest.mark.asyncio
    async def test_retrieve_timeout(self, retriever: Retriever) -> None:
        """retrieve should raise on timeout."""
        retriever._client.post.side_effect = (  # type: ignore[attr-defined]
            httpx.TimeoutException("Request timed out")
        )

        with pytest.raises(httpx.RequestError):
            await retriever.retrieve("doc-uuid", [0.1] * 1536)
