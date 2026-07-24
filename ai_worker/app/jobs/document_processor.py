"""Document processing service — PDF parsing, page rendering, text extraction,
chunking, embedding generation, and vector persistence.

Uses PyMuPDF (fitz) to:
- Render each page to a high-quality WebP image
- Extract full document text
- Upload rendered pages back to S3
- Chunk extracted text and generate embeddings
- Persist embeddings via NestJS Jobs Bridge
- Ensure all temporary files are cleaned up
"""

import json
import logging
import os
import re
import tempfile
from pathlib import Path

import fitz  # PyMuPDF
import httpx

from app.core.config import settings
from app.services.embedding_service import EmbeddingError, EmbeddingService
from app.services.s3_service import S3Service
from app.services.text_chunker import chunk_text

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# WebP output quality (0–100). 85 offers a good balance for MVP.
WEBP_QUALITY = 85

# DPI for page rendering — 200 DPI is readable without huge file sizes.
RENDER_DPI = 200

# Regex for validating S3 object keys against directory traversal.
SAFE_KEY_RE = re.compile(r"^[a-zA-Z0-9_\-./]+$")

# HTTP timeout for NestJS API calls
HTTP_TIMEOUT = 30.0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_s3_key(key: str) -> None:
    """Raise ValueError if *key* contains unsafe characters."""
    if not SAFE_KEY_RE.match(key):
        raise ValueError(
            f"S3 key contains unsafe characters: {key!r}. "
            "Only alphanumeric, underscore, hyphen, dot, and forward-slash allowed."
        )


def _parse_s3_path(s3_key: str) -> tuple[str, str]:
    """Extract (workspace_id, document_id) from an S3 object key.

    Expected format: ``{workspace_id}/{document_id}/{filename}.pdf``
    """
    parts = s3_key.split("/")
    if len(parts) < 3:
        raise ValueError(
            f"S3 key {s3_key!r} does not match expected "
            f"workspace_id/document_id/filename.pdf pattern"
        )
    return parts[0], parts[1]


def _page_s3_key(workspace_id: str, document_id: str, page_num: int) -> str:
    """Build the S3 key for a rendered page image."""
    return f"{workspace_id}/{document_id}/pages/page-{page_num}.webp"


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


class DocumentProcessingResult:
    """Holds the outcome of processing a single document."""

    def __init__(
        self,
        success: bool,
        page_count: int = 0,
        extracted_text: str = "",
        chunk_count: int = 0,
        error: str | None = None,
    ) -> None:
        self.success = success
        self.page_count = page_count
        self.extracted_text = extracted_text
        self.chunk_count = chunk_count
        self.error = error


# ---------------------------------------------------------------------------
# Embedding persistence helpers
# ---------------------------------------------------------------------------


