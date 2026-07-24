import * as crypto from 'crypto';
import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IPaymentProvider,
  PAYMENT_PROVIDER_TOKEN,
  type WebhookEvent,
} from '../interfaces/payment-provider.interface';
import {
  EMAIL_SERVICE_TOKEN,
  type EmailService,
} from '../../shared/utils/email.service';
import type { CreatePaymentDto } from '../dto/create-payment.dto';
import type { SubscriptionStatusDto } from '../dto/subscription-status.dto';
import type { SubscriptionHistoryDto } from '../dto/subscription-history.dto';

/**
 * Provider-agnostic billing service.
 *
 * Depends ONLY on IPaymentProvider interface, never on a concrete provider.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly paymentProvider: IPaymentProvider,
    @Inject(EMAIL_SERVICE_TOKEN)
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a payment for workspace subscription.
   */
  async createPayment(
    dto: CreatePaymentDto,
    userId: string,
  ): Promise<{
    confirmationUrl: string;
    providerTransactionId: string;
  }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: dto.workspaceId },
      select: { id: true, ownerId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.ownerId !== userId) throw new ForbiddenException('You do not own this workspace');

    const result = await this.paymentProvider.createPayment({
      amount: dto.amount,
      currency: dto.currency ?? 'RUB',
      workspaceId: dto.workspaceId,
      description: dto.description,
      returnUrl: dto.returnUrl,
      savePaymentMethod: true, // Save method for recurring payments
    });

    // If a payment method was saved, update the workspace
    if (result.paymentMethodId) {
      await this.prisma.workspace.update({
        where: { id: dto.workspaceId },
        data: { providerPaymentMethodId: result.paymentMethodId },
      }).catch((err: Error) => {
        this.logger.warn(`Failed to save payment method: ${err.message}`);
      });
    }

    // ── Mock provider: schedule simulated webhook ─────────────────
    // The mock provider doesn't call back to BillingService (would create a
    // circular dependency). Instead, BillingService detects mock mode and
    // schedules the webhook simulation itself after a realistic delay.
    if (this.paymentProvider.getProviderName() === 'mock') {
      this.scheduleMockWebhook(result.providerTransactionId, dto);
    }

    return {
      confirmationUrl: result.confirmationUrl,
      providerTransactionId: result.providerTransactionId,
    };
  }

  /**
   * Cancel an active subscription.
   */
  async cancelSubscription(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true, subscriptionStatus: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.ownerId !== userId) throw new ForbiddenException('You do not own this workspace');
    if (workspace.subscriptionStatus !== 'ACTIVE') throw new ForbiddenException('Subscription is not active');

    // Call provider (local for YooKassa MVP)
    await this.paymentProvider.cancelSubscription({ workspaceId });

    // Update DB
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { subscriptionStatus: 'CANCELLED' },
    });

    this.logger.log(`Subscription cancelled: workspaceId=${workspaceId}, userId=${userId}`);
  }

  /**
   * Get subscription payment history.
   */
  async getSubscriptionHistory(
    workspaceId: string,
  ): Promise<SubscriptionHistoryDto> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        providerPaymentMethodId: true,
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    // Fetch payment history from processed_payments table
    let payments: Array<{
      providerTransactionId: string;
      eventType: string;
      workspaceId: string;
      processedAt: Date;
    }> = [];
    try {
      payments = await this.prisma.$queryRawUnsafe<
        Array<{
          providerTransactionId: string;
          eventType: string;
          workspaceId: string;
          processedAt: Date;
        }>
      >(
        `SELECT "providerTransactionId", "eventType", "workspaceId", "processedAt"
         FROM "processed_payments"
         WHERE "workspaceId" = $1
         ORDER BY "processedAt" DESC
         LIMIT 50`,
        workspaceId,
      );
    } catch {
      // Table might not exist yet
    }

    const paymentHistoryItems = payments.map((p) => ({
      providerTransactionId: p.providerTransactionId,
      eventType: p.eventType,
      amount: '-', // Amount not stored in processed_payments for MVP
      currency: 'RUB',
      isRecurring: false,
      processedAt: p.processedAt.toISOString(),
    }));

    return {
      payments: paymentHistoryItems,
      total: paymentHistoryItems.length,
      subscriptionStatus: workspace.subscriptionStatus ?? 'FREE',
      nextBillingDate: workspace.subscriptionExpiresAt?.toISOString(),
      paymentMethod: workspace.providerPaymentMethodId
        ? { type: 'bank_card', last4: '****' }
        : undefined,
    };
  }

  /**
   * Get subscription status for a workspace.
   */
  async getSubscriptionStatus(
    workspaceId: string,
  ): Promise<SubscriptionStatusDto> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        activePaymentProvider: true,
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    const isActive = workspace.subscriptionStatus === 'ACTIVE' || workspace.subscriptionStatus === 'active';
    const daysRemaining = workspace.subscriptionExpiresAt
      ? Math.max(0, Math.ceil(
          (new Date(workspace.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ))
      : undefined;

    return {
      status: workspace.subscriptionStatus ?? 'FREE',
      plan: workspace.subscriptionPlan ?? 'FREE',
      expiresAt: workspace.subscriptionExpiresAt?.toISOString(),
      activeProvider: workspace.activePaymentProvider ?? undefined,
      isActive,
      daysRemaining,
      proPlanPrice: 99000,
      proPlanCurrency: 'RUB',
    };
  }

  /**
   * Process an incoming webhook event idempotently.
   */
  async processWebhookEvent(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<{ handled: boolean; message: string }> {
    const rawPayload = JSON.stringify(payload);
    const isValid = this.paymentProvider.validateWebhookSignature(rawPayload, signature);

    if (!isValid) {
      this.logger.warn(`Invalid webhook signature from ${this.paymentProvider.getProviderName()}`);
      return { handled: false, message: 'Invalid signature' };
    }

    const event = this.paymentProvider.parseWebhookEvent(payload);
    this.logger.log(
      `Webhook event: type=${event.eventType}, tx=${event.providerTransactionId}, workspaceId=${event.workspaceId}, recurring=${!!event.isRecurring}`,
    );

    if (!event.providerTransactionId || !event.workspaceId) {
      return { handled: false, message: 'Missing transaction or workspace ID' };
    }

    // Idempotency check
    const alreadyProcessed = await this.isAlreadyProcessed(event.providerTransactionId);
    if (alreadyProcessed) {
      return { handled: true, message: 'Already processed' };
    }

    // Apply business logic
    if (event.eventType === 'payment.succeeded') {
      await this.handlePaymentSucceeded(event);
    } else if (event.eventType === 'payment.canceled') {
      await this.handlePaymentCanceled(event);
    }

    // Record idempotency
    await this.recordProcessedPayment(event);

    return { handled: true, message: 'Webhook processed successfully' };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private async handlePaymentSucceeded(event: WebhookEvent): Promise<void> {
    const now = new Date();
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: event.workspaceId },
      select: { subscriptionExpiresAt: true, subscriptionStatus: true, providerPaymentMethodId: true },
    });

    if (!workspace) {
      this.logger.warn(`Workspace not found for webhook: ${event.workspaceId}`);
      return;
    }

    if (event.isRecurring) {
      // Recurring payment — extend subscription by 30 days from current expiry
      const baseDate = workspace.subscriptionExpiresAt && workspace.subscriptionExpiresAt > now
        ? workspace.subscriptionExpiresAt
        : now;
      const newExpiresAt = new Date(baseDate);
      newExpiresAt.setDate(newExpiresAt.getDate() + 30);

      await this.prisma.workspace.update({
        where: { id: event.workspaceId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionPlan: 'PRO',
          subscriptionExpiresAt: newExpiresAt,
          // Save payment method ID if returned
          ...(event.paymentMethodId ? { providerPaymentMethodId: event.paymentMethodId } : {}),
        },
      });

      this.logger.log(
        `Recurring subscription extended: workspaceId=${event.workspaceId}, tx=${event.providerTransactionId}, newExpiry=${newExpiresAt.toISOString()}`,
      );

      // Send notification for recurring payment (best-effort, non-blocking)
      await this.sendPurchaseNotification(event.workspaceId).catch(
        (err: Error) => this.logger.warn(`Purchase notification failed: ${err.message}`),
      );
    } else {
      // Initial payment — activate subscription for 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.prisma.workspace.update({
        where: { id: event.workspaceId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionPlan: 'PRO',
          subscriptionExpiresAt: expiresAt,
          providerCustomerId: event.providerCustomerId,
          activePaymentProvider: this.paymentProvider.getProviderName().toLowerCase(),
          ...(event.paymentMethodId ? { providerPaymentMethodId: event.paymentMethodId } : {}),
        },
      });

      this.logger.log(
        `Subscription activated: workspaceId=${event.workspaceId}, tx=${event.providerTransactionId}, expires=${expiresAt.toISOString()}`,
      );

      // Send purchase confirmation (best-effort, non-blocking)
      await this.sendPurchaseNotification(event.workspaceId).catch(
        (err: Error) => this.logger.warn(`Purchase notification failed: ${err.message}`),
      );
    }
  }

  /**
   * Send purchase confirmation email to the workspace owner.
   * Best-effort — failures are logged but never thrown.
   */
  private async sendPurchaseNotification(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        owner: {
          select: { email: true },
        },
      },
    });

    if (!workspace?.owner?.email) {
      this.logger.warn(`Cannot send purchase notification: workspace ${workspaceId} has no owner email`);
      return;
    }

    await this.emailService.sendPurchaseConfirmation(
      workspace.owner.email,
      'KnowledgeVault Pro',
      `${process.env['FRONTEND_URL'] ?? 'http://localhost:3001'}/workspace/settings`,
    );
  }

  private async handlePaymentCanceled(event: WebhookEvent): Promise<void> {
    await this.prisma.workspace.update({
      where: { id: event.workspaceId },
      data: { subscriptionStatus: 'CANCELLED' },
    });
    this.logger.log(`Subscription cancelled via webhook: workspaceId=${event.workspaceId}, tx=${event.providerTransactionId}`);
  }

  private async isAlreadyProcessed(providerTransactionId: string): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "processed_payments" WHERE "providerTransactionId" = $1 LIMIT 1`,
        providerTransactionId,
      );
      return rows && rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Schedule a mock webhook callback after payment creation.
   *
   * After a ~2s delay, simulates YooKassa sending a `payment.succeeded` event
   * so that the full payment cycle (create → webhook → activate) works end-to-end
   * without a real payment provider.
   *
   * Only called when PAYMENT_PROVIDER_ACTIVE=mock.
   */
  private scheduleMockWebhook(
    paymentId: string,
    dto: CreatePaymentDto,
  ): void {
    setTimeout(() => {
      const mockPayload: Record<string, unknown> = {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: paymentId,
          status: 'succeeded',
          amount: {
            value: (dto.amount / 100).toFixed(2),
            currency: dto.currency ?? 'RUB',
          },
          metadata: {
            workspaceId: dto.workspaceId,
          },
          created_at: new Date().toISOString(),
        },
      };

      this.logger.log(
        `[Mock] Simulating webhook for payment: ${paymentId}`,
      );

      this.processWebhookEvent(mockPayload, 'mock-signature').catch(
        (err: Error) =>
          this.logger.error(
            `[Mock] Webhook simulation failed: ${err.message}`,
          ),
      );
    }, 2000); // 2-second delay to simulate real provider latency
  }

  private async recordProcessedPayment(event: WebhookEvent): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "processed_payments" ("id", "providerTransactionId", "eventType", "workspaceId", "processedAt")
         VALUES ($1, $2, $3, $4, NOW())`,
        crypto.randomUUID(),
        event.providerTransactionId,
        event.eventType,
        event.workspaceId,
      );
    } catch (error: unknown) {
      this.logger.warn(`Failed to record processed payment: ${(error as Error).message}`);
    }
  }
}
