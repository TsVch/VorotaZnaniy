import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { renderMagicLinkTemplate } from '../templates/magic-link.template';
import { renderPurchaseConfirmationTemplate } from '../templates/purchase-confirmation.template';
import { renderSessionTerminatedTemplate } from '../templates/session-terminated.template';
import { renderPasswordChangedTemplate } from '../templates/password-changed.template';
import { renderNewDeviceLoginTemplate } from '../templates/new-device-login.template';

// ── Token ──────────────────────────────────────────────────────────────────

export const EMAIL_SERVICE_TOKEN = 'EMAIL_SERVICE';

// ── Interface ──────────────────────────────────────────────────────────────

export interface EmailService {
  /** Send a magic link for passwordless login */
  sendMagicLink(email: string, token: string): Promise<void>;

  /** Send a purchase confirmation with a link to the viewer */
  sendPurchaseConfirmation(
    email: string,
    documentTitle: string,
    viewerUrl: string,
  ): Promise<void>;

  /** Send a security alert when a session is terminated due to device limit */
  sendSessionTerminated(
    email: string,
    documentTitle: string,
    deviceInfo: string,
  ): Promise<void>;

  /** Send a notification when password or email is changed */
  sendPasswordChanged(
    email: string,
    changeType: 'password' | 'email',
  ): Promise<void>;

  /** Send a security alert when login is detected from a new device */
  sendNewDeviceLogin(
    email: string,
    deviceInfo: { userAgent?: string; ipAddress?: string; timestamp: string },
  ): Promise<void>;
}

// ── Console stub (development / fallback) ──────────────────────────────────

@Injectable()
export class ConsoleEmailService implements EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);
  private readonly frontendUrl: string;

  constructor(configService: ConfigService) {
    this.frontendUrl =
      configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  async sendMagicLink(email: string, token: string): Promise<void> {
    const magicLink = `${this.frontendUrl}/auth/verify-magic-link?token=${token}`;
    this.logger.log(`══════════════════════════════════════════════`);
    this.logger.log(`📧 Magic Link for ${email}:`);
    this.logger.log(`🔗 ${magicLink}`);
    this.logger.log(`⏰ Expires in 15 minutes`);
    this.logger.log(`══════════════════════════════════════════════`);
  }

  async sendPurchaseConfirmation(
    email: string,
    documentTitle: string,
    viewerUrl: string,
  ): Promise<void> {
    this.logger.log(`══════════════════════════════════════════════`);
    this.logger.log(`📧 Purchase Confirmation for ${email}:`);
    this.logger.log(`📄 Document: ${documentTitle}`);
    this.logger.log(`🔗 ${viewerUrl}`);
    this.logger.log(`══════════════════════════════════════════════`);
  }

  async sendSessionTerminated(
    email: string,
    documentTitle: string,
    deviceInfo: string,
  ): Promise<void> {
    this.logger.log(`══════════════════════════════════════════════`);
    this.logger.log(`📧 SECURITY ALERT for ${email}:`);
    this.logger.log(`📄 Document: ${documentTitle}`);
    this.logger.log(`📱 Device: ${deviceInfo}`);
    this.logger.log(`⚠️ Session was terminated`);
    this.logger.log(`══════════════════════════════════════════════`);
  }

  async sendPasswordChanged(
    email: string,
    changeType: 'password' | 'email',
  ): Promise<void> {
    this.logger.log(`══════════════════════════════════════════════`);
    this.logger.log(`📧 Password Changed for ${email}:`);
    this.logger.log(`🔑 Change type: ${changeType}`);
    this.logger.log(`══════════════════════════════════════════════`);
  }

  async sendNewDeviceLogin(
    email: string,
    deviceInfo: { userAgent?: string; ipAddress?: string; timestamp: string },
  ): Promise<void> {
    this.logger.log(`══════════════════════════════════════════════`);
    this.logger.log(`📧 New Device Login for ${email}:`);
    this.logger.log(`📱 UA: ${deviceInfo.userAgent ?? 'Unknown'}`);
    this.logger.log(`🌐 IP: ${deviceInfo.ipAddress ?? 'Unknown'}`);
    this.logger.log(`🕐 Time: ${deviceInfo.timestamp}`);
    this.logger.log(`══════════════════════════════════════════════`);
  }
}

// ── Resend implementation (production) ─────────────────────────────────────

/**
 * Resend-based email service.
 *
 * When RESEND_API_KEY is configured, sends real emails via Resend API.
 * When not configured, logs to console for local development.
 *
 * @todo PLI-234: Replace direct send with BullMQ queue for retry and reliability.
 *       Currently using fire-and-forget (try-catch + Logger.error), which is
 *       sufficient for MVP but should be queued before Phase 2 to handle
 *       transient Resend API failures.
 */
