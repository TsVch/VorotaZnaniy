import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import {
  EMAIL_SERVICE_TOKEN,
  type EmailService,
} from '../shared/utils/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type {
  TokenResponse,
  AuthUserResponse,
} from './dto/token-response.dto';
import type { OAuthProfile } from './dto/oauth-profile';

// ── Constants ──────────────────────────────────────────────────────────────

const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ── Types ──────────────────────────────────────────────────────────────────

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  workspaceId?: string;
}

interface RefreshPayload {
  sub: string;
}

// ── Exceptions ─────────────────────────────────────────────────────────────

/**
 * Generic "Invalid email or password" error.
 * Same message for both "email not found" and "wrong password"
 * to prevent user enumeration attacks.
 */
const INVALID_CREDENTIALS_MSG = 'Invalid email or password';

// ── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly workspacesService: WorkspacesService,
    @Inject(EMAIL_SERVICE_TOKEN)
    private readonly emailService: EmailService,
  ) {}

  // ── OAuth Validation ─────────────────────────────────────────────────────

  /**
   * Validate or create a user from an OAuth profile.
   *
   * AC-3: If a user with the same email already exists (via password registration),
   * we link the OAuth login to that existing account — no duplicate is created.
   *
   * AC-4: If the email is missing from the provider profile, the strategy
   * itself rejects the request before reaching this method.
   *
   * @throws Error if email is missing (should not happen — strategy guards this)
   */
  async validateOAuthUser(profile: OAuthProfile): Promise<TokenResponse> {
    const { email, provider } = profile;

    if (!email) {
      throw new UnauthorizedException('Email is required from provider');
    }

    // ── Find existing user by email ─────────────────────────────────────
    let user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, defaultWorkspaceId: true },
    });

    if (user) {
      this.logger.log(
        `OAuth login (${provider}): existing user id=${user.id}, email=${email}`,
      );
    } else {
      // ── Create new user (OAuth-only, no password hash) ────────────────
      // New users are CREATORs (they own a workspace and can upload docs).
      try {
        user = await this.prisma.user.create({
          data: {
            email,
            role: 'CREATOR',
            name: profile.name ?? null,
            avatarUrl: profile.avatarUrl ?? null,
          },
          select: { id: true, email: true, role: true, defaultWorkspaceId: true },
        });

        // ── Create default workspace ────────────────────────────────────
        const workspaceId = await this.workspacesService.createDefaultWorkspace(
          user.id,
          email,
        );
        user.defaultWorkspaceId = workspaceId;

        this.logger.log(
          `OAuth registration (${provider}): new user id=${user.id}, email=${email}, workspace=${workspaceId}`,
        );
      } catch (error) {
        this.logger.error(
          `OAuth user creation failed: ${(error as Error).message}`,
        );
        throw new Error('OAuth user creation failed');
      }
    }

    // ── Skip saving providerId for MVP (Phase 2: linked accounts table) ─

    const authUser = this.mapUser(user);
    const { accessToken, refreshToken } = this.generateTokens(user);

    return {
      accessToken,
      refreshToken,
      user: authUser,
    };
  }

  // ── Public token helpers (used by MagicLinkService) ────────────────────────

  /**
   * Generate both access and refresh tokens for a given user.
   * Exposed as public so other services (e.g. MagicLinkService) can
   * issue tokens without duplicating JWT logic.
   */
  /**
   * Generate both access and refresh tokens for a given user.
   * Includes the user's defaultWorkspaceId in the JWT payload if set.
   */
  generateTokens(user: {
    id: string;
    email: string;
    role: string;
    defaultWorkspaceId?: string | null;
  }): {
    accessToken: string;
    refreshToken: string;
  } {
    return {
      accessToken: this.accessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        workspaceId: user.defaultWorkspaceId ?? undefined,
      }),
      refreshToken: this.refreshToken({ sub: user.id }),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getJwtSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      this.logger.error('JWT_SECRET is not configured');
      throw new Error('JWT_SECRET environment variable is missing');
    }
    return secret;
  }

  private accessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  }

  private refreshToken(payload: RefreshPayload): string {
    return jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });
  }

  private mapUser(user: {
    id: string;
    email: string;
    role: string;
  }): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  // ── Register ─────────────────────────────────────────────────────────────

  /**
   * Register a new user with email and password.
   *
   * 1. Checks email uniqueness
   * 2. Hashes the password with bcrypt (12 rounds)
   * 3. Creates the user record
   * 4. Generates JWT tokens
   *
   * @throws ConflictException if email already exists
   */
  async register(dto: RegisterDto): Promise<TokenResponse> {
    const { email, password } = dto;
    const normalizedEmail = email.toLowerCase().trim();

    // ── Check uniqueness ─────────────────────────────────────────────────
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // ── Hash password ───────────────────────────────────────────────────
    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    } catch (error) {
      this.logger.error(`bcrypt hash failed: ${(error as Error).message}`);
      throw new Error('Password hashing failed');
    }

    // ── Create user ─────────────────────────────────────────────────────
    // New users are CREATORs: they get their own workspace and can upload
    // documents (upload-init / upload-complete require Role.CREATOR).
    let user: { id: string; email: string; role: string; defaultWorkspaceId: string | null };
    try {
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: 'CREATOR',
        },
        select: { id: true, email: true, role: true, defaultWorkspaceId: true },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create user: ${(error as Error).message}`,
      );
      throw new Error('User creation failed');
    }

    // ── Create default workspace (AC-1) ─────────────────────────────────
    const workspaceId = await this.workspacesService.createDefaultWorkspace(
      user.id,
      normalizedEmail,
    );

    // Reload user with workspaceId set
    user.defaultWorkspaceId = workspaceId;

    // ── Generate tokens ─────────────────────────────────────────────────
    const authUser = this.mapUser(user);
    const { accessToken, refreshToken } = this.generateTokens(user);

    this.logger.log(
      `User registered: id=${user.id}, email=${user.email}, workspace=${workspaceId}`,
    );

    return {
      accessToken,
      refreshToken,
      user: authUser,
    };
  }

  // ── Login ────────────────────────────────────────────────────────────────

  /**
   * Authenticate a user with email and password.
   *
   * Uses a generic "Invalid email or password" message for both
   * missing email and wrong password cases (anti-enumeration).
   *
   * @throws UnauthorizedException if credentials are invalid
   */
  async login(dto: LoginDto): Promise<TokenResponse> {
    const { email, password } = dto;
    const normalizedEmail = email.toLowerCase().trim();

    // ── Find user ───────────────────────────────────────────────────────
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, role: true, passwordHash: true },
    });

    if (!user) {
      // Generic message — don't reveal whether the email exists
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    // ── Verify password ─────────────────────────────────────────────────
    if (!user.passwordHash) {
      // User has no password (e.g., OAuth-only) — reject
      this.logger.warn(
        `Login attempt for user ${user.id} without password hash`,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    let passwordValid: boolean;
    try {
      passwordValid = await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      this.logger.error(
        `bcrypt compare failed: ${(error as Error).message}`,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    if (!passwordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MSG);
    }

    // ── Generate tokens ─────────────────────────────────────────────────
    const authUser = this.mapUser(user);
    const { accessToken, refreshToken } = this.generateTokens(user);

    this.logger.log(`User logged in: id=${user.id}, email=${user.email}`);

    // ── New Device Detection (AC-2 / AC-3) ────────────────────────
    // Fire-and-forget — must not block login response
    this.detectAndNotifyNewDevice(user.id, user.email).catch(
      (err: Error) => this.logger.warn(`New device detection failed: ${err.message}`),
    );

    return {
      accessToken,
      refreshToken,
      user: authUser,
    };
  }

  /**
   * Check if the current device fingerprint is known for this user.
   * If not, send a "new device login" security alert.
   *
   * AC-2: Sends alert for unrecognised deviceFingerprint.
   * AC-3: Suppresses alert if deviceFingerprint is already in active sessions.
   *
   * @remarks In MVP we don't receive deviceFingerprint from login DTO
   * (it's captured later when the viewer session is created). As a placeholder,
   * this checks for recent sessions without a fingerprint (new users)
   * and logs a warning. Full device fingerprint integration requires
   * a frontend-provided fingerprint in the login request.
   */
  private async detectAndNotifyNewDevice(
    userId: string,
    email: string,
  ): Promise<void> {
    // For MVP, log a notice that full device detection needs frontend integration
    this.logger.debug(
      `New device check: userId=${userId}, email=${email}. ` +
      'Full device fingerprint detection requires frontend-provided fingerprint in login DTO (Phase 2).',
    );

    // Placeholder: count recent sessions without fingerprint (indicating new devices)
    const recentSessionCount = await this.prisma.session.count({
      where: {
        userId,
        isActive: true,
        lastActivity: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    // If no active sessions in the last 24 hours, this might be a new device
    if (recentSessionCount === 0) {
      this.logger.log(
        `No recent active sessions for user ${userId} — sending new device alert (MVP placeholder)`,
      );

      // Use a placeholder device description since we don't have fingerprint yet
      await this.emailService.sendNewDeviceLogin(
        email,
        {
          userAgent: 'Unknown (MVP — full fingerprint detection in Phase 2)',
          ipAddress: 'Unknown (MVP)',
          timestamp: new Date().toISOString(),
        },
      ).catch((err: Error) => {
        this.logger.warn(`Failed to send new device alert: ${err.message}`);
      });
    }
  }

  // ── Refresh ──────────────────────────────────────────────────────────────

  /**
   * Refresh an expired access token using a valid refresh token.
   *
   * @param refreshToken - A valid JWT refresh token
   * @returns A new access token
   * @throws UnauthorizedException if the refresh token is invalid or expired
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = jwt.verify(
        refreshToken,
        this.getJwtSecret(),
      ) as RefreshPayload;

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verify the user still exists (include defaultWorkspaceId so the
      // refreshed access token keeps the workspaceId claim)
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          defaultWorkspaceId: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const { accessToken } = this.generateTokens(user);

      return { accessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Refresh token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      this.logger.error(
        `Token refresh failed: ${(error as Error).message}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
