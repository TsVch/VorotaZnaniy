"""Application configuration via Pydantic Settings.

All environment variables are validated at startup.
Never hardcode secrets or environment-specific values.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ---- Application ----
    app_env: str = "development"
    app_url: str = "http://localhost:3000"
    port: int = 8000

    # ---- Internal API (Backend NestJS for HTTP Bridge) ----
    internal_api_url: str = "http://backend:4000"
    internal_api_key: str = ""

    # ---- PostgreSQL Database ----
    database_url: str = "postgresql://localhost:5432/knowledgevault_dev"

    # ---- S3 / Object Storage (MinIO / R2 / S3) ----
    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region: str = "us-east-1"
    s3_bucket_name: str = "knowledgevault"

    # ---- LLM Provider ----
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    # ---- RAG Pipeline ----
    rag_top_k: int = 5
    rag_max_context_tokens: int = 3000

    # ---- Monitoring ----
    sentry_dsn: str = ""
    sentry_environment: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
