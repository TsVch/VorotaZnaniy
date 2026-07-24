"""Unit tests for document_processor module."""

from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest

from app.jobs.document_processor import (
    _parse_s3_path,
    _page_s3_key,
    _validate_s3_key,
    process_document,
    DocumentProcessingResult,
)
from app.services.embedding_service import EmbeddingService
from app.services.s3_service import S3Service


# ---------------------------------------------------------------------------
# Unit tests for helper functions
# ---------------------------------------------------------------------------


class TestHelpers:
    """Tests for internal helper functions."""

    def test_validate_s3_key_allows_safe_chars(self) -> None:
        """Valid keys should pass without error."""
        _validate_s3_key("workspace-123/doc-uuid-456/file.pdf")
        _validate_s3_key("a/b/c")
        _validate_s3_key("abc/123/def.pdf")

    def test_validate_s3_key_rejects_unsafe_chars(self) -> None:
        """Keys with unsafe characters should raise ValueError."""
        with pytest.raises(ValueError, match="unsafe characters"):
            _validate_s3_key("../etc/passwd")
        with pytest.raises(ValueError, match="unsafe characters"):
            _validate_s3_key("foo/bar;rm")
        with pytest.raises(ValueError, match="unsafe characters"):
            _validate_s3_key("foo/bar baz")

    def test_parse_s3_path_valid(self) -> None:
        """parse_s3_path extracts workspace_id and document_id."""
        wid, did = _parse_s3_path("ws-1/doc-uuid/file.pdf")
        assert wid == "ws-1"
        assert did == "doc-uuid"

    def test_parse_s3_path_too_short(self) -> None:
        """parse_s3_path raises ValueError for malformed keys."""
        with pytest.raises(ValueError, match="does not match"):
            _parse_s3_path("only-two-parts")

    def test_page_s3_key_format(self) -> None:
        """page_s3_key builds correct key format."""
        key = _page_s3_key("ws-1", "doc-uuid", 3)
        assert key == "ws-1/doc-uuid/pages/page-3.webp"


# ---------------------------------------------------------------------------
# Integration-ish tests for process_document (all external calls mocked)
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_s3() -> AsyncMock:
    """Return an S3Service with all async methods mocked."""
    svc = MagicMock(spec=S3Service)
    svc.download_file = AsyncMock()
    svc.upload_file = AsyncMock()
    return svc


