import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EmbeddingItemDto } from './dto/save-embeddings.dto';
import type { SearchResultItem } from './dto/semantic-search.dto';

/**
 * JobsBridgeService — job persistence layer for the ADR-004 HTTP Bridge.
 *
 * Instead of making direct HTTP calls to the AI Worker, this service
 * persists processing jobs to the `pending_jobs` table. The AI Worker
 * polls GET /internal/jobs/pending to discover and claim pending jobs.
 */
@Injectable()
export class JobsBridgeService {
  private readonly logger = new Logger(JobsBridgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dispatches an AI processing job by persisting it to the pending_jobs table.
   *
   * @param documentId - Document UUID to process
   * @param s3Key - S3 object key for the uploaded file
   */
  async dispatchAiProcessing(
    documentId: string,
    s3Key: string,
  ): Promise<{ jobId: string }> {
    const payload = {
      document_id: documentId,
      s3_key: s3Key,
    };

    this.logger.log(
      `Dispatching AI processing job: documentId=${documentId}, s3Key=${s3Key}`,
    );

    try {
      const job = await this.prisma.pendingJob.create({
        data: {
          jobType: 'ai_processing',
          payload,
          status: 'PENDING',
        },
      });

      this.logger.log(
        `AI processing job created: jobId=${job.id}, documentId=${documentId}`,
      );

      return { jobId: job.id };
    } catch (error) {
      this.logger.error(
        `Failed to persist AI processing job for document ${documentId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Retrieves pending AI processing jobs for the AI Worker to claim.
   * Returns the oldest pending jobs first (FIFO order).
   *
   * @param limit - Maximum number of jobs to return (default 10)
   * @returns Array of pending jobs
   */
  async getPendingAiJobs(
    limit = 10,
  ): Promise<
    {
      id: string;
      jobType: string;
      payload: Record<string, unknown>;
      createdAt: Date;
    }[]
  > {
    const jobs = await this.prisma.pendingJob.findMany({
      where: {
        jobType: 'ai_processing',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        jobType: true,
        payload: true,
        createdAt: true,
      },
    });

    return jobs.map((job) => ({
      id: job.id,
      jobType: job.jobType,
      payload: job.payload as Record<string, unknown>,
      createdAt: job.createdAt,
    }));
  }

  /**
   * Marks a job as COMPLETED and updates its result data.
   * Called by the AI Worker via POST /internal/jobs/:id/result.
   */
  async markJobCompleted(
    id: string,
    result: {
      page_count: number;
      extracted_text: string;
      status: string;
    },
  ): Promise<void> {
    this.logger.log(`Marking job ${id} as COMPLETED`);

    // Read existing payload to preserve original metadata (document_id, s3_key)
    const existing = await this.prisma.pendingJob.findUnique({
      where: { id },
      select: { payload: true },
    });

    await this.prisma.pendingJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        payload: {
          ...(existing?.payload as Record<string, unknown> ?? {}),
          page_count: result.page_count,
          extracted_text: result.extracted_text,
          status: result.status,
        },
      },
    });

    this.logger.log(
      `Job ${id} completed: page_count=${result.page_count}, status=${result.status}`,
    );
  }

  /**
   * Marks a job as FAILED with an error description.
   * Called by the AI Worker via POST /internal/jobs/:id/failure.
   */
  async markJobFailed(
    id: string,
    error: string,
  ): Promise<void> {
    this.logger.warn(`Marking job ${id} as FAILED: ${error}`);

    // Read existing payload to preserve original metadata
    const existing = await this.prisma.pendingJob.findUnique({
      where: { id },
      select: { payload: true },
    });

    await this.prisma.pendingJob.update({
      where: { id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        payload: {
          ...(existing?.payload as Record<string, unknown> ?? {}),
          error,
        },
      },
    });
  }

  /**
   * Batch-saves embeddings for a document using raw SQL (pgvector).
   *
   * The Embedding.embedding column has Prisma type Unsupported("vector(1536)"),
   * so we must use $executeRawUnsafe to insert the vector value.
   * The operation is wrapped in a Prisma $transaction for atomicity.
   *
   * Uses ON CONFLICT (document_id, chunk_index) DO UPDATE for idempotency,
   * per the @@unique([documentId, chunkIndex]) constraint.
   */
  async saveEmbeddings(
    jobId: string,
    documentId: string,
    items: EmbeddingItemDto[],
  ): Promise<number> {
    this.logger.log(
      `Saving ${items.length} embeddings for job ${jobId}, document ${documentId}`,
    );

    // Build Prisma raw queries from embedding data.
    // pgvector expects the vector as a string literal: '[0.1, 0.2, ...]'
    // Each item is wrapped in $executeRawUnsafe to produce a PrismaPromise,
    // which is required by Prisma's $transaction API.
    const queries = items.map(
      (item) =>
        this.prisma.$executeRawUnsafe(
          PrismaService.rawInsertEmbedding(
            documentId,
            item.chunkIndex,
            item.chunkText,
            item.embedding,
          ),
        ),
    );

    // Execute all inserts in a single transaction for atomicity.
    await this.prisma.$transaction(queries);

    this.logger.log(
      `Successfully saved ${items.length} embeddings for document ${documentId}`,
    );

    return items.length;
  }

  /**
   * Performs a semantic (vector similarity) search for the top-K most
   * relevant chunks of a document, using pgvector's cosine distance.
   *
   * Uses raw SQL ($queryRawUnsafe) because Prisma's type-safe client
   * does not natively support the <=> (cosine distance) operator.
   *
   * @param documentId - UUID of the document to search within
   * @param queryEmbedding - 1536-dimensional query vector
   * @param topK - Number of results to return (1–20)
   * @returns Array of SearchResultItem sorted by similarity descending
   */
  async semanticSearch(
    documentId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<SearchResultItem[]> {
    this.logger.log(
      `Semantic search: documentId=${documentId}, topK=${topK}`,
    );

    // pgvector expects the vector as a string literal: '[0.1, 0.2, ...]'
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const query = `
      SELECT "chunkIndex" AS "chunkIndex",
             "chunkText" AS "chunkText",
             1 - (embedding <=> $1::vector) AS "similarity"
      FROM "embeddings"
      WHERE "documentId" = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3;
    `;

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ chunkIndex: number; chunkText: string; similarity: number }>
      >(query, vectorStr, documentId, topK);

      this.logger.log(
        `Semantic search returned ${rows.length} results for document ${documentId}`,
      );

      return rows.map((row) => ({
        chunkIndex: row.chunkIndex,
        chunkText: row.chunkText,
        similarity: row.similarity,
      }));
    } catch (error) {
      this.logger.error(
        `Semantic search failed for document ${documentId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
