"""KnowledgeVault SaaS — AI Worker Service Entry Point.

FastAPI application for document processing, RAG queries,
and AI-powered features.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.qa import router as qa_router
from app.api.routes.qa import close_qa_services
from app.api.routes.summary import router as summary_router
from app.api.routes.summary import close_client as close_summary_client
from app.core.config import settings
from app.jobs.poller import JobPoller
from app.services.embedding_service import EmbeddingService
from app.services.s3_service import S3Service

# ---- Logging Configuration ----
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

# ---- Global singletons ----
s3_service = S3Service()
embedding_service = EmbeddingService()
poller = JobPoller(s3_service, embedding_service=embedding_service)


@asynccontextmanager
async def lifespan(app: FastAPI) -> None:  # noqa: ARG001
    """Application lifespan handler for startup and shutdown events."""
    logger.info("AI Worker service starting...")
    logger.info("Environment: %s", settings.app_env)

    # Start the ADR-004 HTTP Bridge poller
    await poller.start()
    logger.info("JobPoller background task started")

    yield

    logger.info("AI Worker service shutting down...")
    await poller.stop()
    logger.info("JobPoller stopped gracefully")


app = FastAPI(
    title="KnowledgeVault SaaS — AI Worker",
    description="Isolated AI & Document Processing Service",
    version="0.1.0",
    lifespan=lifespan,
)

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.app_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
# Health check endpoint (no version prefix per Task Package)
app.include_router(health_router)

# Internal AI endpoints (summary generation, Q&A RAG, protected by X-Internal-API-Key)
app.include_router(summary_router)
app.include_router(qa_router)
