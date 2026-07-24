import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EMAIL_SERVICE_TOKEN,
  type EmailService,
} from '../../shared/utils/email.service';

/**
 * AccessService manages document access enforcement, session termination,
 * and security notifications.
 *
 * Responsibilities:
 * - Terminate stale sessions when a workspace's concurrent device limit is exceeded
 * - Send security alerts to affected users
 * - Enforce DRM access policies
 */
@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SERVICE_TOKEN)
    private readonly emailService: EmailService,
  ) {}

  /**
   * Terminates the oldest active session for a given user and document,
   * and sends a security alert email to the affected user.
   *
   * Called by ViewerService when a new session is being created but the
   * concurrent session limit has been reached.
   *
   * @param userId - The user whose old session will be terminated
   * @param documentId - The document being accessed
   * @param newDeviceInfo - Information about the new device causing the termination
   * @returns The terminated session ID, or null if no session was terminated
   */
  async terminateOldestSession(
    userId: string,
    documentId: string,
    newDeviceInfo: string,
  ): Promise<string | null> {
    // ── Find the oldest active session for this user+document ───────────
    const oldestSession = await this.prisma.session.findFirst({
      where: {
        userId,
        documentId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        document: {
          select: { title: true },
        },
        user: {
          select: { email: true },
        },
      },
    });

    if (!oldestSession) {
      this.logger.warn(
        `No active session found to terminate for userId=${userId}, documentId=${documentId}`,
      );
      return null;
    }

    // ── Terminate the session ──────────────────────────────────────────
    await this.prisma.session.update({
      where: { id: oldestSession.id },
      data: { isActive: false },
    });

    this.logger.log(
      `Session terminated: sessionId=${oldestSession.id}, userId=${userId}, documentId=${documentId}`,
    );

    // ── Send security alert (best-effort, non-blocking) ────────────────
    if (oldestSession.user?.email && oldestSession.document?.title) {
      this.emailService
        .sendSessionTerminated(
          oldestSession.user.email,
          oldestSession.document.title,
          newDeviceInfo,
        )
        .catch((err: Error) =>
          this.logger.warn(
            `Failed to send session terminated alert: ${err.message}`,
          ),
        );
    } else {
      this.logger.warn(
        `Cannot send session terminated alert: missing email or document title for session ${oldestSession.id}`,
      );
    }

    return oldestSession.id;
  }

  /**
   * Count active sessions for a user and document, returning the count.
   *
   * @param userId - The user to check
   * @param documentId - The document to check
   * @returns Number of currently active sessions
   */
  async countActiveSessions(
    userId: string,
    documentId: string,
  ): Promise<number> {
    const activeThreshold = new Date(
      Date.now() - 5 * 60 * 1000, // 5 minute window
    );

    return this.prisma.session.count({
      where: {
        userId,
        documentId,
        isActive: true,
        lastActivity: { gte: activeThreshold },
      },
    });
  }
}
