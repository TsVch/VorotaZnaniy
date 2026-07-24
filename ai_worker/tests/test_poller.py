"""Unit tests for JobPoller — ADR-004 HTTP Bridge polling loop."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.jobs.poller import JobPoller


@pytest.fixture
def mock_s3() -> MagicMock:
    """Return a mock S3Service."""
    return MagicMock()


@pytest.fixture
def poller(mock_s3: MagicMock) -> JobPoller:
    """Return a JobPoller with a mocked HTTP transport."""
    p = JobPoller(mock_s3)
    # Replace the real httpx client with a mock
    p._client = AsyncMock(spec=httpx.AsyncClient)
    return p


class TestJobPoller:
    """Tests for the ADR-004 JobPoller."""

    # --------------------------------------------------------------
    # API call tests
    # --------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_fetch_pending_jobs_returns_list(
        self, poller: JobPoller,
    ) -> None:
        """fetch_pending_jobs should return parsed job list on 200."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "jobs": [
                {
                    "id": "job-1",
                    "type": "ai_processing",
                    "payload": {"s3_key": "key.pdf", "document_id": "doc-1"},
                    "created_at": "2026-07-21T00:00:00Z",
                },
            ],
        }
        poller._client.get.return_value = mock_response  # type: ignore[attr-defined]

        jobs = await poller._fetch_pending_jobs()
        assert len(jobs) == 1
        assert jobs[0]["id"] == "job-1"
        assert jobs[0]["payload"]["s3_key"] == "key.pdf"

    @pytest.mark.asyncio
    async def test_fetch_pending_jobs_handles_http_error(
        self, poller: JobPoller,
    ) -> None:
        """fetch_pending_jobs should return empty list on HTTP error."""
        poller._client.get.side_effect = httpx.HTTPStatusError(  # type: ignore[attr-defined]
            "500 Server Error", request=MagicMock(), response=MagicMock()
        )
        jobs = await poller._fetch_pending_jobs()
        assert jobs == []

    @pytest.mark.asyncio
    async def test_fetch_pending_jobs_handles_timeout(
        self, poller: JobPoller,
    ) -> None:
        """fetch_pending_jobs should return empty list on timeout."""
        poller._client.get.side_effect = httpx.TimeoutException(  # type: ignore[attr-defined]
            "Connection timed out"
        )
        jobs = await poller._fetch_pending_jobs()
        assert jobs == []

    @pytest.mark.asyncio
    async def test_report_success(self, poller: JobPoller) -> None:
        """report_success should POST /internal/jobs/{id}/result."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        poller._client.post.return_value = mock_response  # type: ignore[attr-defined]

        result = await poller._report_success(
            "job-1", page_count=5, extracted_text="Hello world"
        )
        assert result is True
        poller._client.post.assert_called_once_with(  # type: ignore[attr-defined]
            "/internal/jobs/job-1/result",
            json={
                "page_count": 5,
                "extracted_text": "Hello world",
                "status": "success",
            },
        )

    @pytest.mark.asyncio
    async def test_report_failure(self, poller: JobPoller) -> None:
        """report_failure should POST /internal/jobs/{id}/failure."""
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        poller._client.post.return_value = mock_response  # type: ignore[attr-defined]

        result = await poller._report_failure("job-1", "PDF corrupted")
        assert result is True
        poller._client.post.assert_called_once_with(  # type: ignore[attr-defined]
            "/internal/jobs/job-1/failure",
            json={"error": "PDF corrupted"},
        )

    # --------------------------------------------------------------
    # Job handling tests
    # --------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_handle_job_success(
        self, poller: JobPoller,
    ) -> None:
        """handle_job should call process_document and report success.

        We mock process_document to return success and verify the
        poller calls _report_success with the correct values.
        """
        poller._report_success = AsyncMock(return_value=True)  # type: ignore[attr-defined]
        poller._report_failure = AsyncMock(return_value=True)  # type: ignore[attr-defined]

        with patch(
            "app.jobs.poller.process_document",
            new=AsyncMock(
                return_value=MagicMock(
                    success=True, page_count=3, extracted_text="content"
                )
            ),
        ) as mock_process:
            job = {
                "id": "job-1",
                "type": "ai_processing",
                "payload": {
                    "s3_key": "ws/doc/file.pdf",
                    "document_id": "doc-1",
                },
            }
            await poller._handle_job(job)

            mock_process.assert_awaited_once_with(
                "ws/doc/file.pdf",
                poller._s3_service,
                job_id="job-1",
                embedding_service=poller._embedding_service,
            )
            poller._report_success.assert_awaited_once_with(  # type: ignore[attr-defined]
                "job-1", page_count=3, extracted_text="content"
            )
            poller._report_failure.assert_not_awaited()  # type: ignore[attr-defined]

    @pytest.mark.asyncio
    async def test_handle_job_failure(
        self, poller: JobPoller,
    ) -> None:
        """handle_job should report failure when processing errors."""
        poller._report_success = AsyncMock(return_value=True)  # type: ignore[attr-defined]
        poller._report_failure = AsyncMock(return_value=True)  # type: ignore[attr-defined]

        with patch(
            "app.jobs.poller.process_document",
            new=AsyncMock(
                return_value=MagicMock(success=False, error="Parse error")
            ),
        ):
            job = {
                "id": "job-1",
                "type": "ai_processing",
                "payload": {"s3_key": "bad/key.pdf"},
            }
            await poller._handle_job(job)

            poller._report_failure.assert_awaited_once_with(  # type: ignore[attr-defined]
                "job-1", "Parse error"
            )
            poller._report_success.assert_not_awaited()  # type: ignore[attr-defined]

    @pytest.mark.asyncio
    async def test_handle_job_missing_s3_key(
        self, poller: JobPoller,
    ) -> None:
        """handle_job should report failure when s3_key is missing."""
        poller._report_success = AsyncMock(return_value=True)  # type: ignore[attr-defined]
        poller._report_failure = AsyncMock(return_value=True)  # type: ignore[attr-defined]

        job = {
            "id": "job-1",
            "type": "ai_processing",
            "payload": {},
        }
        await poller._handle_job(job)

        poller._report_failure.assert_awaited_once_with(  # type: ignore[attr-defined]
            "job-1", "Missing s3_key in payload"
        )

    @pytest.mark.asyncio
    async def test_handle_job_unhandled_exception(
        self, poller: JobPoller,
    ) -> None:
        """handle_job should catch unhandled exceptions from process_document
        and report them as failures via the defensive try/except.
        """
        poller._report_success = AsyncMock(return_value=True)  # type: ignore[attr-defined]
        poller._report_failure = AsyncMock(return_value=True)  # type: ignore[attr-defined]

        with patch(
            "app.jobs.poller.process_document",
            new=AsyncMock(
                side_effect=RuntimeError("EMBEDDING_GENERATION_FAILED")
            ),
        ):
            job = {
                "id": "job-1",
                "type": "ai_processing",
                "payload": {"s3_key": "ws/doc/file.pdf"},
            }
            await poller._handle_job(job)

            # Should report failure, not success
            poller._report_failure.assert_awaited_once()  # type: ignore[attr-defined]
            poller._report_success.assert_not_awaited()  # type: ignore[attr-defined]

            # Error message should contain the exception info
            call_args = poller._report_failure.await_args  # type: ignore[attr-defined]
            assert call_args is not None
            assert "EMBEDDING_GENERATION_FAILED" in call_args[0][1]
