import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import {
  EmailService,
  EMAIL_SERVICE_TOKEN,
} from '../../shared/utils/email.service';
import type { TokenResponse } from '../dto/token-response.dto';

// ── Constants ──────────────────────────────────────────────────────────────

const TOKEN_BYTES = 32; // 64 hex chars
const DEFAULT_EXPIRY_MINUTES = 15;
const RATE_LIMIT_MAX = 3; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class MagicLinkService {
  private readonly logger = new Logger(MagicLinkService.name);
  private readonly expiryMinutes: number;

  // ── In-memory rate limiter (per email) ───────────────────────────────────
  private readonly rateLimitMap = new Map<
    string,
    { count: number; windowStart: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly workspacesService: WorkspacesService,
    configService: ConfigService,
    @Inject(EMAIL_SERVICE_TOKEN)
    private readonly emailService: EmailService,
  ) {
    this.expiryMinutes =
      Number(configService.get<number>('MAGIC_LINK_EXPIRY_MINUTES')) ||
      DEFAULT_EXPIRY_MINUTES;
  }

  // ── Generate cryptographically secure token ──────────────────────────────

  private generateToken(): string {
    return randomBytes(TOKEN_BYTES).toString('hex');
  }

  // ── Request magic link (anti-enumeration: always returns 200) ────────────

  /**
   * Request a magic link for the given email.
   *
   * AC-1/AC-2: Always returns the same message regardless of whether the
   * email exists, preventing user enumeration.
   *
   * Rate limiting is enforced by the controller (in-memory, 3 req/h per email).
   */
  private checkRateLimit(email: string): void {
    const now = Date.now();
    const entry = this.rateLimitMap.get(email);

    if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      // New window
      this.rateLimitMap.set(email, { count: 1, windowStart: now });
      return;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
  }

  async request(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    // ── Rate limit check ────────────────────────────────────────────────
    this.checkRateLimit(normalizedEmail);
    const token = this.generateToken();
    const expiresAt = new Date(
      Date.now() + this.expiryMinutes * 60 * 1000,
    );

    try {
      // ── Save token to DB ──────────────────────────────────────────────
      await this.prisma.verificationToken.create({
        data: {
          email: normalizedEmail,
          token,
          expiresAt,
        },
      });

      // ── Send email (via console stub for MVP) ──────────────────────────
      await this.emailService.sendMagicLink(normalizedEmail, token);
    } catch (error) {
      // Log the error but DO NOT reveal it to the client (anti-enumeration)
      this.logger.error(
        `Magic link request failed for ${normalizedEmail}: ${(error as Error).message}`,
      );
    }

    // Always return the same message regardless of success or failure
    return {
      message:
        'If an account with this email exists, we have sent a magic link. Please check your inbox.',
    };
  }

  // ── Verify magic link token ──────────────────────────────────────────────

  /**
   * Verify a magic link token.
   *
   * AC-3: If valid, the token is immediately deleted and JWT tokens are returned.
   * If the user doesn't exist, one is created (role: VIEWER).
   *
   * AC-4: If the token is expired, already used, or invalid, an error is thrown.
   */
  async verify(token: string): Promise<TokenResponse> {
    // ── Find token ──────────────────────────────────────────────────────
    const record = await this.prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      throw new BadRequestException(
        'This link is invalid or has already been used.',
      );
    }

    // ── Check expiry ────────────────────────────────────────────────────
    if (record.expiresAt < new Date()) {
      // Delete expired token
      await this.prisma.verificationToken
        .delete({ where: { id: record.id } })
        .catch(() => {});
      throw new BadRequestException(
        'This link has expired. Please request a new one.',
      );
    }

    // ── Delete token (one-time use / replay protection) ──────────────────
    await this.prisma.verificationToken.delete({
      where: { id: record.id },
    });

    // ── Find or create user ────────────────────────────────────────────────
    let user = await this.prisma.user.findUnique({
      where: { email: record.email },
      select: { id: true, email: true, role: true, defaultWorkspaceId: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: record.email,
          role: 'VIEWER',
        },
        select: { id: true, email: true, role: true, defaultWorkspaceId: true },
      });

      // Create default workspace for new user
      const workspaceId = await this.workspacesService.createDefaultWorkspace(
        user.id,
        user.email,
      );
      user.defaultWorkspaceId = workspaceId;

      this.logger.log(
        `Magic link: new user created id=${user.id}, email=${user.email}, workspace=${workspaceId}`,
      );
    }

    // ── Generate JWT tokens ─────────────────────────────────────────────
    const { accessToken, refreshToken } =
      this.authService.generateTokens(user);

    this.logger.log(
      `Magic link: user logged in id=${user.id}, email=${user.email}`,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
