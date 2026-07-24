import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import type {
  IPaymentProvider,
  CreatePaymentParams,
  PaymentResponse,
  WebhookEvent,
  RecurringPaymentParams,
  CancelSubscriptionParams,
  PaymentMethod,
} from '../interfaces/payment-provider.interface';

/**
 * Mock payment provider for internal testing without a real YooKassa account.
 *
 * Returns fake confirmation URLs and (via BillingService scheduling) simulates
 * a `payment.succeeded` webhook ~2 seconds after payment creation.
 *
 * 🔐 BLOCKED in production — NODE_ENV=production + PAYMENT_PROVIDER_ACTIVE=mock
 *    will throw an error at module initialisation.
 *
 * @see TASK-012.2
 */
@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  getProviderName(): string {
    return 'mock';
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    const paymentId = `mock_${crypto.randomUUID()}`;

    this.logger.log(
      `[Mock] Payment created: ${paymentId} for workspace ${params.workspaceId}, ` +
        `amount=${params.amount} ${params.currency ?? 'RUB'}`,
    );

    return {
      confirmationUrl: `https://mock-payment.example.com/checkout/${paymentId}`,
      providerTransactionId: paymentId,
      raw: {
        paymentId,
        workspaceId: params.workspaceId,
        amount: params.amount,
        currency: params.currency ?? 'RUB',
        description: params.description,
        status: 'pending',
      },
    };
  }

  async createRecurringPayment(
    params: RecurringPaymentParams,
  ): Promise<PaymentResponse> {
    const paymentId = `mock_recurring_${crypto.randomUUID()}`;

    this.logger.log(
      `[Mock] Recurring payment created: ${paymentId} for workspace ` +
        `${params.workspaceId}, amount=${params.amount}, method=${params.paymentMethodId.slice(0, 8)}...`,
    );

    return {
      confirmationUrl: '',
      providerTransactionId: paymentId,
      raw: {
        paymentId,
        workspaceId: params.workspaceId,
        amount: params.amount,
        currency: params.currency ?? 'RUB',
        isRecurring: true,
        status: 'succeeded',
      },
    };
  }

  async cancelSubscription(_params: CancelSubscriptionParams): Promise<void> {
    this.logger.log(
      `[Mock] Subscription cancelled: workspaceId=${_params.workspaceId}`,
    );
  }

  async getPaymentMethods(_customerId: string): Promise<PaymentMethod[]> {
    this.logger.log(`[Mock] Returning default payment methods`);

    return [
      {
        id: `mock_method_${crypto.randomUUID().slice(0, 8)}`,
        type: 'bank_card',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
      },
    ];
  }

  validateWebhookSignature(_payload: string, _signature: string): boolean {
    // Mock — always valid
    return true;
  }

  parseWebhookEvent(payload: Record<string, unknown>): WebhookEvent {
    // Handle YooKassa-wrapped format: { type, event, object }
    // Also handles flat: { id, metadata, amount }
    const objectData = (payload.object ?? payload) as Record<string, unknown>;
    const metadata = (objectData.metadata ?? {}) as Record<string, unknown>;
    const amount = (objectData.amount ?? {}) as Record<string, unknown>;

    return {
      eventType: 'payment.succeeded',
      providerTransactionId: (objectData.id as string) ?? 'mock_unknown',
      workspaceId: (metadata.workspaceId as string) ?? '',
      amount: (amount.value as string) ?? '990.00',
      currency: (amount.currency as string) ?? 'RUB',
      raw: payload,
    };
  }
}
