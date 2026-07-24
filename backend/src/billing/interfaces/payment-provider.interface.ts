/**
 * Unified payment provider interface (Strategy Pattern — ADR-005).
 *
 * Each concrete implementation (YooKassa, T-Bank, Stripe) encapsulates
 * all vendor-specific logic behind this interface so that BillingService
 * never depends on a particular provider directly.
 */

// ── Shared types ─────────────────────────────────────────────────────────────

export interface CreatePaymentParams {
  /** Amount in minor units (e.g., 99000 = 990,00 RUB) */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Workspace identifier attached as payment metadata */
  workspaceId: string;
  /** Human-readable payment description shown on hosted page */
  description: string;
  /** URL the provider redirects the user to after success */
  returnUrl: string;
  /** Provider-specific idempotency key (UUID v4) */
  idempotencyKey?: string;
  /** Whether to save the payment method for recurring payments */
  savePaymentMethod?: boolean;
}

export interface PaymentResponse {
  /** URL the user is redirected to for payment confirmation */
  confirmationUrl: string;
  /** Provider-side payment/transaction identifier */
  providerTransactionId: string;
  /** Saved payment method ID (if savePaymentMethod was true) */
  paymentMethodId?: string;
  /** Raw provider response (for logging / debugging) */
  raw?: Record<string, unknown>;
}

export interface WebhookEvent {
  /** Normalised event type: payment.succeeded | payment.canceled */
  eventType: 'payment.succeeded' | 'payment.canceled';
  /** Provider-side transaction ID */
  providerTransactionId: string;
  /** Provider-side customer ID (if available) */
  providerCustomerId?: string;
  /** Workspace ID extracted from payment metadata */
  workspaceId: string;
  /** Whether this is a recurring (auto-renewal) payment */
  isRecurring?: boolean;
  /** Saved payment method ID (if returned by provider) */
  paymentMethodId?: string;
  /** Payment amount (decimal string to avoid float issues) */
  amount: string;
  /** ISO 4217 currency */
  currency: string;
  /** Raw provider payload (for logging) */
  raw: Record<string, unknown>;
}

// ── Recurring payment types (TASK-007.2) ─────────────────────────────────

export interface RecurringPaymentParams {
  /** Workspace identifier */
  workspaceId: string;
  /** Amount in minor units */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Human-readable payment description */
  description: string;
  /** Saved payment method token for auto-charge */
  paymentMethodId: string;
  /** Provider-specific idempotency key (UUID v4) */
  idempotencyKey?: string;
}

export interface CancelSubscriptionParams {
  /** Workspace identifier */
  workspaceId: string;
  /** Provider-specific subscription ID (if applicable) */
  providerSubscriptionId?: string;
}

export interface PaymentMethod {
  id: string;
  type: string; // 'bank_card' | 'yoo_money' | 'sberbank' | etc.
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

/**
 * Token used for NestJS DI — must match the provider binding in BillingModule.
 */
export const PAYMENT_PROVIDER_TOKEN = 'PAYMENT_PROVIDER';

/**
 * Provider-agnostic payment strategy contract.
 *
 * Every method must be stateless so the provider can be swapped at DI level.
 */
export interface IPaymentProvider {
  // ── Core methods (TASK-007.1) ────────────────────────────────────────────

  /**
   * Create a one-time payment and return a confirmation URL for redirect.
   */
  createPayment(params: CreatePaymentParams): Promise<PaymentResponse>;

  /**
   * Validate an incoming webhook signature.
   *
   * The provider manages its own secret internally via ConfigService.
   */
  validateWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Normalise a provider-specific webhook payload into our unified format.
   */
  parseWebhookEvent(payload: Record<string, unknown>): WebhookEvent;

  /**
   * Human-readable provider name (e.g., "YooKassa").
   */
  getProviderName(): string;

  // ── Recurring payment methods (TASK-007.2) ───────────────────────────────

  /**
   * Create a recurring (auto-renewal) payment using a saved payment method.
   * No user redirect — charges the saved payment method directly.
   */
  createRecurringPayment(
    params: RecurringPaymentParams,
  ): Promise<PaymentResponse>;

  /**
   * Cancel an active subscription.
   * For YooKassa (MVP), this is a local cancellation (no provider API call).
   */
  cancelSubscription(params: CancelSubscriptionParams): Promise<void>;

  /**
   * Get saved payment methods for a customer.
   */
  getPaymentMethods(customerId: string): Promise<PaymentMethod[]>;
}