@Injectable()
export class ResendEmailService implements EmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  /** @internal Visible for testing */
  resend: ResendClient | null = null;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;
  private initialized = false;

  constructor(configService: ConfigService) {
    this.fromEmail =
      configService.get<string>('EMAIL_FROM') ?? 'noreply@knowledgevault.com';
    this.frontendUrl =
      configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    const apiKey = configService.get<string>('RESEND_API_KEY');

    if (apiKey && apiKey !== 're_change-me-in-production') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Resend } = require('resend');
        this.resend = new Resend(apiKey);
        this.initialized = true;
        this.logger.log('ResendEmailService initialized with API key');
      } catch (error) {
        this.initialized = false;
        this.logger.warn(
          `Failed to initialize Resend SDK: ${(error as Error).message}. Falling back to console output.`,
        );
      }
    } else {
      this.initialized = false;
      this.logger.log(
        'ResendEmailService: No RESEND_API_KEY configured. Emails will be logged to console.',
      );
    }
  }

  async sendMagicLink(email: string, token: string): Promise<void> {
    const magicLink = `${this.frontendUrl}/auth/verify-magic-link?token=${token}`;
    const html = renderMagicLinkTemplate(magicLink);

    if (!this.initialized || !this.resend) {
      this.logger.log(`[Resend] Would send magic link to ${email}: ${magicLink}`);
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Вход в KnowledgeVault',
        html,
      });
      this.logger.log(`Magic link email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send magic link to ${email}: ${(error as Error).message}`,
      );
    }
  }

  async sendPurchaseConfirmation(
    email: string,
    documentTitle: string,
    viewerUrl: string,
  ): Promise<void> {
    const html = renderPurchaseConfirmationTemplate(documentTitle, viewerUrl);

    if (!this.initialized || !this.resend) {
      this.logger.log(
        `[Resend] Would send purchase confirmation to ${email}: document="${documentTitle}"`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Подписка KnowledgeVault Pro оформлена',
        html,
      });
      this.logger.log(`Purchase confirmation sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send purchase confirmation to ${email}: ${(error as Error).message}`,
      );
    }
  }

  async sendSessionTerminated(
    email: string,
    documentTitle: string,
    deviceInfo: string,
  ): Promise<void> {
    const html = renderSessionTerminatedTemplate(documentTitle, deviceInfo);

    if (!this.initialized || !this.resend) {
      this.logger.log(
        `[Resend] Would send session terminated alert to ${email}: document="${documentTitle}", device="${deviceInfo}"`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: '⚠️ Сессия KnowledgeVault завершена — уведомление безопасности',
        html,
      });
      this.logger.log(`Session terminated alert sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send session terminated alert to ${email}: ${(error as Error).message}`,
      );
    }
  }

  async sendPasswordChanged(
    email: string,
    changeType: 'password' | 'email',
  ): Promise<void> {
    const html = renderPasswordChangedTemplate(changeType, new Date().toISOString());

    if (!this.initialized || !this.resend) {
      this.logger.log(
        `[Resend] Would send password changed notification to ${email}: type=${changeType}`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: changeType === 'password'
          ? 'Пароль KnowledgeVault изменён'
          : 'Email KnowledgeVault изменён',
        html,
      });
      this.logger.log(`Password changed notification sent to ${email}: type=${changeType}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password changed notification to ${email}: ${(error as Error).message}`,
      );
    }
  }

  async sendNewDeviceLogin(
    email: string,
    deviceInfo: { userAgent?: string; ipAddress?: string; timestamp: string },
  ): Promise<void> {
    const html = renderNewDeviceLoginTemplate(
      deviceInfo.userAgent ?? 'Unknown',
      deviceInfo.ipAddress ?? 'Unknown',
      deviceInfo.timestamp,
    );

    if (!this.initialized || !this.resend) {
      this.logger.log(
        `[Resend] Would send new device login alert to ${email}: ua="${deviceInfo.userAgent}", ip="${deviceInfo.ipAddress}"`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: '🔐 Вход в KnowledgeVault с нового устройства',
        html,
      });
      this.logger.log(`New device login alert sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send new device login alert to ${email}: ${(error as Error).message}`,
      );
    }
  }
}

// ── Type helper for Resend SDK (avoid compile-time dependency) ─────────────

interface ResendClient {
  emails: {
    send(params: {
      from: string;
      to: string;
      subject: string;
      html: string;
    }): Promise<unknown>;
  };
}