async def _send_embeddings_to_backend(
    job_id: str,
    document_id: str,
    embeddings: list[dict],
) -> bool:
    """Send generated embeddings to the NestJS Jobs Bridge for persistence.

    Uses the ADR-004 HTTP Bridge pattern with X-Internal-API-Key header.
    """
    payload = {
        "documentId": document_id,
        "embeddings": [
            {
                "chunkIndex": e["chunk_index"],
                "chunkText": e["chunk_text"],
                "embedding": e["embedding"],
            }
            for e in embeddings
        ],
    }

    async with httpx.AsyncClient(
        base_url=settings.internal_api_url,
        headers={
            "X-Internal-API-Key": settings.internal_api_key,
            "Content-Type": "application/json",
        },
        timeout=HTTP_TIMEOUT,
    ) as client:
        try:
            resp = await client.post(
                f"/internal/jobs/{job_id}/embeddings",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            saved_count = data.get("count", 0)
            logger.info(
                "Saved %d embeddings for document %s (job %s)",
                saved_count,
                document_id,
                job_id,
            )
            return True
        except (httpx.HTTPError, httpx.TimeoutException, json.JSONDecodeError) as exc:
            logger.error(
                "Failed to save embeddings for document %s: %s",
                document_id,
                exc,
            )
            return False


# ---------------------------------------------------------------------------
# Core processing function
# ---------------------------------------------------------------------------


async def process_document(
    s3_key: str,
    s3_service: S3Service,
    job_id: str | None = None,
    embedding_service: EmbeddingService | None = None,
) -> DocumentProcessingResult:
    """Download a PDF from S3, render pages, extract text, upload pages,
    then chunk text and generate embeddings.

    Args:
        s3_key: S3 object key of the PDF to process.
        s3_service: Initialised S3Service instance.
        job_id: PendingJob ID (for embedding persistence callback).
        embedding_service: Optional EmbeddingService instance. If None,
                           embedding generation is skipped.

    Returns:
        A DocumentProcessingResult indicating success/failure.
    """
    # -- Security: validate the S3 key --------------------------------
    try:
        _validate_s3_key(s3_key)
        workspace_id, document_id = _parse_s3_path(s3_key)
    except ValueError as exc:
        logger.error("Invalid S3 key %r: %s", s3_key, exc)
        return DocumentProcessingResult(
            success=False, page_count=0, error=str(exc)
        )

    # -- Temporary directory for all working files --------------------
    with tempfile.TemporaryDirectory(prefix="docproc_") as tmp_dir:
        pdf_path = Path(tmp_dir) / "input.pdf"

        try:
            # 1. Download the PDF from S3
            logger.info("Downloading PDF: s3_key=%s", s3_key)
            await s3_service.download_file(s3_key, pdf_path)

            # 2. Open with PyMuPDF
            doc = fitz.open(str(pdf_path))
            total_pages = doc.page_count
            logger.info(
                "Opened PDF: s3_key=%s, pages=%d", s3_key, total_pages
            )

            all_text_parts: list[str] = []

            # 3. Render each page
            for page_num in range(1, total_pages + 1):
                page = doc[page_num - 1]

                # -- Text extraction (before rendering) ----------------
                page_text = page.get_text("text")
                all_text_parts.append(page_text)

                # -- Render page to WebP --------------------------------
                # zoom = RENDER_DPI / 72 (PyMuPDF default is 72 DPI)
                zoom = RENDER_DPI / 72.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)

                page_path = Path(tmp_dir) / f"page-{page_num}.webp"
                pix.save(str(page_path), "webp", jpg_quality=WEBP_QUALITY)
                # Restrict file permissions (security requirement)
                os.chmod(page_path, 0o600)

                # -- Upload rendered page to S3 ------------------------
                page_key = _page_s3_key(workspace_id, document_id, page_num)
                await s3_service.upload_file(
                    page_path,
                    page_key,
                    content_type="image/webp",
                )

                # Free page pixmap memory
                pix = None  # noqa: F841

                logger.debug(
                    "Rendered & uploaded page %d/%d: %s",
                    page_num,
                    total_pages,
                    page_key,
                )

            doc.close()
            extracted_text = "\n".join(all_text_parts)

            logger.info(
                "Document processed successfully: s3_key=%s, "
                "pages=%d, text_length=%d",
                s3_key,
                total_pages,
                len(extracted_text),
            )

            # -- 4. Chunk text and generate embeddings -----------------
            chunk_count = 0
            if embedding_service and extracted_text.strip():
                chunks = None
                try:
                    logger.info(
                        "Chunking text for embedding generation..."
                    )
                    chunks = chunk_text(extracted_text)
                    chunk_count = len(chunks)
                    logger.info(
                        "Generated %d chunks from %d characters of text",
                        chunk_count,
                        len(extracted_text),
                    )

                    if chunks and job_id:
                        logger.info(
                            "Generating embeddings for %d chunks...",
                            len(chunks),
                        )
                        embeddings = (
                            await embedding_service.generate_embeddings(
                                chunks
                            )
                        )
                        if embeddings:
                            await _send_embeddings_to_backend(
                                job_id, document_id, embeddings
                            )
                        else:
                            logger.warning(
                                "No embeddings generated for document %s",
                                document_id,
                            )
                except Exception as exc:
                    # Embedding failure is FATAL — a document without
                    # embeddings means the AI Assistant cannot answer
                    # questions about it, which breaks the core RAG
                    # value proposition.  Propagate the exception so
                    # the poller reports job FAILED.
                    logger.error(
                        "Embedding generation FAILED for document %s: %s — "
                        "marking job as failed",
                        document_id,
                        exc,
                    )
                    raise EmbeddingError(
                        f"EMBEDDING_GENERATION_FAILED: {exc}"
                    ) from exc
                finally:
                    # Free memory — chunks are no longer needed after
                    # embeddings have been sent (or failed).
                    # extracted_text is NOT deleted here because it's
                    # referenced in the DocumentProcessingResult below.
                    if chunks is not None:
                        del chunks

            return DocumentProcessingResult(
                success=True,
                page_count=total_pages,
                extracted_text=extracted_text,
                chunk_count=chunk_count,
            )

        except Exception as exc:
            logger.exception(
                "Failed to process document: s3_key=%s", s3_key
            )
            return DocumentProcessingResult(
                success=False,
                page_count=0,
                error=str(exc),
            )
        # -- TemporaryDirectory context manager auto-cleans all files --
