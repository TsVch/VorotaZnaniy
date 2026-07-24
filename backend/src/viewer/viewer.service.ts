import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../shared/utils/s3.service';
import { WatermarkService } from '../access/services/watermark.service';
import { AccessService } from '../access/services/access.service';
import type { WatermarkPayload } from '../access/services/watermark.service';

/**
 * Five minutes in milliseconds.
 * Sessions with lastActivity older than this are considered inactive
 * and do not count toward the concurrent session limit.
 */
const SESSION_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;



/**
 * Response shape for POST /v1/viewer/sessions/:sessionId/heartbeat,
 * strictly matching Security_Requirements.md §2.3 "Session Heartbeat".
 */
export interface HeartbeatResponse {
  valid: boolean;
  nextHeartbeatIn?: number;
  reason?: string;
}

/**
 * Response shape for POST /v1/viewer/sessions,
 * strictly matching API_Contracts.md §3 "Secure Viewer".
 */
export interface CreateSessionResponse {
  session_id: string;
  document: {
    id: string;
    title: string;
    page_count: number | null;
    protection_config: Record<string, unknown>;
  };
  watermark_data: WatermarkPayload;
}

/**
 * Response shape for GET /v1/viewer/sessions/:sessionId/pages/:pageNumber.
 */
export interface PageUrlResponse {
  url: string;
  expires_in: number;
}

@Injectable()
export class ViewerService {
  private readonly logger = new Logger(ViewerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly watermarkService: WatermarkService,
    private readonly accessService: AccessService,
  ) {}

