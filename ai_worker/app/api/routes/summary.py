"""Summary generation endpoint — POST /internal/ai/summary.

Uses OpenAI gpt-4o-mini to generate a concise, structured summary
(max 300 words) from document text chunks.
"""

import logging
from typing import Any

from openai import AsyncOpenAI, APIError
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import require_internal_api_key
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/internal/ai",
    tags=["AI Internal"],
    dependencies=[Depends(require_internal_api_key)],
)

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class SummaryRequest(BaseModel):
    """Request payload for summary generation."""

    text: str = Field(
        ...,
        max_length=4000,
        description="Document text to summarise (max 4000 chars, ~1000 tokens).",
    )


class SummaryResponse(BaseModel):
    """Response payload containing the generated summary."""

    summary: str = Field(
        ...,
        description="Generated summary text (max ~300 words).",
    )


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are a helpful assistant that summarises documents. "
    "Summarise the following text in the same language as the text. "
    "Keep the summary concise (max 300 words). "
    "Use bullet points for key takeaways where appropriate."
)

# ---------------------------------------------------------------------------
# OpenAI client (lazy singleton)
# ---------------------------------------------------------------------------

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    """Lazy-initialise the OpenAI client."""
    global _client  # noqa: PLW0603
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/summary",
    response_model=SummaryResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_summary(
    request: SummaryRequest,
) -> dict[str, str]:
    """Generate a concise summary from the provided document text.

    Uses ``gpt-4o-mini`` for fast, cost-effective generation.
    The text is expected to be the first ~5 chunks of a document.
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text must not be empty",
        )

    # Truncate to a safe token limit (~1000 tokens, ~4000 chars)
    if len(text) > 4000:
        logger.warning(
            "Truncating input text from %d to 4000 chars",
            len(text),
        )
        text = text[:4000]

    logger.info(
        "Generating summary for %d characters of text",
        len(text),
    )

    try:
        client = _get_client()
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            max_tokens=500,
            temperature=0.3,
        )
    except APIError as exc:
        logger.error("OpenAI API error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {exc.message}",
        ) from exc
    except RuntimeError as exc:
        logger.error("Configuration error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    summary = response.choices[0].message.content or ""
    summary = summary.strip()

    if not summary:
        logger.warning("OpenAI returned empty summary")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service returned empty response",
        )

    logger.info("Summary generated: %d characters", len(summary))
    return {"summary": summary}


async def close_client() -> None:
    """Close the OpenAI client (call on shutdown)."""
    global _client  # noqa: PLW0603
    if _client is not None:
        await _client.close()
        _client = None
