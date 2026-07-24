-- =============================================================================
-- Migration: Add HNSW index on Embedding.embedding for fast semantic search
-- =============================================================================
-- Requires: pgvector extension (CREATE EXTENSION IF NOT EXISTS vector)
--
-- HNSW (Hierarchical Navigable Small World) index is chosen over IVFFlat
-- because:
--   1. It does NOT require periodic rebuilds when new data is added
--   2. It offers better recall at same query speed for MVP-scale data (< 100K)
--   3. It supports vector_cosine_ops distance operator (<=>)
--
-- Trade-off: ~1.5x memory footprint compared to IVFFlat, acceptable for MVP.
-- =============================================================================

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index on the embedding column
--   m = 16:  max number of connections per layer (higher = better recall, more memory)
--   ef_construction = 64:  dynamic candidate list during construction (higher = better recall, slower build)
CREATE INDEX IF NOT EXISTS idx_embedding_vector
    ON "embeddings"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- Rollback:
--   DROP INDEX IF EXISTS idx_embedding_vector;
-- =============================================================================