class TestProcessDocument:
    """Tests for the main process_document function."""

    S3_KEY = "ws-1/doc-uuid/guide.pdf"

    @pytest.fixture
    def mock_embedding_service(self) -> MagicMock:
        """Return an EmbeddingService with mocked generate_embeddings."""
        svc = MagicMock(spec=EmbeddingService)
        svc.generate_embeddings = AsyncMock(
            return_value=[
                {
                    "chunk_index": 0,
                    "chunk_text": "Sample text",
                    "embedding": [0.1] * 1536,
                },
            ]
        )
        return svc

    @pytest.mark.asyncio
    @patch("app.jobs.document_processor.fitz.open")
    async def test_successful_processing(
        self, mock_fitz_open: MagicMock, mock_s3: MagicMock,
    ) -> None:
        """process_document should render pages and upload them on success."""
        # -- Mock PyMuPDF document with 3 pages --
        mock_doc = MagicMock()
        mock_doc.page_count = 3
        mock_doc.__enter__.return_value = mock_doc
        mock_fitz_open.return_value = mock_doc

        # Each page needs get_text and get_pixmap
        mock_page = MagicMock()
        mock_page.get_text.return_value = "Sample text content"
        mock_page.get_pixmap.return_value = MagicMock()
        mock_doc.__getitem__.side_effect = lambda idx: mock_page

        result = await process_document(self.S3_KEY, mock_s3)

        assert result.success is True
        assert result.page_count == 3
        assert "Sample text content" in result.extracted_text

        # Should have downloaded and uploaded pages
        mock_s3.download_file.assert_awaited_once()
        # 3 pages → 3 uploads
        assert mock_s3.upload_file.await_count == 3

    @pytest.mark.asyncio
    @patch("app.jobs.document_processor.fitz.open")
    async def test_successful_processing_with_embeddings(
        self,
        mock_fitz_open: MagicMock,
        mock_s3: MagicMock,
        mock_embedding_service: MagicMock,
    ) -> None:
        """process_document should chunk, embed, and report chunk_count on success."""
        mock_doc = MagicMock()
        mock_doc.page_count = 1
        mock_doc.__enter__.return_value = mock_doc
        mock_fitz_open.return_value = mock_doc

        mock_page = MagicMock()
        mock_page.get_text.return_value = "Sample text content"
        mock_page.get_pixmap.return_value = MagicMock()
        mock_doc.__getitem__.side_effect = lambda idx: mock_page

        result = await process_document(
            self.S3_KEY,
            mock_s3,
            job_id="job-uuid",
            embedding_service=mock_embedding_service,
        )

        assert result.success is True
        assert result.page_count == 1
        assert result.chunk_count > 0
        mock_embedding_service.generate_embeddings.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("app.jobs.document_processor.fitz.open")
    async def test_embedding_failure_is_fatal(
        self,
        mock_fitz_open: MagicMock,
        mock_s3: MagicMock,
    ) -> None:
        """process_document should raise when embedding generation fails.

        Per TASK-004.3 (AC-3), embedding failure must be fatal — the job
        must be reported as FAILED rather than silently succeeding.
        """
        mock_doc = MagicMock()
        mock_doc.page_count = 1
        mock_doc.__enter__.return_value = mock_doc
        mock_fitz_open.return_value = mock_doc

        mock_page = MagicMock()
        mock_page.get_text.return_value = "Sample text"
        mock_page.get_pixmap.return_value = MagicMock()
        mock_doc.__getitem__.side_effect = lambda idx: mock_page

        # Embedding service that raises
        failing_embedder = MagicMock(spec=EmbeddingService)
        failing_embedder.generate_embeddings = AsyncMock(
            side_effect=RuntimeError("OpenAI API unavailable"),
        )

        # Should raise rather than returning a successful result
        with pytest.raises(RuntimeError, match="OpenAI API unavailable"):
            await process_document(
                self.S3_KEY,
                mock_s3,
                job_id="job-uuid",
                embedding_service=failing_embedder,
            )

    @pytest.mark.asyncio
    async def test_invalid_s3_key_rejected(self, mock_s3: MagicMock) -> None:
        """process_document should fail gracefully for unsafe keys."""
        result = await process_document("../malicious/key.pdf", mock_s3)
        assert result.success is False
        assert "unsafe characters" in (result.error or "")
        # S3 should NOT have been called
        mock_s3.download_file.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_download_failure_handled(
        self, mock_s3: MagicMock,
    ) -> None:
        """process_document should return error when download fails."""
        mock_s3.download_file.side_effect = FileNotFoundError(
            "S3 key not found"
        )

        result = await process_document(self.S3_KEY, mock_s3)

        assert result.success is False
        assert "S3 key not found" in (result.error or "")

    @pytest.mark.asyncio
    @patch("app.jobs.document_processor.fitz.open")
    async def test_cleanup_on_success(
        self, mock_fitz_open: MagicMock, mock_s3: MagicMock,
    ) -> None:
        """verify that temporary directory context manager cleans up."""
        mock_doc = MagicMock()
        mock_doc.page_count = 1
        mock_doc.__enter__.return_value = mock_doc
        mock_fitz_open.return_value = mock_doc

        mock_page = MagicMock()
        mock_page.get_text.return_value = "text"
        mock_page.get_pixmap.return_value = MagicMock()
        mock_doc.__getitem__.side_effect = lambda idx: mock_page

        result = await process_document(self.S3_KEY, mock_s3)
        assert result.success is True
        # The temp dir is automatically cleaned by the context manager —
        # we verify that no exceptions occurred during cleanup
        mock_doc.close.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.jobs.document_processor.fitz.open")
    async def test_extracted_text_from_multiple_pages(
        self, mock_fitz_open: MagicMock, mock_s3: MagicMock,
    ) -> None:
        """extracted_text should concatenate text from all pages."""
        mock_doc = MagicMock()
        mock_doc.page_count = 2
        mock_doc.__enter__.return_value = mock_doc
        mock_fitz_open.return_value = mock_doc

        pages_text = ["Page 1 content", "Page 2 content"]

        def mock_get_page(idx: int) -> MagicMock:
            page = MagicMock()
            page.get_text.return_value = pages_text[idx]
            page.get_pixmap.return_value = MagicMock()
            return page

        mock_doc.__getitem__.side_effect = mock_get_page

        result = await process_document(self.S3_KEY, mock_s3)
        assert result.success is True
        assert "Page 1 content" in result.extracted_text
        assert "Page 2 content" in result.extracted_text
