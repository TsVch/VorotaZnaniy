-- =============================================================================
-- KnowledgeVault SaaS — PostgreSQL Initialization Script
-- =============================================================================
-- Runs once on first database creation (mounted at /docker-entrypoint-initdb.d/)
-- Enables the pgvector extension for vector similarity search (RAG pipeline).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension was created
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
