import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connection established.');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database connection closed.');
  }

  /**
   * Static helper that builds a raw SQL INSERT for a pgvector embedding.
   *
   * The Embedding.embedding column uses Unsupported("vector(1536)"), which
   * Prisma cannot handle via the standard create() method, so we use
   * parameterised raw SQL with ON CONFLICT upsert for idempotency.
   *
   * @param documentId - UUID of the parent document
   * @param chunkIndex - Ordinal index within the document's chunks
   * @param chunkText - The text content of this chunk
   * @param embedding - Float array of length 1536
   * @returns A raw SQL query string suitable for $executeRawUnsafe
   */
  static rawInsertEmbedding(
    documentId: string,
    chunkIndex: number,
    chunkText: string,
    embedding: number[],
  ): string {
    // pgvector expects the vector as a string: '[0.1, 0.2, ...]'
    const vectorStr = `[${embedding.join(',')}]`;
    // Escape single quotes in chunk text to prevent SQL injection
    const escapedText = chunkText.replace(/'/g, "''");

    return `
      INSERT INTO "embeddings" ("id", "documentId", "chunkIndex", "chunkText", "embedding", "createdAt")
      VALUES (
        gen_random_uuid(),
        '${documentId}',
        ${chunkIndex},
        '${escapedText}',
        '${vectorStr}'::vector,
        NOW()
      )
      ON CONFLICT ("documentId", "chunkIndex")
      DO UPDATE SET
        "chunkText" = EXCLUDED."chunkText",
        "embedding" = EXCLUDED."embedding",
        "createdAt" = NOW();
    `.trim();
  }
}
