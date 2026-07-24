"""Unit tests for the /internal/ai/summary endpoint."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.main import app

# Patch the internal API key so auth passes in tests
_TEST_API_KEY = "test-internal-key"


@pytest.fixture(autouse=True)
def _patch_settings() -> None:
    """Ensure internal_api_key is set for all tests in this module."""
    with patch.object(settings, "internal_api_key", _TEST_API_KEY):
        yield


@pytest.fixture
def client() -> AsyncClient:
    """Return an async HTTP client for testing FastAPI endpoints."""
    return AsyncClient(app=app, base_url="http://test")


class TestSummaryEndpoint:
    """Tests for POST /internal/ai/summary."""

    SUMMARY_URL = "/internal/ai/summary"
    VALID_PAYLOAD = {"text": "This is a sample document text for summarisation."}

    async def _send(
        self, client: AsyncClient, payload: dict | None = None,
        api_key: str | None = _TEST_API_KEY,
    ) -> httpx.Response:
        """Helper to send a POST to the summary endpoint."""
        headers: dict[str, str] = {}
        if api_key is not None:
            headers["X-Internal-API-Key"] = api_key
        return await client.post(
            self.SUMMARY_URL,
            json=payload or self.VALID_PAYLOAD,
            headers=headers,
        )

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    async def test_missing_auth_returns_401(self, client: AsyncClient) -> None:
        """POST /internal/ai/summary without auth header should return 401."""
        resp = await client.post(
            self.SUMMARY_URL,
            json=self.VALID_PAYLOAD,
        )
        assert resp.status_code == 401

    async def test_invalid_api_key_returns_401(
        self, client: AsyncClient,
    ) -> None:
        """POST /internal/ai/summary with wrong key should return 401."""
        resp = await client.post(
            self.SUMMARY_URL,
            json=self.VALID_PAYLOAD,
            headers={"Authorization": "Bearer wrong-key"},
        )
        assert resp.status_code == 401

    # ------------------------------------------------------------------
    # Input validation
    # ------------------------------------------------------------------

    async def test_empty_text_returns_400(self, client: AsyncClient) -> None:
        """POST /internal/ai/summary with empty text should return 400."""
        resp = await self._send(client, {"text": "   "})
        assert resp.status_code == 400

    async def test_missing_text_field_returns_422(
        self, client: AsyncClient,
    ) -> None:
        """POST /internal/ai/summary without text field should return 422."""
        resp = await self._send(client, {})
        assert resp.status_code == 422

    # ------------------------------------------------------------------
    # Successful generation (mocked OpenAI)
    # ------------------------------------------------------------------

    @patch("app.api.routes.summary._get_client")
    async def test_successful_summary_generation(
        self, mock_get_client: MagicMock, client: AsyncClient,
    ) -> None:
        """POST /internal/ai/summary should return summary on success."""
        mock_client = MagicMock()
        mock_chunk = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "• Key takeaway 1\n• Key takeaway 2\n"
        mock_chunk.choices = [mock_choice]
        mock_client.chat.completions.create = AsyncMock(
            return_value=mock_chunk,
        )
        mock_get_client.return_value = mock_client

        resp = await self._send(client)

        assert resp.status_code == 200
        data = resp.json()
        assert "summary" in data
        assert "Key takeaway" in data["summary"]

    @patch("app.api.routes.summary._get_client")
    async def test_summary_truncates_long_text(
        self, mock_get_client: MagicMock, client: AsyncClient,
    ) -> None:
        """Very long text should be truncated before sending to OpenAI."""
        mock_client = MagicMock()
        mock_chunk = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "Short summary"
        mock_chunk.choices = [mock_choice]
        mock_client.chat.completions.create = AsyncMock(
            return_value=mock_chunk,
        )
        mock_get_client.return_value = mock_client

        long_text = "A" * 10_000
        resp = await self._send(client, {"text": long_text})

        assert resp.status_code == 200
        # Verify the text sent to OpenAI was truncated to 4000
        call_args = mock_client.chat.completions.create.call_args
        assert call_args is not None
        user_msg = call_args[1]["messages"][1]["content"]
        assert len(user_msg) == 4000

    # ------------------------------------------------------------------
    # Error handling
    # ------------------------------------------------------------------

    @patch("app.api.routes.summary._get_client")
    async def test_openai_api_error_returns_502(
        self, mock_get_client: MagicMock, client: AsyncClient,
    ) -> None:
        """OpenAI API error should return 502 Bad Gateway."""
        from openai import APIError

        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(
            side_effect=APIError(
                message="API rate limit exceeded",
                request=MagicMock(),
                body=None,
            ),
        )
        mock_get_client.return_value = mock_client

        resp = await self._send(client)
        assert resp.status_code == 502

    @patch("app.api.routes.summary._get_client")
    async def test_openai_empty_response_returns_502(
        self, mock_get_client: MagicMock, client: AsyncClient,
    ) -> None:
        """Empty response from OpenAI should return 502."""
        mock_client = MagicMock()
        mock_chunk = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = ""
        mock_chunk.choices = [mock_choice]
        mock_client.chat.completions.create = AsyncMock(
            return_value=mock_chunk,
        )
        mock_get_client.return_value = mock_client

        resp = await self._send(client)
        assert resp.status_code == 502
