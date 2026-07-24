import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMAIL_SERVICE_TOKEN,
  type EmailService,
} from '../shared/utils/email.service';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * UsersService manages user profile operations including
 * password and email changes with security notification triggers.
 *
 * All email notifications are fire-and-forget to avoid blocking
 * the main business flow.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SERVICE_TOKEN)
    private readonly emailService: EmailService,
  ) {}

  /**
   * Change the user's password.
   *
   * 1. Validates current password
   * 2. Hashes the new password
   * 3. Updates in database
   * 4. Sends notification email (best-effort)
   *
   * @param userId - The authenticated user's UUID
   * @param currentPassword - The user's current password for verification
   * @param newPassword - The new password to set
   *
   * @throws NotFoundException if user not found
   * @throws Error if current password is incorrect
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('Cannot change password for OAuth-only account');
    }

    // ── Verify current password ─────────────────────────────────────────
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // ── Hash new password ───────────────────────────────────────────────
    const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // ── Update database ─────────────────────────────────────────────────
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    this.logger.log(`Password changed: userId=${userId}`);

    // ── Send notification (best-effort, non-blocking) ───────────────────
    this.emailService
      .sendPasswordChanged(user.email, 'password')
      .catch((err: Error) =>
        this.logger.warn(`Password changed notification failed: ${err.message}`),
      );
  }

  /**
   * Change the user's email address.
   *
   * 1. Checks email uniqueness
   * 2. Updates in database
   * 3. Sends notification to the OLD email (best-effort)
   *
   * @param userId - The authenticated user's UUID
   * @param newEmail - The new email address
   *
   * @throws NotFoundException if user not found
   * @throws ConflictException if new email already in use
   */
  async changeEmail(
    userId: string,
    newEmail: string,
  ): Promise<void> {
    const normalizedEmail = newEmail.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ── Check email uniqueness ──────────────────────────────────────────
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing && existing.id !== userId) {
      throw new ConflictException('Email already in use');
    }

    // ── Store old email before updating ─────────────────────────────────
    const oldEmail = user.email;

    // ── Update database ─────────────────────────────────────────────────
    await this.prisma.user.update({
      where: { id: userId },
      data: { email: normalizedEmail },
    });

    this.logger.log(
      `Email changed: userId=${userId}, old=${oldEmail}, new=${normalizedEmail}`,
    );

    // ── Send notification to OLD email (best-effort) ────────────────────
    this.emailService
      .sendPasswordChanged(oldEmail, 'email')
      .catch((err: Error) =>
        this.logger.warn(`Email changed notification failed: ${err.message}`),
      );
  }
}
