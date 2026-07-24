# \*\*Файл: `03\_Architecture\_and\_Design/Billing\_Design.md`\*\*

# 

# ```markdown

# \# Billing Design

# 

# \## Overview

# The monetization model for KnowledgeVault is based on a SaaS subscription for content creators (Creators). Users with the `VIEWER` role use the platform for free within the limits defined for the MVP.

# 

# The billing architecture is designed using the \*\*Strategy Pattern\*\*, allowing easy integration of various payment providers (YooKassa, T-Bank, Stripe) without modifying the core business logic. See \[ADR-005](../07\_Management\_and\_Process/ADR/005\_Payment\_Provider\_Selection.md).

# 

# \## Pricing Model (MVP)

# 

# \### Free Tier (VIEWER)

# \- \*\*Price:\*\* 0 ₽/month

# \- \*\*Limits:\*\*

# &#x20; - View up to 5 documents

# &#x20; - Basic AI assistant (10 queries/day)

# &#x20; - Mandatory watermarks on all documents

# 

# \### Pro Subscription (CREATOR)

# \- \*\*Price:\*\* 990 ₽/month

# \- \*\*Features:\*\*

# &#x20; - Unlimited documents

# &#x20; - Advanced AI assistant (100 queries/day)

# &#x20; - Full DRM configuration (watermark, sessions, text selection)

# &#x20; - Advanced view analytics

# &#x20; - Priority support

# 

# \### Enterprise (Phase 2)

# \- \*\*Price:\*\* Custom

# \- \*\*Features:\*\* Multi-workspace, Custom branding, SLA, Dedicated support.

# 

# \## Architecture: Strategy Pattern

# 

# The billing system is decoupled from any specific payment provider API. All provider-specific logic is encapsulated within implementations of the `IPaymentProvider` interface.

# 

# ```typescript

# // backend/src/billing/interfaces/payment-provider.interface.ts

# export interface IPaymentProvider {

# &#x20; createPayment(params: CreatePaymentParams): Promise<PaymentResponse>;

# &#x20; validateWebhookSignature(payload: string, signature: string, secret: string): boolean;

# &#x20; parseWebhookEvent(payload: any): WebhookEvent;

# &#x20; getProviderName(): string;

# }

# ```

# 

# \*\*Active Provider for MVP:\*\* `YooKassaPaymentProvider`.

# \*\*Planned Providers (Phase 2):\*\* `TBankPaymentProvider` (T-Bank), `StripePaymentProvider`.

# 

# Provider selection is managed via the `PAYMENT\_PROVIDER\_ACTIVE` environment variable and the NestJS DI container.

# 

# \## Database Schema (Prisma)

# 

# For the MVP, we extend the `Workspace` model with subscription fields. In Phase 2, when adding payment history and invoices, a separate `Subscription` and `Payment` model will be introduced.

# 

# ```prisma

# model Workspace {

# &#x20; id                    String    @id @default(uuid())

# &#x20; name                  String

# &#x20; ownerId               String

# &#x20; owner                 User      @relation(fields: \[ownerId], references: \[id])

# &#x20; 

# &#x20; // Billing fields (MVP)

# &#x20; subscriptionStatus    String    @default("FREE") // FREE, ACTIVE, CANCELED, EXPIRED

# &#x20; subscriptionPlan      String    @default("FREE") // FREE, PRO

# &#x20; subscriptionExpiresAt DateTime?

# &#x20; 

# &#x20; // Provider-specific ID (MVP: YooKassa)

# &#x20; // In Phase 2, move to a separate PaymentMethods table

# &#x20; activePaymentProvider String?   @default("yookassa") 

# &#x20; providerCustomerId    String?   @unique // Client ID in YooKassa/Stripe

# &#x20; 

# &#x20; documents             Document\[]

# &#x20; createdAt             DateTime  @default(now())

# &#x20; updatedAt             DateTime  @updatedAt

# &#x20; 

# &#x20; @@index(\[ownerId])

# }

# ```

# 

# \## Subscription Lifecycle

# 

# 1\. \*\*Initiation:\*\* User clicks "Subscribe". `BillingService` calls `IPaymentProvider.createPayment()`.

# 2\. \*\*Payment:\*\* User is redirected to the provider's hosted payment page (Redirect flow).

# 3\. \*\*Webhook:\*\* Provider sends a `payment.succeeded` event to `POST /v1/billing/webhook`.

# 4\. \*\*Activation:\*\* `BillingService` verifies the signature via `IPaymentProvider.validateWebhookSignature()`. On success, it updates the `Workspace`: `status = ACTIVE`, `expiresAt = now + 30 days`.

# 5\. \*\*Expiration (Cron/Job):\*\* If `expiresAt < now` and auto-renewal is not configured, status changes to `EXPIRED`.

# 

# \## Webhook Events (Abstract)

# 

# Regardless of the provider, the system normalizes incoming events into a unified `WebhookEvent` format:

# 

# ```typescript

# type WebhookEventType = 'PAYMENT\_SUCCESS' | 'PAYMENT\_FAILED' | 'SUBSCRIPTION\_CANCELED';

# 

# interface WebhookEvent {

# &#x20; type: WebhookEventType;

# &#x20; providerTransactionId: string;

# &#x20; workspaceId: string; // Extracted from payment metadata

# &#x20; amount?: number;

# &#x20; currency?: string;

# }

# ```

# 

# \## Security \& Compliance

# 

# \### PCI DSS

# \- KnowledgeVault \*\*never\*\* touches card data (PAN, CVV).

# \- All card input fields reside on the providers' secure domains (YooKassa/Stripe).

# \- We only store `providerCustomerId` and `providerTransactionId`.

# 

# \### Webhook Security

# \- All incoming webhooks \*\*must\*\* undergo cryptographic signature verification (HMAC-SHA256 for YooKassa, Stripe Signature Header for Stripe).

# \- Invalid requests are rejected with HTTP 400 before any processing begins.

# \- Webhook processing must be \*\*idempotent\*\* (re-delivery of the same event must not duplicate database changes).

# 

# \## Metrics \& Analytics

# 

# Key metrics for monitoring business health:

# \- \*\*MRR (Monthly Recurring Revenue)\*\*

# \- \*\*Churn Rate\*\*

# \- \*\*LTV (Lifetime Value)\*\*

# \- \*\*Webhook Success Rate\*\* (Monitoring integration reliability)

# 

# \## Related Documents

# \- \[ADR-005: Payment Provider Strategy](../07\_Management\_and\_Process/ADR/005\_Payment\_Provider\_Selection.md)

# \- \[API\_Contracts.md](./API\_Contracts.md)

# \- \[Backend\_Architecture.md](./Backend\_Architecture.md)

# \- \[Security\_Requirements.md](../04\_Security\_and\_Access/Security\_Requirements.md)

# \- \[Integrations.md](../05\_Infrastructure\_and\_Operations/Integrations.md)

# ```

