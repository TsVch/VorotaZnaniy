"""Internal authentication utilities for the AI Worker.

Uses ``X-Internal-API-Key`` header for consistency with the ADR-004 pattern
used by NestJS InternalApiKeyGuard and the AI Worker's httpx client.
"""

from fastapi import Header, HTTPException, status

from app.core.config import settings


async def require_internal_api_key(
    x_internal_api_key: str | None = Header(None, alias="X-Internal-API-Key"),
) -> None:
    """Dependency that validates the internal API key.

    Checks the ``X-Internal-API-Key`` header for the expected
    ``INTERNAL_API_KEY`` value.  This is the standardised ADR-004 pattern.

    Usage::

        @router.post(\"/internal/ai/summary\")
        async def summary_endpoint(
            _: None = Depends(require_internal_api_key),
            body: SummaryRequest = ...,
        ) -> ...: ...

    Raises:
        HTTPException(401) if the key is missing or invalid.
    """
    if x_internal_api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Internal-API-Key header",
        )

    if x_internal_api_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )
