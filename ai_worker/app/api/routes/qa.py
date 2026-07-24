"""Q&A RAG endpoint — POST /internal/ai/qa.

Fully implements the Retrieval-Augmented Generation pipeline:
1. Receives documentId + question from NestJS
2. Generates question embedding via text-embedding-3-small
3. Retrieves top-K chunks via NestJS semantic search
4. Builds a prompt with context and calls gpt-4o-mini
5. Parses [N] citations and returns structured answer + sources
"""

import logging
from typing import Any

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.core.auth import require_internal_api_key
from app.core.config import settings
from app.rag.generator import generate_answer
from app.rag.retriever import Retriever
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/internal/ai",
    tags=["AI Internal"],
    dependencies=[Depends(require_internal_api_key)],
)

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class QaRequest(BaseModel):
    """Request payload for the Q&A endpoint."""

    documentId: str = Field(
        ...,
        description="UUID of the document to ask about.",
    )
    question: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="Free-text question (3–500 chars).",
    )


class SourceItem(BaseModel):
    """A single source chunk cited in the answer."""

    chunkIndex: int = Field(..., description="Index of the chunk in the document")
    text: str = Field(..., description="The chunk text content")


class QaResponse(BaseModel):
    """Response payload containing the AI-generated answer and sources."""

    answer: str = Field(
        ...,
        description="Generated answer with optional [N] citation markers.",
    )
    sources: list[SourceItem] = Field(
        default_factory=list,
        description="Cited source chunks referenced in the answer.",
    )


# ---------------------------------------------------------------------------
# Singleton services (lazy)
# ---------------------------------------------------------------------------

_retriever: Retriever | None = None
_embedding_service: EmbeddingService | None = None


def _get_retriever() -> Retriever:
    """Lazy-initialise the retriever."""
    global _retriever  # noqa: PLW0603
    if _retriever is None:
        _retriever = Retriever()
    return _retriever


def _get_embedding_service() -> EmbeddingService:
    """Lazy-initialise the embedding service."""
    global _embedding_service  # noqa: PLW0603
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/qa",
    response_model=QaResponse,
    status_code=status.HTTP_200_OK,
)
async def qa_rag(
    request: QaRequest,
) -> dict[str, Any]:
    """Full RAG pipeline: embed → retrieve → generate.

    1. Generates a 1536-dim embedding for the question.
    2. Retrieves top-5 relevant chunks via semantic search.
    3. Builds a prompt with the context chunks.
    4. Calls gpt-4o-mini to generate an answer with citations.
    5. Parses [N] markers and returns structured result.
    """
    question = request.question.strip()
    document_id = request.documentId

    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question must not be empty",
        )

    logger.info(
        "Q&A RAG: documentId=%s, question_len=%d",
        document_id,
        len(question),
    )

    # ── Step 1: Generate question embedding ────────────────────────────
    embedding_service = _get_embedding_service()
    try:
        embedding_results = await embedding_service.generate_embeddings(
            [question]
        )
    except Exception as exc:
        logger.error(
            "Failed to generate question embedding: %s",
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate question embedding",
        ) from exc

    if not embedding_results:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Empty embedding response from AI service",
        )

    query_embedding: list[float] = embedding_results[0]["embedding"]

    # ── Step 2: Semantic search ────────────────────────────────────────
    top_k = getattr(settings, "rag_top_k", 5)
    retriever = _get_retriever()
    try:
        search_results = await retriever.retrieve(
            document_id, query_embedding, top_k=top_k
        )
    except Exception as exc:
        logger.error("Semantic search failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Semantic search failed",
        ) from exc

    if not search_results:
        return {
            "answer": "I don't have enough information to answer this question.",
            "sources": [],
        }

    # Convert to context items for the generator
    context_items = [
        {
            "chunk_index": r.chunk_index,
            "chunk_text": r.text,
            "similarity": r.similarity,
        }
        for r in search_results
    ]

    # ── Step 3: Generate answer ────────────────────────────────────────
    try:
        result = await generate_answer(question, context_items)
    except Exception as exc:
        logger.error("Answer generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Answer generation failed",
        ) from exc

    return result


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------


async def close_qa_services() -> None:
    """Close all QA services (call on shutdown)."""
    global _retriever, _embedding_service  # noqa: PLW0603
    if _retriever is not None:
        await _retriever.close()
        _retriever = None
    if _embedding_service is not None:
        await _embedding_service.close()
        _embedding_service = None
