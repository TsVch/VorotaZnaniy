import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 * YooKassa (formerly Yandex.Kassa) payment provider.
 *
 * Implements the IPaymentProvider strategy for YooKassa API v3.
 * Uses Basic HTTP Auth with shop ID + secret key.
 *
 * @see https://yookassa.ru/docs/api
 */
@Injectable()
export class YooKassaPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(YooKassaPaymentProvider.name);
  private readonly apiUrl = 'https://api.yookassa.ru/v3';
  private readonly shopId: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.shopId = this.configService.getOrThrow<string>('YOOKASSA_SHOP_ID');
    this.secretKey = this.configService.getOrThrow<string>('YOOKASSA_SECRET_KEY');
    this.webhookSecret = this.configService.getOrThrow<string>(
      'YOOKASSA_WEBHOOK_SECRET',
    );
  }

  getProviderName(): string {
    return 'YooKassa';
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    const idempotencyKey = params.idempotencyKey ?? crypto.randomUUID();

    const body: Record<string, unknown> = {
      amount: {
        value: (params.amount / 100).toFixed(2),
        currency: params.currency ?? 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: params.returnUrl,
      },
      description: params.description,
      metadata: {
        workspaceId: params.workspaceId,
        paymentType: 'initial',
      },
    };

    // If savePaymentMethod is requested, ask YooKassa to save the payment method
    if (params.savePaymentMethod) {
      body.save_payment_method = true;
    }

    this.logger.log(
      `Creating YooKassa payment: workspaceId=${params.workspaceId}, amount=${(body.amount as Record<string, unknown>).value} ${(body.amount as Record<string, unknown>).currency}, saveMethod=${!!params.savePaymentMethod}`,
    );

    const response = await fetch(`${this.apiUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.encodeBasicAuth()}`,
        'Idempotence-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      this.logger.error(
        `YooKassa API error: ${response.status} ${response.statusText} — ${errorBody}`,
      );
      throw new Error(
        `YooKassa payment creation failed: ${response.status} ${response.statusText}`,
      );
    }

    const result = (await response.json()) as Record<string, unknown>;
    const confirmation = result.confirmation as Record<string, unknown> | undefined;
    const confirmationUrl =
      (confirmation?.confirmationUrl as string) ??
      (confirmation?.url as string) ??
      '';

    if (!confirmationUrl) {
      throw new Error(
        'YooKassa did not return a confirmation URL in the response',
      );
    }

    // Extract saved payment method ID if present
    const paymentMethod = result.payment_method as Record<string, unknown> | undefined;
    const paymentMethodId = paymentMethod?.id as string | undefined;

    return {
      confirmationUrl,
      providerTransactionId: result.id as string,
      paymentMethodId,
      raw: result as Record<string, unknown>,
    };
  }

  async createRecurringPayment(
    params: RecurringPaymentParams,
  ): Promise<PaymentResponse> {
    const idempotencyKey = params.idempotencyKey ?? crypto.randomUUID();

    const body = {
      amount: {
        value: (params.amount / 100).toFixed(2),
        currency: params.currency ?? 'RUB',
      },
      capture: true,
      payment_method_id: params.paymentMethodId,
      description: params.description,
      metadata: {
        workspaceId: params.workspaceId,
        paymentType: 'recurring',
      },
    };

    this.logger.log(
      `Creating recurring payment: workspaceId=${params.workspaceId}, amount=${body.amount.value} ${body.amount.currency}, methodId=${params.paymentMethodId.slice(0, 8)}...`,
    );

    const response = await fetch(`${this.apiUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.encodeBasicAuth()}`,
        'Idempotence-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      this.logger.error(
        `YooKassa recurring API error: ${response.status} ${response.statusText} — ${errorBody}`,
      );
      throw new Error(
        `YooKassa recurring payment failed: ${response.status} ${response.statusText}`,
      );
    }

    const result = (await response.json()) as Record<string, unknown>;

    return {
      confirmationUrl: '', // No redirect for recurring payments
      providerTransactionId: result.id as string,
      raw: result as Record<string, unknown>,
    };
  }

  async cancelSubscription(
    _params: CancelSubscriptionParams,
  ): Promise<void> {
    // YooKassa does not have a subscription model for MVP.
    // Cancellation is handled locally in BillingService (DB status update).
    // In Phase 2 with T-Bank/Stripe, this method would call the provider API.
    this.logger.log(
      `Local cancellation: workspaceId=${_params.workspaceId}`,
    );
  }

  async getPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      const response = await fetch(
        `${this.apiUrl}/payment_methods?customer_id=${encodeURIComponent(customerId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${this.encodeBasicAuth()}`,
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Failed to fetch payment methods: ${response.status}`,
        );
        return [];
      }

      const result = (await response.json()) as Record<string, unknown>;
      const items = (result.items ?? []) as Array<Record<string, unknown>>;

      return items.map((item) => ({
        id: item.id as string,
        type: (item.type as string) ?? 'unknown',
        last4: ((item.card as Record<string, unknown>)?.last4 as string) ?? undefined,
        expiryMonth: (item.card as Record<string, unknown>)?.expiry_month as number | undefined,
        expiryYear: (item.card as Record<string, unknown>)?.expiry_year as number | undefined,
      }));
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get payment methods: ${(error as Error).message}`,
      );
      return [];
    }
  }

  validateWebhookSignature(
    payload: string,
    signature: string,
  ): boolean {
    try {
      const computedHmac = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(computedHmac),
        Buffer.from(signature),
      );

      if (!isValid) {
        this.logger.warn('YooKassa webhook signature validation failed');
      }

      return isValid;
    } catch (error: unknown) {
      this.logger.error(
        `YooKassa webhook signature validation error: ${(error as Error).message}`,
      );
      return false;
    }
  }

  parseWebhookEvent(payload: Record<string, unknown>): WebhookEvent {
    const event = payload.event as string | undefined;
    const objectData = (payload.object ?? payload) as Record<string, unknown>;

    const amount = objectData.amount as Record<string, unknown> | undefined;
    const metadata = (objectData.metadata ??
      payload.metadata ??
      {}) as Record<string, unknown>;

    const eventType =
      event === 'payment.succeeded' || event === 'payment.canceled'
        ? event
        : 'payment.canceled';

    // Detect recurring payment by metadata
    const isRecurring = metadata.paymentType === 'recurring';

    // Extract payment method ID from the saved payment method
    const paymentMethod = objectData.payment_method as Record<string, unknown> | undefined;
    const paymentMethodId = paymentMethod?.id as string | undefined;
    const savedPaymentMethod =
      (objectData.payment_method as Record<string, unknown> | undefined)
        ?.saved as boolean | undefined;

    return {
      eventType,
      providerTransactionId: (objectData.id as string) ?? '',
      providerCustomerId: (objectData.payer as Record<string, unknown>)
        ?.customerId as string | undefined,
      workspaceId: (metadata.workspaceId as string) ?? '',
      isRecurring,
      paymentMethodId: paymentMethodId ?? (savedPaymentMethod ? paymentMethodId : undefined),
      amount: amount?.value as string ?? '0.00',
      currency: amount?.currency as string ?? 'RUB',
      raw: payload,
    };
  }

  /**
   * Encode shop ID and secret key for HTTP Basic Auth per RFC 7617.
   */
  private encodeBasicAuth(): string {
    return Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');
  }
}
