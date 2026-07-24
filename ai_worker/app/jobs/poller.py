"""HTTP Bridge Poller — ADR-004 implementation.

Full polling loop that:
1. Fetches pending jobs from NestJS (GET /internal/jobs/pending)
2. Processes each job via document_processor
3. Reports success (POST /internal/jobs/{id}/result) or failure
   (POST /internal/jobs/{id}/failure)
4. Implements exponential backoff (5 s → 30 s) when no jobs are found
"""

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.jobs.document_processor import process_document
from app.services.embedding_service import EmbeddingService
from app.services.s3_service import S3Service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Initial delay between polls when no jobs are found (seconds)
INITIAL_BACKOFF = 5.0

# Maximum delay between polls
MAX_BACKOFF = 30.0

# Backoff multiplier
BACKOFF_MULTIPLIER = 2.0

# HTTP request timeout
HTTP_TIMEOUT = 60.0

# ---------------------------------------------------------------------------
# Poller
# ---------------------------------------------------------------------------


class JobPoller:
    """Polls the backend NestJS Jobs Bridge for pending AI processing jobs.

    Usage:
        poller = JobPoller(s3_service, embedding_service)
        await poller.start()       # runs forever (or until cancelled)
        await poller.stop()        # graceful shutdown
    """

    def __init__(
        self,
        s3_service: S3Service,
        embedding_service: EmbeddingService | None = None,
    ) -> None:
        self._s3_service = s3_service
        self._embedding_service = embedding_service
        self._client: httpx.AsyncClient | None = None
        self._running = False
        self._poll_task: asyncio.Task[None] | None = None

    # --------------------------------------------------------------
    # Client management
    # --------------------------------------------------------------

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=settings.internal_api_url,
                headers={
                    "X-Internal-API-Key": settings.internal_api_key,
                    "Content-Type": "application/json",
                },
                timeout=HTTP_TIMEOUT,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client gracefully."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # --------------------------------------------------------------
    # API calls to NestJS Jobs Bridge
    # --------------------------------------------------------------

    async def _fetch_pending_jobs(
        self, limit: int = 10
    ) -> list[dict[str, Any]]:
        """GET /internal/jobs/pending — fetch pending ai_processing jobs."""
        client = await self._get_client()
        try:
            resp = await client.get(
                "/internal/jobs/pending", params={"limit": limit}
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("jobs", [])
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.warning("Failed to fetch pending jobs: %s", exc)
            return []

    async def _report_success(
        self, job_id: str, page_count: int, extracted_text: str
    ) -> bool:
        """POST /internal/jobs/{id}/result — report successful processing."""
        client = await self._get_client()
        payload = {
            "page_count": page_count,
            "extracted_text": extracted_text,
            "status": "success",
        }
        try:
            resp = await client.post(
                f"/internal/jobs/{job_id}/result",
                json=payload,
            )
            resp.raise_for_status()
            logger.info("Job %s reported as successful", job_id)
            return True
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.error(
                "Failed to report success for job %s: %s", job_id, exc
            )
            return False

    async def _report_failure(self, job_id: str, error: str) -> bool:
        """POST /internal/jobs/{id}/failure — report processing failure."""
        client = await self._get_client()
        payload = {"error": error}
        try:
            resp = await client.post(
                f"/internal/jobs/{job_id}/failure",
                json=payload,
            )
            resp.raise_for_status()
            logger.info("Job %s reported as failed: %s", job_id, error)
            return True
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.error(
                "Failed to report failure for job %s: %s", job_id, exc
            )
            return False

    # --------------------------------------------------------------
    # Job processing
    # --------------------------------------------------------------

    async def _handle_job(self, job: dict[str, Any]) -> None:
        """Process a single job and report the result."""
        job_id: str = job["id"]
        payload: dict[str, Any] = job.get("payload", {})
        s3_key: str = payload.get("s3_key", "")

        if not s3_key:
            logger.warning("Job %s has no s3_key in payload; skipping", job_id)
            await self._report_failure(job_id, "Missing s3_key in payload")
            return

        logger.info(
            "Processing job %s: document_id=%s, s3_key=%s",
            job_id,
            payload.get("document_id", "?"),
            s3_key,
        )

        # Wrap process_document in try/except so that any unexpected
        # exception (e.g. embedding failure) is caught and reported
        # as a job failure, rather than silently swallowed by the
        # outer loop's broad except.
        try:
            result = await process_document(
                s3_key,
                self._s3_service,
                job_id=job_id,
                embedding_service=self._embedding_service,
            )
        except Exception as exc:
            logger.exception(
                "Unhandled exception processing job %s: %s", job_id, exc
            )
            await self._report_failure(
                job_id,
                f"Unhandled error: {exc}",
            )
            return

        if result.success:
            await self._report_success(
                job_id,
                page_count=result.page_count,
                extracted_text=result.extracted_text,
            )
        else:
            await self._report_failure(job_id, result.error or "Unknown error")

    # --------------------------------------------------------------
    # Main loop
    # --------------------------------------------------------------

    async def _run_loop(self) -> None:
        """Main polling loop — runs until *stop()* is called."""
        backoff = INITIAL_BACKOFF

        logger.info(
            "JobPoller started: polling %s/internal/jobs/pending",
            settings.internal_api_url,
        )

        while self._running:
            try:
                jobs = await self._fetch_pending_jobs()

                if not jobs:
                    # Exponential backoff when idle
                    logger.debug(
                        "No pending jobs; sleeping %.1f s", backoff
                    )
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF)
                    continue

                # Reset backoff on successful job fetch
                backoff = INITIAL_BACKOFF
                logger.info("Fetched %d pending job(s)", len(jobs))

                for job in jobs:
                    if not self._running:
                        break
                    await self._handle_job(job)

            except asyncio.CancelledError:
                logger.info("Poller loop cancelled")
                break
            except Exception as exc:  # noqa: BLE001
                logger.exception("Unexpected error in poller loop: %s", exc)
                await asyncio.sleep(backoff)
                backoff = min(backoff * BACKOFF_MULTIPLIER, MAX_BACKOFF)

        logger.info("JobPoller stopped")

    # --------------------------------------------------------------
    # Lifecycle
    # --------------------------------------------------------------

    async def start(self) -> None:
        """Start the polling loop in a background task."""
        if self._running:
            logger.warning("JobPoller is already running")
            return
        self._running = True
        self._poll_task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        """Signal the poller to stop and wait for the task to finish."""
        self._running = False
        if self._poll_task is not None:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
            self._poll_task = None
        await self.close()
