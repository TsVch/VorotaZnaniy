```markdown
# File: 05_Infrastructure_and_Operations/Integrations.md

# Integrations
 > **This document defines all external service integrations, their contracts, fallback strategies, and security considerations for the KnowledgeVault SaaS platform.**
 > 
 > **Related Documents:** 
 > - [System Architecture](../03_Architecture_and_Design/System_Architecture.md)
 > - [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md)
 > - [Security Requirements](../04_Security_and_Access/Security_Requirements.md)
 > - [Infrastructure](./Infrastructure.md)
 > - [API Contracts](../03_Architecture_and_Design/API_Contracts.md)
 > - [Billing Design](../03_Architecture_and_Design/Billing_Design.md)
 > - [ADR-005: Payment Provider Strategy](../07_Management_and_Process/ADR/005_Payment_Provider_Selection.md)
 ---
 ## 🎯 Integration Strategy Overview
 ### Core Principles
 1. **Loose Coupling**: All integrations are abstracted behind service interfaces for easy replacement.
 2. **Resilience**: Circuit breakers, retries, and fallbacks for every external dependency.
 3. **Cost Control**: Strict rate limiting and usage tracking for paid APIs (especially LLM).
 4. **Security First**: All credentials stored in secrets manager, never in code.
 5. **Observability**: Every integration has metrics, logs, and alerts.
 ### Integration Categories
 | Category | Services | Criticality | Cost Impact |
 | :--- | :--- | :--- | :--- |
 | **Payments** | YooKassa (MVP), T-Bank, Stripe (Phase 2) | Critical | Revenue |
 | **AI/LLM** | OpenAI, Anthropic | High | High (OpEx) |
 | **Email** | SendGrid / Resend | High | Low |
 | **Storage** | AWS S3 / Cloudflare R2 | Critical | Medium |
 | **OAuth** | Google, GitHub | Medium | Free |
 | **CDN/WAF** | Cloudflare | Critical | Low |
 | **Monitoring** | Sentry, Vercel Analytics | High | Low |
 ---
 ## 💳 1. Payment Integration (Strategy Pattern)
 ### Purpose
 - Process one-time payments for document purchases (buyers) and subscriptions (creators).
 - Handle webhooks for access granting and subscription lifecycle.
 - Support multiple providers via `IPaymentProvider` interface (ADR-005).
 ### Architecture
 All payment logic is encapsulated behind the `IPaymentProvider` interface. The `BillingService` depends only on this abstraction.
 ```typescript
 interface IPaymentProvider {
   createPayment(params: CreatePaymentParams): Promise<PaymentResponse>;
   validateWebhookSignature(payload: string, signature: string, secret: string): boolean;
   parseWebhookEvent(payload: any): WebhookEvent;
   getProviderName(): string;
 }
 ```
 **Active Provider (MVP):** `YooKassaPaymentProvider`.
 **Planned Providers (Phase 2):** `TBankPaymentProvider`, `StripePaymentProvider`.
 ### Integration Points (YooKassa MVP)
 #### 1.1 Payment Creation
 **Flow:**
 ```text
 1. User initiates payment (subscription or purchase)
 2. Frontend calls POST /v1/billing/create-payment
 3. Backend calls IPaymentProvider.createPayment()
 4. YooKassaPaymentProvider calls YooKassa API
 5. Returns confirmation_url to frontend
 6. User completes payment on YooKassa hosted page
 7. YooKassa sends webhook: payment.succeeded
 8. Backend validates HMAC-SHA256 signature
 9. Backend processes event (grants access/activates subscription)
 ```
 **Implementation (YooKassa):**
 ```typescript
 // yookassa.provider.ts
 async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
   const payment = await this.yookassa.createPayment({
     amount: { value: params.amount, currency: 'RUB' },
     confirmation: { type: 'redirect', return_url: params.returnUrl },
     metadata: { workspace_id: params.workspaceId },
     description: params.description,
   });
   return {
     paymentId: payment.id,
     confirmationUrl: payment.confirmation.confirmation_url,
     status: 'pending',
   };
 }
 ```
 #### 1.2 Webhook Handling
 **Security:**
 - Verify HMAC-SHA256 signature using `YOOKASSA_WEBHOOK_SECRET`.
 - Idempotency: Store processed event IDs in Redis/DB to prevent duplicate processing.
 - Retry logic: YooKassa retries failed webhooks; our endpoint must be idempotent.
 **Implementation:**
 ```typescript
 // webhook.service.ts
 async handleWebhook(payload: string, signature: string) {
   // 1. Validate signature via active provider
   if (!this.paymentProvider.validateWebhookSignature(payload, signature, this.webhookSecret)) {
     throw new BadRequestException('Invalid signature');
   }
   
   // 2. Parse event
   const event = this.paymentProvider.parseWebhookEvent(JSON.parse(payload));
   
   // 3. Check idempotency
   const processed = await this.redis.get(`payment_event:${event.providerTransactionId}`);
   if (processed) return { received: true };
   
   // 4. Process event
   switch (event.type) {
     case 'PAYMENT_SUCCESS':
       await this.handlePaymentSuccess(event);
       break;
     // ... other events
   }
   
   // 5. Mark as processed
   await this.redis.set(`payment_event:${event.providerTransactionId}`, '1', 'EX', 86400);
   return { received: true };
 }
 ```
 ### Cost & Rate Limits (YooKassa)
 - **Transaction Fee:** ~2.8% + fixed fee per transaction (varies by payment method).
 - **Webhook Rate:** No hard limit, but design for idempotency.
 - **API Rate:** 100 requests/second (sufficient for MVP).
 ### Fallback Strategy
 - **Payment Failure:** Show clear error message, allow retry.
- **Webhook Failure:** YooKassa retries automatically; manual reconciliation dashboard for admins.
 - **Provider Downtime:** Queue non-critical operations, process when provider recovers.
 ---
 ## 🤖 2. AI/LLM Integration (OpenAI / Anthropic)
 ### Purpose
 - Generate document embeddings for RAG (Retrieval-Augmented Generation).
 - Generate summaries, quizzes, flashcards.
 - Power AI Q&A assistant.
 ### Integration Points
 #### 2.1 Embeddings Generation (Document Processing)
 **Flow:**
 1. Document uploaded → AI Worker picks up job.
 2. Parse document (PDF → text).
 3. Chunk text (500-1000 tokens per chunk, 100 token overlap).
 4. For each chunk: Call OpenAI Embeddings API (`text-embedding-3-small`).
 5. Store embedding in pgvector.
 6. Mark document as "ready".
 **Cost Control:**
 - Model: `text-embedding-3-small` ($0.02 / 1M tokens).
 - Batching: Process up to 100 chunks per API call.
 - Caching: Cache embeddings by content hash (avoid re-processing unchanged chunks).
 - Limit: Max 500 pages per document (MVP).
 #### 2.2 AI Q&A (RAG Pipeline)
 **Flow:**
 1. User asks question → POST /v1/ai/query.
 2. Backend validates session and access.
 3. Backend calls AI Worker: `generate_answer(question, document_id)`.
 4. AI Worker retrieves top-5 relevant chunks, builds prompt, calls OpenAI Chat API (`gpt-4o-mini`).
 5. Return answer + sources to frontend.
 **Cost Control:**
 - Model: `gpt-4o-mini` ($0.15 / 1M input tokens, $0.60 / 1M output tokens).
 - Rate Limiting: 10 queries/min per user (enforced via Redis).
 - Token Budget: Max 2000 tokens per query (input + output).
 - Caching: Cache identical questions (hash-based, TTL: 24h).
 #### 2.3 Summary Generation (Async on Upload)
 **Flow:**
 1. Document processed → trigger summary generation.
 2. Extract first 10 pages (or full text if < 5000 tokens).
 3. Call OpenAI Chat API with summarization prompt.
 4. Store summary in document metadata (JSONB field).
 **Cost Control:**
 - Generate once per document version.
 - Cache indefinitely (until document re-processed).
 - Max 1000 tokens output.
 ### Fallback Strategy
 - **OpenAI Downtime:** Queue requests, retry with exponential backoff (max 3 retries).
 - **Rate Limit Hit:** Return `429 TOO_MANY_REQUESTS` with `Retry-After` header.
 - **High Cost Alert:** If daily spend > $10, send Slack alert to CTO.
 ---
 ## 📧 3. Email Integration (SendGrid / Resend)
 ### Purpose
 - Send magic links for passwordless login.
 - Send purchase confirmations.
 - Send security alerts (session terminated, suspicious activity).
 ### Integration Points
 #### 3.1 Magic Link Email
 **Flow:**
 1. User requests magic link → POST /v1/auth/magic-link.
 2. Backend generates token (32 bytes, base64).
 3. Backend stores token in Redis (TTL: 15 min).
 4. Backend calls email service: `send_magic_link(email, token)`.
 5. Email service sends email with link.
 #### 3.2 Purchase Confirmation
 **Flow:**
 1. Payment provider webhook: `payment.succeeded`.
 2. Backend creates access_grant.
 3. Backend calls email service: `send_purchase_confirmation(email, document_title, access_link)`.
 #### 3.3 Security Alerts
 **Use Cases:**
 - Session terminated due to concurrent login.
 - Password changed.
 - Suspicious activity detected.
 ### Cost & Rate Limits
 - **Resend:** Free tier (3000 emails/month), then $20/15k emails.
 - **Rate Limit:** 10 emails/min per user (prevent abuse).
 - **Daily Limit:** 100 emails/user/day.
 ### Fallback Strategy
 - **Email Service Downtime:** Queue emails, retry with backoff.
 - **Bounce Handling:** Mark invalid emails, prevent retries.
 ---
 ## ️ 4. Object Storage Integration (AWS S3 / Cloudflare R2)
 ### Purpose
 - Store raw uploaded documents (PDF, EPUB, ZIP).
 - Store processed document tiles (for secure viewer).
 - Serve files via presigned URLs (never direct access).
 ### Integration Points
 #### 4.1 Upload Flow (Direct-to-S3)
 **Flow:**
 1. Frontend calls POST /v1/documents/upload-init.
 2. Backend generates presigned PUT URL (5 min expiry).
 3. Frontend uploads file directly to S3 via PUT request.
 4. Frontend calls POST /v1/documents/:id/upload-complete.
 5. Backend verifies file exists in S3.
 6. Backend triggers AI processing job.
 #### 4.2 View Flow (Presigned GET URLs)
 **Flow:**
 1. Frontend calls GET /v1/viewer/sessions/:sessionId/pages/:pageNumber.
 2. Backend validates session.
 3. Backend generates presigned GET URL (1 min expiry).
 4. Frontend fetches image via presigned URL.
 5. Frontend renders on canvas + overlay watermark.
 ### Cost & Storage Strategy
 - **Raw uploads:** $0.023/GB/month (S3 Standard).
 - **Processed tiles:** $0.023/GB/month.
 - **Optimization:** Compress images to WebP (50% smaller than PNG). Use Cloudflare R2 for egress-free bandwidth.
 ### Fallback Strategy
 - **S3 Downtime:** Queue uploads, retry with backoff.
 - **Presigned URL Expiry:** Frontend requests new URL on 403 error.
 ---
 ## 🔐 5. OAuth Integration (Google, GitHub)
 ### Purpose
 - Allow users to sign up/login with Google or GitHub accounts.
 - Reduce friction for creators (no password to remember).
 ### Integration Points
 #### 5.1 Google OAuth
 **Flow:**
 1. User clicks "Sign in with Google".
 2. Frontend redirects to Google OAuth consent screen.
 3. User grants permission.
 4. Google redirects to /v1/auth/oauth/callback?code=...&state=...
 5. Backend exchanges code for access token, fetches profile, creates/links user.
 6. Backend generates JWT tokens.
 #### 5.2 GitHub OAuth
 Similar flow, but with GitHub API endpoints.
 ### Security Considerations
 - **State Parameter:** Always validate to prevent CSRF.
 - **Email Verification:** Only accept OAuth accounts with verified emails.
 - **Scope:** Request minimal scopes (`openid`, `email`, `profile`).
 ### Fallback Strategy
 - **OAuth Provider Downtime:** Show error message, suggest email/password login.
 ---
 ## 🌐 6. CDN/WAF Integration (Cloudflare)
 ### Purpose
 - Cache static assets (frontend, processed document tiles).
 - DDoS protection.
 - Web Application Firewall (WAF).
 ### Configuration
 - **Caching Rules:** Frontend Assets (1 year), Document Tiles (5 min), API Responses (No caching).
 - **WAF Rules:** Block SQL injection, XSS, known malicious IPs. Rate limit: 100 requests/min per IP (global).
 ### Cost
 - **Free Tier:** Sufficient for MVP (unlimited bandwidth, basic WAF).
 ---
 ## 📊 7. Monitoring & Observability
 ### 7.1 Error Tracking (Sentry)
 - Automatically captures unhandled exceptions.
 - Manual capture for business logic errors.
 ### 7.2 Analytics (Vercel Analytics)
 - Real-user metrics (RUM) for frontend performance.
 - Core Web Vitals tracking.
 ### 7.3 Custom Metrics
 **Key Metrics to Track:**
 - Document upload success rate.
 - AI query latency (p50, p95, p99).
 - Viewer session duration.
 - **Payment webhook processing time.**
 - Presigned URL generation time.
 ---
 ## 🔧 8. Integration Testing Strategy
 ### Unit Tests
 - Mock all external services (Payment Provider, OpenAI, Resend, S3).
 - Test service interfaces, not implementations.
 ### Integration Tests
 - Use test accounts for YooKassa (test mode).
 - Use mock OpenAI responses (VCR pattern).
 - Use local S3-compatible storage (MinIO) for tests.
 ### E2E Tests
 - Full purchase flow (YooKassa test mode → webhook → access grant).
 - Full AI query flow (question → RAG → answer).
 - Full email flow (magic link → login).
 ---
 ## 📌 Key Takeaways for Implementation (Freebuff)
 1. **Abstract all integrations:** Use service interfaces (e.g., `IPaymentProvider`), never call external APIs directly from controllers.
 2. **Handle failures gracefully:** Every integration must have retry logic, circuit breakers, and fallbacks.
 3. **Track costs:** Log every paid API call (AI, Payments) for billing and optimization.
 4. **Security first:** Verify webhooks (HMAC-SHA256 for YooKassa), validate OAuth state, never expose secrets.
 5. **Idempotency:** All webhooks and critical operations must be idempotent.
 6. **Rate limiting:** Protect against abuse and runaway costs (especially AI).
 7. **Observability:** Every integration must have metrics, logs, and alerts.
 ---
 ## 🔗 Related Documents
 - [System Architecture](../03_Architecture_and_Design/System_Architecture.md) - High-level integration points
 - [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) - Service layer design
 - [API Contracts](../03_Architecture_and_Design/API_Contracts.md) - Webhook endpoints, error handling
 - [Security Requirements](../04_Security_and_Access/Security_Requirements.md) - Webhook validation, secrets management
 - [Infrastructure](./Infrastructure.md) - Cloud provider configuration
 - [Deployment](./Deployment.md) - Environment variables, secrets injection
 - [Billing Design](../03_Architecture_and_Design/Billing_Design.md) - Payment provider strategy
 - [ADR-005: Payment Provider Strategy](../07_Management_and_Process/ADR/005_Payment_Provider_Selection.md) - YooKassa selection and architecture
```