  /**
   * Initializes a secure viewing session.
   *
   * 1. Validates the user has an active, non-expired AccessGrant
   * 2. Checks concurrent session limits from document's protectionConfig
   * 3. Creates a new Session record
   * 4. Generates watermark data for the frontend
   *
   * @param userId - Authenticated user's UUID (from JWT sub)
   * @param userEmail - Authenticated user's email (from JWT)
   * @param documentId - Target document UUID
   * @param deviceInfo - Optional device information
   * @returns Session response with document metadata and watermark data
   */
  async createSession(
    userId: string,
    userEmail: string,
    documentId: string,
    deviceInfo?: {
      deviceFingerprint?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<CreateSessionResponse> {
    // ── Step 1: Fetch document with its protection config ───────────────────
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        status: true,
        protectionConfig: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Only allow viewing documents that are READY or PROCESSING
    if (document.status !== 'READY' && document.status !== 'PROCESSING') {
      throw new ForbiddenException({
        statusCode: 403,
        error: {
          code: 'DOCUMENT_NOT_AVAILABLE',
          message: 'Document is not available for viewing.',
        },
      });
    }

    // ── Step 2: Verify AccessGrant ─────────────────────────────────────────
    const grant = await this.prisma.accessGrant.findUnique({
      where: {
        userId_documentId: {
          userId,
          documentId,
        },
      },
    });

    if (!grant) {
      throw new ForbiddenException({
        statusCode: 403,
        error: {
          code: 'ACCESS_DENIED',
          message:
            'You do not have access to this document.',
        },
      });
    }

    if (!grant.isActive) {
      throw new ForbiddenException({
        statusCode: 403,
        error: {
          code: 'ACCESS_DENIED',
          message:
            'Your access to this document has been revoked.',
        },
      });
    }

    if (grant.expiresAt && grant.expiresAt < new Date()) {
      throw new ForbiddenException({
        statusCode: 403,
        error: {
          code: 'ACCESS_DENIED',
          message:
            'Your access to this document has expired.',
        },
      });
    }

    // ── Step 3: Parse protection config with safe defaults ─────────────────
    const protectionConfig =
      (document.protectionConfig as Record<string, unknown>) ?? {};

    const maxConcurrentSessions =
      (protectionConfig.max_concurrent_sessions as number) ?? 2;

    // ── Step 4: Count active sessions ──────────────────────────────────────
    const activeThreshold = new Date(
      Date.now() - SESSION_ACTIVITY_WINDOW_MS,
    );

    const activeSessionCount =
      await this.prisma.session.count({
        where: {
          userId,
          documentId,
          isActive: true,
          lastActivity: { gte: activeThreshold },
        },
      });

    this.logger.log(
      `Session check: userId=${userId}, documentId=${documentId}, ` +
        `activeSessions=${activeSessionCount}, maxAllowed=${maxConcurrentSessions}`,
    );

    if (activeSessionCount >= maxConcurrentSessions) {
      this.logger.warn(
        `Session limit exceeded: userId=${userId}, documentId=${documentId}, ` +
          `activeSessions=${activeSessionCount}, maxAllowed=${maxConcurrentSessions}`,
      );

      // ── Terminate the oldest session instead of rejecting ────────────
      const newDeviceDesc =
        deviceInfo?.userAgent ?? deviceInfo?.deviceFingerprint ?? 'Unknown device';

      const terminatedId = await this.accessService.terminateOldestSession(
        userId,
        documentId,
        newDeviceDesc,
      );

      if (!terminatedId) {
        // No session to terminate — still reject
        throw new ForbiddenException({
          statusCode: 403,
          error: {
            code: 'CONCURRENT_SESSION_LIMIT',
            message:
              'You have reached the maximum number of active devices for this document.',
            details: {
              max_sessions: maxConcurrentSessions,
              active_sessions: activeSessionCount,
            },
          },
        });
      }

      this.logger.log(
        `Oldest session terminated (${terminatedId}) to make room for new session: userId=${userId}, documentId=${documentId}`,
      );
    }

    // ── Step 5: Create session ─────────────────────────────────────────────
    const session = await this.prisma.session.create({
      data: {
        userId,
        documentId,
        deviceFingerprint: deviceInfo?.deviceFingerprint ?? null,
        ipAddress: deviceInfo?.ipAddress ?? null,
        userAgent: deviceInfo?.userAgent ?? null,
        isActive: true,
        lastActivity: new Date(),
      },
    });

    this.logger.log(
      `Session created: sessionId=${session.id}, userId=${userId}, documentId=${documentId}`,
    );

    // ── Step 6: Generate watermark data ────────────────────────────────────
    const watermarkData =
      this.watermarkService.generateWatermarkPayload(
        userEmail,
        session.id,
      );

    // ── Step 7: Return formatted response ──────────────────────────────────
    return {
      session_id: session.id,
      document: {
        id: document.id,
        title: document.title,
        page_count: null, // Will be populated after AI processing (TASK-003.x)
        protection_config: protectionConfig,
      },
      watermark_data: watermarkData,
    };
  }

  /**
   * Processes a heartbeat request for an active viewing session.
   *
   * @param sessionId - Session UUID from the URL param
   * @param userId - Authenticated user's UUID (from JWT sub)
   * @returns HeartbeatResponse indicating session validity
   */
  async heartbeat(
    sessionId: string,
    userId: string,
  ): Promise<HeartbeatResponse> {
    // ── Step 1: Find session scoped to user (IDOR prevention) ────────────
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!session) {
      return {
        valid: false,
        reason: 'SESSION_TERMINATED',
      };
    }

    if (!session.isActive) {
      return {
        valid: false,
        reason: 'SESSION_TERMINATED',
      };
    }

    // ── Step 2: Update lastActivity ───────────────────────────────────────
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { lastActivity: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update lastActivity for session ${sessionId}: ${(error as Error).message}`,
      );
      return {
        valid: false,
        reason: 'SESSION_TERMINATED',
      };
    }

    return {
      valid: true,
      nextHeartbeatIn: 60,
    };
  }

  /**
   * Generates a presigned GET URL for a specific page of a document.
   *
   * 1. Validates the session exists, is active, belongs to user, and hasn't timed out
   * 2. Constructs the S3 key from trusted DB data (workspaceId, documentId)
   * 3. Generates a presigned GET URL with 60-second TTL
   *
   * The S3 key pattern strictly matches how the AI Worker saves processed pages:
   *   {workspaceId}/{documentId}/pages/page-{N}.webp
   *
   * @param sessionId - Session UUID from the URL param
   * @param userId - Authenticated user's UUID (from JWT sub)
   * @param pageNumber - Page number (1-indexed)
   * @returns Presigned GET URL and expiry
   */
  async getPageUrl(
    sessionId: string,
    userId: string,
    pageNumber: number,
  ): Promise<PageUrlResponse> {
    // ── Step 1: Validate session (IDOR-safe) ──────────────────────────────
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        isActive: true,
        lastActivity: {
          gte: new Date(Date.now() - SESSION_ACTIVITY_WINDOW_MS),
        },
      },
      include: {
        document: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
      },
    });

    if (!session) {
      throw new ForbiddenException({
        statusCode: 403,
        error: {
          code: 'SESSION_INVALID',
          message:
            'Session is invalid, inactive, or expired. Please create a new viewing session.',
        },
      });
    }

    // ── Step 2: Validate page number against document's page count ───────
    // Fetch the latest processed version to get pageCount.
    const latestVersion =
      await this.prisma.documentVersion.findFirst({
        where: { documentId: session.document.id },
        orderBy: { versionNumber: 'desc' },
        select: { pageCount: true },
      });

    if (latestVersion?.pageCount && pageNumber > latestVersion.pageCount) {
      this.logger.warn(
        `Page number out of range: sessionId=${sessionId}, ` +
          `pageNumber=${pageNumber}, pageCount=${latestVersion.pageCount}`,
      );
      throw new NotFoundException({
        statusCode: 404,
        error: {
          code: 'PAGE_NOT_FOUND',
          message: `Page ${pageNumber} does not exist. The document has ${latestVersion.pageCount} pages.`,
        },
      });
    }

    // ── Step 3: Construct S3 key from trusted DB data ─────────────────────
    // Format: workspaceId/documentId/pages/page-N.webp
    // This matches the AI Worker's output format (TASK-004.x).
    const s3Key = `${session.document.workspaceId}/${session.document.id}/pages/page-${pageNumber}.webp`;

    // ── Step 3: Generate presigned GET URL ────────────────────────────────
    const expiresIn = 60;
    const url = await this.s3Service.generatePresignedGetUrl(
      s3Key,
      expiresIn,
    );

    this.logger.debug(
      `Page URL generated: sessionId=${sessionId}, pageNumber=${pageNumber}, s3Key=${s3Key}`,
    );

    return {
      url,
      expires_in: expiresIn,
    };
  }
}
