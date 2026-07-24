# ```markdown

# \# File: 07\_Management\_and\_Process/ADR/005\_Payment\_Provider\_Selection.md

# 

# \# ADR-005: Payment Provider Strategy and YooKassa Selection for MVP

# 

# \## Status

# \*\*Accepted\*\* — 2026-07-23

# 

# \## Context

# KnowledgeVault is targeting the Russian market at the MVP stage. The target audience includes content creators and organizations from Russia.

# 

# \*\*Problem:\*\*

# 1\. Stripe discontinued support for Russian merchants and RUB transactions, making it unsuitable for MVP.

# 2\. Direct integration with a single specific provider (hardcoding) would create technical debt and complicate international expansion in Phase 2.

# 3\. Solution must support MIR cards, SBP (System of Fast Payments), and comply with 152-FZ.

# 

# \*\*Architecture requirements:\*\*

# \- Ability to switch or add payment providers (YooKassa, T-Bank, Stripe) without changing billing business logic.

# \- Isolation of vendor-specific code (SDKs, webhook formats, signature cryptography).

# 

# \## Decision

# 

# \### 1. Architecture Solution: Strategy Pattern

# Implement `IPaymentProvider` abstraction (interface) for all payment-related operations.

# 

# \*\*Interface contract:\*\*

# ```typescript

# interface IPaymentProvider {

# &#x20; createPayment(params: CreatePaymentParams): Promise<PaymentResponse>;

# &#x20; validateWebhookSignature(payload: string, signature: string, secret: string): boolean;

# &#x20; parseWebhookEvent(payload: any): WebhookEvent;

# &#x20; getProviderName(): string;

# }

# ```

# 

# In NestJS `BillingModule`, use Dependency Injection to get the active strategy via token (e.g., `@Inject('PAYMENT\_PROVIDER')`). Provider selection will be managed via environment variable `PAYMENT\_PROVIDER\_ACTIVE=yookassa`.

# 

# \### 2. Provider Selection for MVP

# \*\*YooKassa\*\* selected as the single implementation (`YooKassaPaymentProvider`) for MVP.

# 

# \*\*Selection criteria:\*\*

# \- Market leader in Russia, supports MIR/SBP.

# \- Official Node.js SDK (`yookassa`).

# \- Transparent API and reliable webhook delivery.

# \- Compliance with PCI DSS and 152-FZ.

# 

# \### 3. Expansion Plan (Phase 2)

# \- \*\*T-Bank (Tinkoff Kassa):\*\* Second strategy for Russia. Will be implemented as `TBankPaymentProvider`. Valuable as a backup channel and for improved conversion through native Tinkoff widgets.

# \- \*\*Stripe:\*\* Third strategy for international users. Will be implemented as `StripePaymentProvider`.

# 

# \## Consequences

# 

# \### Positive

# \- \*\*Scalability by Design:\*\* Adding a new provider requires only one new class implementing the interface. `BillingService` and controllers remain untouched.

# \- \*\*Testability:\*\* Easy to mock `IPaymentProvider` in business logic unit tests.

# \- \*\*Business Agility:\*\* Ability to quickly switch traffic to a backup provider in case of failures or compliance changes.

# 

# \### Negative

# \- \*\*Initial Overhead:\*\* Requires writing slightly more code at the start (interface, DI provider, module) compared to direct YooKassa SDK calls. (Accepted as justified cost for scalability).

# 

# \## Technical Implementation Guidelines (for Freebuff)

# 1\. Create `backend/src/billing/interfaces/payment-provider.interface.ts`.

# 2\. Implement `backend/src/billing/providers/yookassa.provider.ts`.

# 3\. Register provider in `BillingModule` using `@Module({ providers: \[{ provide: 'PAYMENT\_PROVIDER', useClass: YooKassaPaymentProvider }] })`.

# 4\. All YooKassa API references must be encapsulated within `YooKassaPaymentProvider`.

# 

# \## Related Documents

# \- \[Billing\_Design.md](../../03\_Architecture\_and\_Design/Billing\_Design.md)

# \- \[Backend\_Architecture.md](../../03\_Architecture\_and\_Design/Backend\_Architecture.md)

# \- \[Security\_Requirements.md](../../04\_Security\_and\_Access/Security\_Requirements.md)

# \- \[Integrations.md](../../05\_Infrastructure\_and\_Operations/Integrations.md)

# ```

