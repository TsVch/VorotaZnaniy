import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../shared/utils/s3.service';
import { JobsBridgeService } from '../jobs-bridge/jobs-bridge.service';
import { UploadInitDto } from './dto/upload-init.dto';
import type { ProtectionConfigDto } from './dto/upload-init.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { DocumentAnalyticsDto, RecentSessionDto } from './dto/document-analytics.dto';
import type { SummaryWorkerResponse } from './dto/summary-response.dto';
import type { QaResponseDto, SourceItem } from './dto/qa-response.dto';

/**
 * Default DRM protection configuration.
 * Applied when the client omits protection_config or omits individual fields.
 * Defined as constants per CTO requirement: no hardcoded values inline.
 */
const DEFAULT_PROTECTION_CONFIG: Required<ProtectionConfigDto> = {
  watermark_enabled: true,
  watermark_text: '',
  max_concurrent_sessions: 2,
  allow_text_selection: false,
  allow_download: false,
};

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly jobsBridgeService: JobsBridgeService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initializes a document upload:
   * 1. Validates metadata (handled by DTO + global ValidationPipe)
   * 2. Generates a unique S3 key
   * 3. Creates a presigned PUT URL
   * 4. Persists a Document record with status PROCESSING
   *
   * @param workspaceId - The workspace that owns this document
   * @param dto - Validated upload metadata
   * @returns Document ID and presigned upload URL
   */
  async initUpload(
    workspaceId: string,
    dto: UploadInitDto,
  ): Promise<{
    document_id: string;
    upload_url: string;
    expires_in: number;
  }> {
    const documentId = randomUUID();
    const s3Key = `${workspaceId}/${documentId}/${dto.file_name}`;

    this.logger.log(
      `Initializing upload: workspaceId=${workspaceId}, title="${dto.title}", size=${dto.file_size}`,
    );

    // ── Step 1: Generate presigned URL ─────────────────────────────────────
    const expiresIn =
      this.configService.get<number>('S3_UPLOAD_URL_EXPIRY') ?? 300;

    let uploadUrl: string;
    try {
      uploadUrl = await this.s3Service.generatePresignedUploadUrl(
        s3Key,
        dto.mime_type,
        expiresIn,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        'Could not generate upload URL. Please check S3/MinIO configuration.',
      );
    }

    // ── Step 2: Build protection config (merge defaults with overrides) ────
    const protectionConfig = {
      watermark_enabled:
        dto.protection_config?.watermark_enabled ??
        DEFAULT_PROTECTION_CONFIG.watermark_enabled,
      max_concurrent_sessions:
        dto.protection_config?.max_concurrent_sessions ??
        DEFAULT_PROTECTION_CONFIG.max_concurrent_sessions,
      allow_text_selection:
        dto.protection_config?.allow_text_selection ??
        DEFAULT_PROTECTION_CONFIG.allow_text_selection,
    };

    // ── Step 3: Create Document record with fileName and s3Key ──────────────
    try {
      await this.prisma.document.create({
        data: {
          id: documentId,
          workspaceId,
          title: dto.title,
          fileName: dto.file_name,
          s3Key,
          fileType: 'pdf',
          fileSize: dto.file_size,
          status: 'PROCESSING',
          protectionConfig,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create document record: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        'Could not create document record. Please try again.',
      );
    }

    this.logger.log(
      `Document created: id=${documentId}, status=PROCESSING, s3Key=${s3Key}`,
    );

    return {
      document_id: documentId,
      upload_url: uploadUrl,
      expires_in: expiresIn,
    };
  }

  /**
   * Completes the document upload process:
   * 1. Verifies the document exists and belongs to the workspace
   * 2. Checks that the file physically exists in S3 via HeadObject
   * 3. Dispatches AI processing via JobsBridge (ADR-004)
   *
   * The S3 key is constructed from trusted DB data only — never from
   * user input — to prevent path traversal attacks (Security Requirement).
   *
   * @param documentId - Document UUID from the URL param
   * @param workspaceId - Workspace UUID from the X-Workspace-Id header
   * @returns Success confirmation
   */
  async completeUpload(
    documentId: string,
    workspaceId: string,
  ): Promise<{
    document_id: string;
    status: string;
    message: string;
  }> {
    // ── Step 1: Fetch document from DB ────────────────────────────────────
    let document: {
      id: string;
      workspaceId: string;
      s3Key: string;
      title: string;
      status: string;
    } | null;

    try {
      document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          workspaceId: true,
          s3Key: true,
          title: true,
          status: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Database error fetching document ${documentId}: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        'Could not verify document. Please try again.',
      );
    }

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.workspaceId !== workspaceId) {
      this.logger.warn(
        `Workspace mismatch: document=${documentId} belongs to workspace=${document.workspaceId}, ` +
          `but request was for workspace=${workspaceId}`,
      );
      throw new NotFoundException('Document not found');
    }

    // ── Step 2: Verify file exists in S3 ──────────────────────────────────
    this.logger.log(
      `Verifying S3 object: bucket key=${document.s3Key}`,
    );

    let fileExists: boolean;
    try {
      fileExists = await this.s3Service.checkObjectExists(
        document.s3Key,
      );
    } catch (error) {
      this.logger.error(
        `S3 check failed for document ${documentId}: ${(error as Error).message}`,
      );
      throw new BadRequestException({
        statusCode: 400,
        error: {
          code: 'STORAGE_VERIFICATION_FAILED',
          message:
            'Could not verify file in storage. Please try again.',
        },
      });
    }

    if (!fileExists) {
      this.logger.warn(
        `File not found in S3: documentId=${documentId}, s3Key=${document.s3Key}`,
      );
      throw new BadRequestException({
        statusCode: 400,
        error: {
          code: 'FILE_NOT_FOUND_IN_STORAGE',
          message:
            'File not found in storage. Please re-upload the document.',
        },
      });
    }

    // ── Step 3: Persist AI processing job (ADR-004 Jobs Bridge) ──────────
    await this.jobsBridgeService.dispatchAiProcessing(
      documentId,
      document.s3Key,
    );

    this.logger.log(
      `Upload completed: documentId=${documentId}, title="${document.title}", status=PROCESSING`,
    );

    return {
      document_id: documentId,
      status: 'PROCESSING',
      message: 'Document queued for parsing and AI embedding.',
    };
  }

  // ── Rate Limiting ────────────────────────────────────────────────────

  /**
   * Simple in-memory sliding-window rate limiter.
   * Tracks request timestamps per userId; evicts entries older than the window.
   * For MVP only — replace with Redis in Phase 2.
   */
  private readonly rateLimitMap = new Map<string, number[]>();
  private readonly RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
  private readonly RATE_LIMIT_MAX = 10; // max requests per window

  private checkRateLimit(userId: string): void {
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW_MS;

    let timestamps = this.rateLimitMap.get(userId) ?? [];

    // Evict entries outside the window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    if (timestamps.length >= this.RATE_LIMIT_MAX) {
      this.logger.warn(
        `Rate limit exceeded for user ${userId}: ${timestamps.length} requests in last minute`,
      );
      throw new HttpException(
        'Rate limit exceeded: max 10 requests per minute',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    this.rateLimitMap.set(userId, timestamps);
  }

  // ── Q&A (RAG) ────────────────────────────────────────────────────────

  /**
   * Answers a question about a document using the full RAG pipeline:
   * 1. Verifies user has an active AccessGrant for the document
   * 2. Rate-limits requests (10/min per user)
   * 3. Calls the AI Worker Q&A endpoint
   * 4. Logs usage to AiUsageLog
   *
   * @param documentId - Document UUID
   * @param userId - Authenticated user UUID
   * @param question - Free-text question (3–500 chars)
   * @returns Structured answer with source citations
   */
  async askQuestion(
    documentId: string,
    userId: string,
    question: string,
  ): Promise<QaResponseDto> {
    // ── Step 1: Verify AccessGrant ──────────────────────────────────────
    let accessGrant: { isActive: boolean; expiresAt: Date | null } | null;
    try {
      accessGrant = await this.prisma.accessGrant.findUnique({
        where: { userId_documentId: { userId, documentId } },
        select: { isActive: true, expiresAt: true },
      });
    } catch (error) {
      this.logger.error(
        `DB error checking access: userId=${userId}, documentId=${documentId}: ${(error as Error).message}`,
      );
      throw new BadRequestException('Could not verify document access');
    }

    if (!accessGrant || !accessGrant.isActive) {
      throw new ForbiddenException('Access denied to this document');
    }

    if (
      accessGrant.expiresAt &&
      new Date() > accessGrant.expiresAt
    ) {
      throw new ForbiddenException('Document access has expired');
    }

    // ── Step 2: Rate limit ──────────────────────────────────────────────
    this.checkRateLimit(userId);

    // ── Step 3: Call AI Worker Q&A endpoint ─────────────────────────────
    const aiWorkerUrl =
      this.configService.get<string>('AI_WORKER_URL') ??
      'http://localhost:8000';
    const internalApiKey =
      this.configService.get<string>('INTERNAL_API_KEY') ?? '';

    let workerResult: { answer: string; sources: SourceItem[] };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(
        `${aiWorkerUrl}/internal/ai/qa`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-API-Key': internalApiKey,
          },
          body: JSON.stringify({ documentId, question }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new HttpException(
          'AI service is currently overloaded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (!response.ok) {
        this.logger.warn(
          `AI Worker returned ${response.status} for QA: documentId=${documentId}`,
        );
        throw new BadRequestException(
          'AI service temporarily unavailable',
        );
      }

      workerResult = (await response.json()) as {
        answer: string;
        sources: SourceItem[];
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `AI Worker QA call failed for document ${documentId}: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        'AI service temporarily unavailable',
      );
    }

    // ── Step 4: Log usage to AiUsageLog ─────────────────────────────────
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          documentId,
          queryType: 'qa',
          tokensUsed: 0, // Estimate only — will be refined in Phase 2
          cost: 0,
        },
      });
    } catch (error) {
      // Non-fatal: log failure but don't break user experience
      this.logger.error(
        `Failed to log AI usage: userId=${userId}, documentId=${documentId}: ${(error as Error).message}`,
      );
    }

    return workerResult;
  }

  // ── List Documents (with pagination & filters) ─────────────────────

  /**
   * Returns a paginated list of documents for the authenticated user.
   * Resolves the user's default workspace, then lists documents within it.
   * Supports optional status filter and case-insensitive title search.
   * Results are ordered by most recently created first.
   *
   * @param userId - Authenticated user ID (from JWT)
   * @param query - Pagination, filter, and search params
   * @returns Paginated document list matching the frontend's DocumentListResponse shape
   */
  async findAll(
    userId: string,
    query: QueryDocumentsDto,
  ): Promise<{
    documents: Array<{
      id: string;
      title: string;
      status: string;
      fileSize: number;
      pageCount: number | null;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    // ── Step 1: Resolve user's default workspace ──────────────────────────
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultWorkspaceId: true },
    });

    const workspaceId = user?.defaultWorkspaceId;
    if (!workspaceId) {
      throw new NotFoundException('No workspace found for user');
    }

    // ── Step 2: Build query ────────────────────────────────────────────────
    const { page = 1, limit = 10, status, search } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { workspaceId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // ── Step 3: Fetch documents + total count in parallel ───────────────────
    try {
      const [documents, total] = await Promise.all([
        this.prisma.document.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            fileSize: true,
            createdAt: true,
          },
        }),
        this.prisma.document.count({ where }),
      ]);

      // Enrich with pageCount from latest DocumentVersion
      const enriched = await Promise.all(
        documents.map(async (doc) => {
          const latestVersion = await this.prisma.documentVersion.findFirst({
            where: { documentId: doc.id },
            orderBy: { versionNumber: 'desc' },
            select: { pageCount: true },
          });
          return {
            ...doc,
            pageCount: latestVersion?.pageCount ?? null,
          };
        }),
      );

      return {
        documents: enriched,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(
        `Failed to list documents for user ${userId} (workspace ${workspaceId}): ${(error as Error).message}`,
      );
      throw new BadRequestException('Could not fetch documents');
    }
  }

  // ── Get Single Document ────────────────────────────────────────────

  /**
   * Fetches a single document by ID.
   * Returns null if not found.
   */
  async getDocument(documentId: string): Promise<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    fileSize: number;
    pageCount: number | null;
    fileType: string;
    fileName: string;
    protectionConfig: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      const doc = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          fileSize: true,
          fileType: true,
          fileName: true,
          protectionConfig: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!doc) return null;

      // Derive pageCount from the last DocumentVersion (if any)
      const latestVersion = await this.prisma.documentVersion.findFirst({
        where: { documentId },
        orderBy: { versionNumber: 'desc' },
        select: { pageCount: true },
      });

      return {
        ...doc,
        protectionConfig: doc.protectionConfig as Record<string, unknown>,
        pageCount: latestVersion?.pageCount ?? null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch document ${documentId}: ${(error as Error).message}`,
      );
      throw new BadRequestException('Could not fetch document details');
    }
  }

  // ── Update Document ─────────────────────────────────────────────────

  /**
   * Updates document metadata and/or DRM protection settings.
   * Only the provided fields are updated (partial/PATCH semantics).
   * Critical fields (id, workspaceId, s3Key, status, fileSize) cannot be changed.
   *
   * @param documentId - Document UUID
   * @param dto - Fields to update (all optional)
   * @returns Updated document
   */
  async updateDocument(
    documentId: string,
    dto: UpdateDocumentDto,
  ): Promise<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    fileSize: number;
    protectionConfig: Record<string, unknown>;
    updatedAt: Date;
  }> {
    // Build the update payload — only include provided fields
    const updateData: Record<string, unknown> = {};

    if (dto.title !== undefined) {
      updateData.title = dto.title;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.protection_config !== undefined) {
      // MVP restriction: reject allow_download: true
      if (dto.protection_config.allow_download === true) {
        throw new BadRequestException(
          'Downloads are not supported in MVP.',
        );
      }

      // Defense in Depth: reject empty watermark_text when watermark is enabled
      if (
        dto.protection_config.watermark_enabled === true &&
        !dto.protection_config.watermark_text
      ) {
        throw new BadRequestException(
          'Watermark text is required when watermark is enabled.',
        );
      }

      // Fetch current config to merge (not replace)
      const current = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: { protectionConfig: true },
      });

      const currentConfig = current?.protectionConfig as Record<string, unknown> ?? {};

      updateData.protectionConfig = {
        ...currentConfig,
        ...Object.fromEntries(
          Object.entries(dto.protection_config).filter(
            ([, v]) => v !== undefined,
          ),
        ),
      };
    }

    try {
      const updated = await this.prisma.document.update({
        where: { id: documentId },
        data: updateData,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          fileSize: true,
          protectionConfig: true,
          updatedAt: true,
        },
      });

      this.logger.log(
        `Document updated: id=${documentId}, fields=${Object.keys(updateData).join(',')}`,
      );

      return {
        ...updated,
        protectionConfig: updated.protectionConfig as Record<string, unknown>,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Record<string, unknown>).code === 'P2025'
      ) {
        throw new NotFoundException('Document not found');
      }
      this.logger.error(
        `Failed to update document ${documentId}: ${(error as Error).message}`,
      );
      throw new BadRequestException('Could not update document');
    }
  }

  // ── Document Analytics ────────────────────────────────────────────────

  /**
   * Returns aggregated analytics for a document:
   * - Total viewing sessions
   * - Unique viewers (distinct userIds)
   * - Total AI queries
   * - Last 5 recent sessions
   */
  async getDocumentAnalytics(
    documentId: string,
  ): Promise<DocumentAnalyticsDto> {
    let totalViews = 0;
    let uniqueViewers = 0;
    let aiQueries = 0;
    let recentSessions: RecentSessionDto[] = [];

    try {
      totalViews = await this.prisma.session.count({
        where: { documentId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to count sessions for ${documentId}: ${(error as Error).message}`,
      );
    }

    try {
      // Count distinct userIds from sessions
      const distinctUsers = await this.prisma.session.groupBy({
        by: ['userId'],
        where: { documentId },
        _count: { userId: true },
      });
      uniqueViewers = distinctUsers.length;
    } catch (error) {
      this.logger.error(
        `Failed to count unique viewers for ${documentId}: ${(error as Error).message}`,
      );
    }

    try {
      aiQueries = await this.prisma.aiUsageLog.count({
        where: { documentId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to count AI queries for ${documentId}: ${(error as Error).message}`,
      );
    }

    try {
      const sessions = await this.prisma.session.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          isActive: true,
        },
      });
      recentSessions = sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        isActive: s.isActive,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to fetch recent sessions for ${documentId}: ${(error as Error).message}`,
      );
    }

    return {
      totalViews,
      uniqueViewers,
      aiQueries,
      recentSessions,
    };
  }

  // ── Summary Generation ────────────────────────────────────────────────

  /**
   * Generates an AI summary for the given document and persists it.
   *
   * Fetches the first 5 chunks from the Embedding table, sends them to
   * the AI Worker via an internal HTTP call, and saves the returned
   * summary in the Document.summary field.
   *
   * If the document has no chunks, the AI Worker is unreachable, or the
   * generation fails — the method logs the error and returns null (non-
   * fatal, per AC-3).
   *
   * @param documentId - UUID of the document to summarise
   * @returns The generated summary text, or null on failure / no chunks
   */
  async generateAndSaveSummary(
    documentId: string,
  ): Promise<string | null> {
    // ── Step 1: Fetch first 5 chunks ──────────────────────────────────
    let chunks: { chunkText: string }[];
    try {
      chunks = await this.prisma.embedding.findMany({
        where: { documentId },
        orderBy: { chunkIndex: 'asc' },
        take: 5,
        select: { chunkText: true },
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch chunks for summary: documentId=${documentId}, ${(error as Error).message}`,
      );
      return null;
    }

    if (chunks.length === 0) {
      this.logger.warn(
        `No chunks found for document ${documentId} — cannot generate summary`,
      );
      return null;
    }

    // ── Step 2: Join chunks and truncate ───────────────────────────────
    const combinedText = chunks.map((c) => c.chunkText).join('\n\n');
    // Safety truncation: max 4000 chars (~1000 tokens) for the LLM call
    const truncatedText =
      combinedText.length > 4000
        ? combinedText.slice(0, 4000)
        : combinedText;

    this.logger.log(
      `Generating summary for document ${documentId}: ` +
        `${chunks.length} chunks, ${truncatedText.length} chars`,
    );

    // ── Step 3: Call AI Worker ────────────────────────────────────────
    const aiWorkerUrl =
      this.configService.get<string>('AI_WORKER_URL') ??
      'http://localhost:8000';
    const internalApiKey =
      this.configService.get<string>('INTERNAL_API_KEY') ?? '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(
        `${aiWorkerUrl}/internal/ai/summary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-API-Key': internalApiKey,
          },
          body: JSON.stringify({ text: truncatedText }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(
          `AI Worker returned ${response.status} for document ${documentId}`,
        );
        return null;
      }

      const workerResponse =
        (await response.json()) as SummaryWorkerResponse;

      if (!workerResponse.summary) {
        this.logger.warn(
          `AI Worker returned empty summary for document ${documentId}`,
        );
        return null;
      }

      // ── Step 4: Persist summary ────────────────────────────────────
      await this.prisma.document.update({
        where: { id: documentId },
        data: { summary: workerResponse.summary },
      });

      this.logger.log(
        `Summary saved for document ${documentId}: ${workerResponse.summary.length} chars`,
      );

      return workerResponse.summary;
    } catch (error) {
      // Timeout or network error — non-fatal
      this.logger.error(
        `Failed to generate summary for document ${documentId}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
