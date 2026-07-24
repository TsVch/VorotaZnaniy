"""Health check endpoint for the AI Worker service."""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def check_health() -> dict[str, str]:
    """Return the current status of the AI Worker service."""
    return {"status": "ok", "service": "ai_worker"}
