// =============================================================================
// KnowledgeVault SaaS — Enable pgvector Extension for PostgreSQL
// =============================================================================
// This script enables the pgvector extension required for vector similarity
// search in the embeddings table (AI RAG functionality).
//
// Usage: node enable-pgvector.js
//
// Must be run BEFORE prisma migrate / db push so that the vector type exists.
// Safe to run multiple times (idempotent — uses IF NOT EXISTS).
// =============================================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function enableVectorExtension() {
  try {
    console.log('🔄 Enabling pgvector extension...');

    // Enable the vector extension if it doesn't exist (idempotent)
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');

    console.log('✅ pgvector extension enabled successfully!');

    // Verify the extension is active
    const result = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) AS vector_enabled;
    `);

    const vectorEnabled = Array.isArray(result) && result[0]?.vector_enabled;
    if (vectorEnabled) {
      console.log('✅ Verified: vector extension is active');
    } else {
      console.warn('⚠️  Warning: vector extension may not be active — check database permissions');
    }
  } catch (error) {
    console.error('❌ Failed to enable pgvector:', error.message);
    console.error('   Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

enableVectorExtension();
