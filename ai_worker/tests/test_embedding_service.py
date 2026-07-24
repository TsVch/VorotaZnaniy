"""Unit tests for embedding_service module."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.embedding_service import (
    EmbeddingService,
    EmbeddingError,
    BATCH_SIZE,
    EXPECTED_DIMENSIONS,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_openai_client() -> MagicMock:
    """Return a mock AsyncOpenAI client with a working embeddings.create."""
    client = MagicMock()
    client.embeddings = MagicMock()
    client.embeddings.create = AsyncMock()
    return client


@pytest.fixture
def service(mock_openai_client: MagicMock) -> EmbeddingService:
    """Return an EmbeddingService with a mocked OpenAI client."""
    svc = EmbeddingService()
    svc._client = mock_openai_client
    return svc


def _make_mock_response(
    chunk_count: int,
    dim: int = EXPECTED_DIMENSIONS,
) -> MagicMock:
    """Build a mock EmbeddingsResponse with *chunk_count* vectors."""
    response = MagicMock()
    # Build mock data entries with index and embedding
    items = []
    for i in range(chunk_count):
        item = MagicMock()
        item.index = i
        item.embedding = [float(j % 10) * 0.1 for j in range(dim)]
        items.append(item)
    response.data = items
    return response


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestEmbeddingService:
    """Tests for EmbeddingService."""

    SAMPLE_CHUNKS = [
        "This is the first chunk of text for testing.",
        "This is the second chunk with some different content.",
        "And the third chunk completes the test set.",
    ]

    def test_generate_embeddings_success(
        self,
        service: EmbeddingService,
        mock_openai_client: MagicMock,
    ) -> None:
        """generate_embeddings should process chunks and return correct results."""
        mock_openai_client.embeddings.create.return_value = (
            _make_mock_response(len(self.SAMPLE_CHUNKS))
        )

        results = service.generate_embeddings(self.SAMPLE_CHUNKS, batch_size=10)

        assert len(results) == 3
        for r in results:
            assert "chunk_index" in r
            assert "chunk_text" in r
            assert "embedding" in r
            assert len(r["embedding"]) == EXPECTED_DIMENSIONS

    def test_generate_embeddings_index_order(
        self,
        service: EmbeddingService,
        mock_openai_client: MagicMock,
    ) -> None:
        """Result indices should match the input order."""
        mock_openai_client.embeddings.create.return_value = (
            _make_mock_response(len(self.SAMPLE_CHUNKS))
        )

        results = service.generate_embeddings(self.SAMPLE_CHUNKS, batch_size=10)

        for i, r in enumerate(results):
            assert r["chunk_index"] == i
            assert r["chunk_text"] == self.SAMPLE_CHUNKS[i]

    def test_empty_chunks(self, service: EmbeddingService) -> None:
        """generate_embeddings should return empty list for empty input."""
        results = service.generate_embeddings([])
        assert results == []

    def test_batch_splitting(
        self,
        service: EmbeddingService,
        mock_openai_client: MagicMock,
    ) -> None:
        """Multiple batches should each call the API."""
        many_chunks = [
            f"Chunk number {i} with some padding text." for i in range(35)
        ]
        mock_openai_client.embeddings.create.return_value = (
            _make_mock_response(BATCH_SIZE)
        )

        results = service.generate_embeddings(many_chunks, batch_size=BATCH_SIZE)
        assert len(results) == 35
        # At least 2 calls for 35 items with batch_size=20
        assert mock_openai_client.embeddings.create.await_count >= 2

    def test_api_key_missing(self) -> None:
        """generate_embeddings should raise EmbeddingError when API key is not set."""
        from app.core.config import settings

        original_key = settings.openai_api_key
        settings.openai_api_key = ""
        svc = EmbeddingService()
        try:
            with pytest.raises(EmbeddingError, match="OPENAI_API_KEY"):
                svc.generate_embeddings(["test chunk"])
        finally:
            settings.openai_api_key = original_key

    def test_rate_limit_retry(
        self,
        service: EmbeddingService,
        mock_openai_client: MagicMock,
    ) -> None:
        """RateLimitError should trigger exponential backoff and retry."""
        from openai import RateLimitError

        # First call raises RateLimitError, second succeeds
        mock_openai_client.embeddings.create.side_effect = [
            RateLimitError(
                message="Rate limited",
                response=MagicMock(status_code=429),
                body=None,
            ),
            _make_mock_response(1),
        ]

        results = service.generate_embeddings(
            ["Single chunk for testing."],
            batch_size=10,
        )

        assert len(results) == 1
        assert mock_openai_client.embeddings.create.await_count == 2

    def test_rate_limit_exhausted(
        self,
        service: EmbeddingService,
        mock_openai_client: MagicMock,
    ) -> None:
        """Repeated RateLimitError should raise EmbeddingError."""
        from openai import RateLimitError

        rate_limit_error = RateLimitError(
            message="Rate limited",
            response=MagicMock(status_code=429),
            body=None,
        )

        mock_openai_client.embeddings.create.side_effect = [
            rate_limit_error,
            rate_limit_error,
            rate_limit_error,
            rate_limit_error,
            rate_limit_error,
            rate_limit_error,  # one more than MAX_RETRIES (5)
        ]

        with pytest.raises(EmbeddingError, match="Rate limit exceeded"):
            service.generate_embeddings(
                ["Test chunk for rate limiting."],
                batch_size=10,
            )

    def test_generate_embeddings_actual_call(
        self,
    ) -> None:
        """Verify that generate_embeddings calls _embed_batch_with_retry
        correctly for a realistic scenario with proper results."""
        # Use a fresh service without mocked client
        svc = EmbeddingService()
        svc._client = None  # Will fail on _get_client, but we mock _embed_batch_with_retry

        with patch.object(
            svc, "_embed_batch_with_retry", new_callable=AsyncMock
        ) as mock_batch:
            mock_batch.return_value = [
                [0.1] * EXPECTED_DIMENSIONS,
                [0.2] * EXPECTED_DIMENSIONS,
            ]

            results = svc.generate_embeddings(["Chunk 1", "Chunk 2"], batch_size=10)

            assert len(results) == 2
            assert results[0]["chunk_index"] == 0
            assert results[1]["chunk_index"] == 1
            assert results[0]["chunk_text"] == "Chunk 1"
            assert len(results[0]["embedding"]) == EXPECTED_DIMENSIONS
