```markdown
# File: 04_Security_and_Access/Security_Requirements.md

# Security Requirements
 > **This document defines the comprehensive security strategy, DRM mechanisms, cryptographic standards, and compliance requirements for the KnowledgeVault SaaS platform.**
 > 
 > **Related Documents:** 
 > - [System Architecture](../03_Architecture_and_Design/System_Architecture.md)
 > - [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md)
 > - [Frontend Architecture](../03_Architecture_and_Design/Frontend_Architecture.md)
 > - [Database Design](../03_Architecture_and_Design/Database_Design.md)
 > - [API Contracts](../03_Architecture_and_Design/API_Contracts.md)
 > - [Authentication](./Authentication.md)
 > - [Authorization](./Authorization.md)
 > - [Roles and Permissions](./Roles_and_Permissions.md)
 > - [Infrastructure](../05_Infrastructure_and_Operations/Infrastructure.md)
 > - [Billing Design](../03_Architecture_and_Design/Billing_Design.md)
 > - [ADR-005: Payment Provider Strategy](../07_Management_and_Process/ADR/005_Payment_Provider_Selection.md)
 ---
 ## 🎯 Core Security Philosophy
 > **Absolute copy protection is impossible. Our objective is to maximize protection while maintaining excellent user experience. We make the legitimate copy so much more valuable than the pirated one that purchasing becomes the rational choice.**
 ### Security Principles
 1. **Security by Design**: Security is not an afterthought; it's embedded in every architectural decision.
 2. **Defense in Depth**: Multiple layers of protection (frontend, backend, database, infrastructure).
 3. **Zero Trust**: No implicit trust between services, users, or components.
 4. **Least Privilege**: Every user, service, and component has only the minimum permissions required.
 5. **Economic Deterrence**: Make piracy technically difficult and economically unattractive.
 6. **Auditability**: Every security-relevant action is logged and traceable.
 7. **Fail Secure**: On error, deny access rather than grant it.
 ---
 ## 🎯 Architectural Decision Summary
 | Aspect | Decision | Rationale | ADR Reference |
 | :--- | :--- | :--- | :--- |
 | DRM Strategy | Economic deterrence over technical lock | Better UX, harder to bypass | ADR-025 |
 | Rendering | Canvas-based (no native PDF viewer) | Prevents direct file access | ADR-004 |
 | Watermarking | Dynamic visible + session-bound | Leak tracing, psychological deterrent | ADR-026 |
 | Session Control | Max 2 concurrent devices + heartbeat | Prevents account sharing | ADR-022 |
 | File Storage | Private S3 + presigned URLs (5 min) | No direct file access, time-limited | ADR-005 |
 | Password Hashing | bcrypt (cost factor 12) | Industry standard, GPU-resistant | ADR-018 |
 | Token Strategy | Short-lived access + rotated refresh | Minimizes damage from leaks | ADR-019 |
 | Rate Limiting | Sliding window per user/IP | Prevents abuse, protects LLM costs | ADR-027 |
 | Secrets Mgmt | Environment variables + vault | No hardcoded secrets | ADR-028 |
 | Compliance | GDPR-ready by design | Legal requirement for EU market | ADR-029 |
 | Payment Providers | Strategy Pattern (YooKassa MVP) | Scalability, provider isolation | ADR-005 |
 ---
 ## 🛡️ 1. Content Protection & DRM Strategy
 ### 1.1 Multi-Layer Content Protection
 ```text
 ─────────────────────────────────────────────────────────────┐
 │ Layer 1: Legal Deterrence                                   │
 │ - Terms of Service, copyright notices, user agreements      │
 ├─────────────────────────────────────────────────────────────┤
 │ Layer 2: Economic Deterrence (Primary)                      │
 │ - AI features only in legitimate copy                       │
 │ - Automatic updates for legitimate users                    │
 │ - Completion certificates                                   │
 │ - Progress tracking & personalization                       │
 ├─────────────────────────────────────────────────────────────┤
 │ Layer 3: Technical Deterrence                               │
 │ - Dynamic watermarking (user email + session + timestamp)   │
 │ - Canvas rendering (no native PDF viewer)                   │
 │ - Presigned URLs (5-minute expiry)                          │
 │ - Concurrent session limits (max 2 devices)                 │
 │ - Device fingerprinting                                     │
 │ - Disabled right-click, save-as, print                      │
 ├─────────────────────────────────────────────────────────────┤
 │ Layer 4: Forensic Tracing                                   │
 │ - Watermark audit log (watermarks table)                    │
 │ - Session audit log (sessions table)                        │
 │ - Unique session IDs in watermarks                          │
 │ - IP address tracking per session                           │
 └─────────────────────────────────────────────────────────────┘
 ```
 ### 1.2 Watermarking Requirements
 #### Dynamic Visible Watermark
 - **Content:** User email + short session ID + current date
 - **Appearance:** Semi-transparent (opacity 15-25%), diagonal rotation (-45°)
 - **Distribution:** Grid pattern covering entire viewport, repeated every 200px
 - **Movement:** Subtle shift based on mouse position (anti-screenshot measure)
 - **Immutability:** Rendered in DOM overlay, not baked into canvas image
 #### Implementation Requirements
 ```typescript
 // Watermark must include:
 interface WatermarkData {
   userEmail: string;       // "buyer@example.com"
   sessionIdShort: string;  // First 8 chars of session UUID
   timestamp: string;       // ISO date (YYYY-MM-DD)
   documentId: string;      // For forensic tracing
 }
 ```
 #### Watermark Audit Log
 - Every watermark generation is logged in `watermarks` table
 - Includes: session_id, user_email, user_id, ip_address, timestamp
 - Retention: 2 years (for legal proceedings)
 - Immutable: No DELETE operations allowed
 ### 1.3 Canvas Rendering Security
 #### Requirements
 - Documents rendered to HTML5 `<canvas>` elements only
 - **NEVER** use native `<iframe>`, `<object>`, or `<embed>` tags
 - Page images fetched via presigned URLs (5-minute expiry)
 - Text layer (if enabled) is separate from canvas, with watermark injection on copy
 #### DOM Protection
 ```javascript
 // Mandatory protections
 document.addEventListener('contextmenu', e => e.preventDefault());
 document.addEventListener('selectstart', e => {
   if (!allowTextSelection) e.preventDefault();
 });
 document.addEventListener('keydown', e => {
   if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u'].includes(e.key)) {
     e.preventDefault();
   }
 });
 ```
 #### CSS Protection
 ```css
 .viewer-container {
   user-select: none;
   -webkit-user-select: none;
   -moz-user-select: none;
   -ms-user-select: none;
 }
 ```
 ### 1.4 Copy Protection (When Text Selection Allowed)
 If creator enables text selection, all copied text must be appended with:
 ```text
 ---
 Copied from KnowledgeVault
 User: buyer@example.com
 Session: a1b2c3d4
 Timestamp: 2026-07-21T10:00:00Z
 Document: [Document Title]
 ```
 ---
 ## 🔐 2. Session Management & DRM Enforcement
 ### 2.1 Concurrent Session Limits
 #### Configuration
 - **Default:** 2 concurrent sessions per user per document
 - **Creator-configurable:** 1-5 sessions (based on protection_config)
 - **Enforced at:** session initialization (`POST /v1/viewer/sessions`)
 #### Enforcement Flow
 1. User requests document access
 2. Backend counts active sessions (is_active = true, last_activity < 5min ago)
 3. If count >= max_sessions → reject with 403 CONCURRENT_SESSION_LIMIT
 4. If count < max_sessions → create new session, return session_id
 5. Frontend sends heartbeat every 60 seconds
 6. Backend updates last_activity timestamp
 7. Sessions inactive for 5 minutes → marked is_active = false
 #### Session Termination Triggers
 - User logs in from 3rd device (oldest session terminated)
 - Admin manually terminates session
 - Document deleted by creator
 - Access grant revoked or expired
 - Suspicious activity detected (geo-anomaly, rapid location changes)
 ### 2.2 Device Fingerprinting
 #### Fingerprint Components
 ```javascript
 const fingerprint = hash([
   navigator.userAgent,
   screen.width + 'x' + screen.height,
   Intl.DateTimeFormat().resolvedOptions().timeZone,
   navigator.language,
   navigator.hardwareConcurrency,
 ].join('|'));
 ```
 #### Usage
 - Stored in `sessions.device_fingerprint` (first 16 chars of SHA-256)
 - Used for anomaly detection (same account, different fingerprints from different continents)
 - Not used as primary authentication (can be spoofed)
 ### 2.3 Session Heartbeat
 #### Requirements
 - Frontend sends heartbeat every 60 seconds
 - Payload: `{ session_id, current_page, time_spent_sec }`
 - Backend response: `{ session_valid: true, next_heartbeat_in: 60 }`
 - On `session_valid: false` → frontend shows "Session Terminated" modal
 #### Backend Logic
 ```typescript
 async heartbeat(sessionId: string, userId: string) {
   const session = await prisma.session.findUnique({ where: { id: sessionId } });
   if (!session || session.userId !== userId || !session.isActive) {
     return { valid: false, reason: 'SESSION_TERMINATED' };
   }
   await prisma.session.update({
     where: { id: sessionId },
     data: { lastActivity: new Date() }
   });
   return { valid: true, nextHeartbeatIn: 60 };
 }
 ```
 ---
 ##  3. API Security
 ### 3.1 Rate Limiting
 #### Rate Limit Tiers
 | Endpoint Category | Limit | Window | Scope |
 | :--- | :--- | :--- | :--- |
 | Auth (`/auth/login`) | 5 attempts | 15 min | Per IP |
 | Auth (`/auth/register`) | 3 attempts | 1 hour | Per IP |
 | AI Queries (`/ai/*`) | 10 queries | 1 min | Per User |
 | Viewer Heartbeat | 2 requests | 1 min | Per Session |
 | Document Upload | 5 uploads | 1 hour | Per User |
 | General API | 100 requests | 1 min | Per User |
 | Admin API | 1000 requests | 1 min | Per User |
 | Billing (`/billing/create-payment`) | 10 requests | 1 min | Per User |
 | Billing Webhook (`/billing/webhook`) | 100 requests | 1 min | Per IP |
 #### Implementation
 - Redis-based sliding window counters
 - Rate limit headers in every response:
   ```http
   X-RateLimit-Limit: 100
   X-RateLimit-Remaining: 95
   X-RateLimit-Reset: 1690000000
   ```
 - On limit exceeded → `429 TOO_MANY_REQUESTS` with `Retry-After` header
 ### 3.2 Input Validation
 #### Requirements
 - All inputs validated via DTOs (NestJS `class-validator`) or Pydantic (FastAPI)
 - Strict type checking (TypeScript strict mode)
 - File upload validation:
   - Max size: 500 MB
   - Allowed MIME types: `application/pdf`, `application/epub+zip`, `application/zip`
   - Magic bytes verification (not just extension)
 - SQL injection prevention: Prisma ORM with parameterized queries only
 - XSS prevention: React auto-escaping + CSP headers
 #### Forbidden Patterns
 ```typescript
 // ❌ NEVER DO THIS
 const query = `SELECT * FROM users WHERE email = '${userInput}'`;
 // ✅ ALWAYS DO THIS
 const user = await prisma.user.findUnique({ where: { email: userInput } });
 ```
 ### 3.3 CORS Policy
 ```json
 {
   "origins": [
     "https://app.knowledgevault.com",
     "https://www.knowledgevault.com"
   ],
   "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
   "allowedHeaders": ["Content-Type", "Authorization", "X-Workspace-Id", "X-Idempotency-Key"],
   "credentials": true,
   "maxAge": 86400
 }
 ```
 ### 3.4 CSRF Protection
 - Refresh tokens stored in HttpOnly cookies with `SameSite=Strict`
 - State parameter mandatory for all OAuth flows
 - No state-changing GET requests
 - Origin header validation on POST requests
 ### 3.5 Security Headers
 ```http
 Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
 Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.amazonaws.com https://*.cloudflare.com; connect-src 'self' https://api.knowledgevault.com
 X-Content-Type-Options: nosniff
 X-Frame-Options: DENY
 X-XSS-Protection: 1; mode=block
 Referrer-Policy: strict-origin-when-cross-origin
 Permissions-Policy: camera=(), microphone=(), geolocation=()
 ```
 ---
 ## 🔑 4. Cryptographic Standards
 ### 4.1 Password Storage
 | Parameter | Value | Rationale |
 | :--- | :--- | :--- |
 | Algorithm | bcrypt | Industry standard, GPU-resistant |
 | Cost Factor | 12 | ~250ms per hash, balances security/performance |
 | Salt | Auto-generated per hash | Prevents rainbow table attacks |
 | Min Password Length | 8 characters | NIST recommendation |
 | Complexity | 1 upper, 1 lower, 1 number, 1 special | Enforced via Zod schema |
 ### 4.2 JWT Tokens
 | Token Type | Algorithm | Expiry | Storage |
 | :--- | :--- | :--- | :--- |
 | Access Token | HS256 | 15 minutes | Memory (frontend) |
 | Refresh Token | HS256 | 7 days | HttpOnly cookie |
 | Magic Link Token | Cryptographic random (32 bytes) | 15 minutes | Single-use, Redis |
 #### Token Security
 - Secret keys: 256-bit random, stored in environment variables
 - Token rotation: Refresh tokens rotated on each use
 - Revocation: Refresh tokens stored in Redis with TTL; reuse triggers full session termination
 - No sensitive data in JWT payload (only user ID, email, role, workspace_id)
 ### 4.3 Encryption
 #### At Rest
 - Database: Encrypted volumes (AWS RDS encryption or equivalent)
 - Object Storage: S3 server-side encryption (SSE-S3 or SSE-KMS)
 - Backups: Encrypted at rest with separate key
 #### In Transit
 - All connections: TLS 1.3 minimum
 - Internal service-to-service: mTLS (Phase 3) or internal API keys (MVP)
 - Database connections: TLS enforced
 ### 4.4 Presigned URLs
 | Parameter | Value | Rationale |
 | :--- | :--- | :--- |
 | Upload URL expiry | 5 minutes | Prevents URL reuse |
 | View URL expiry | 1 minute | Strict security for content access |
 | URL scope | Single object only | No directory listing |
 | Content-Disposition | `inline` (for viewer), `attachment` (for download) | Controls browser behavior |
 ---
 ## 🗄️ 5. Data Protection & Compliance
 ### 5.1 GDPR Compliance
 #### Data Subject Rights
 - **Right to Access:** Users can request all their data via `/users/me/data-export`
 - **Right to Rectification:** Users can update their profile data
 - **Right to Erasure:** Users can request account deletion via `/users/me/delete`
 - **Right to Data Portability:** Export in JSON/CSV format
 - **Right to Restrict Processing:** Users can pause analytics tracking
 #### Implementation
 ```typescript
 // GDPR deletion flow
 async deleteUserData(userId: string) {
   // 1. Anonymize analytics data (keep for business insights)
   await prisma.viewEvent.updateMany({
     where: { userId },
     data: { userId: null }
   });
   // 2. Delete personal data
   await prisma.user.delete({ where: { id: userId } });
   // 3. Revoke all access grants
   await prisma.accessGrant.deleteMany({ where: { userId } });
   // 4. Terminate all sessions
   await prisma.session.deleteMany({ where: { userId } });
   // 5. Anonymize watermarks (keep for forensic purposes)
   await prisma.watermark.updateMany({
     where: { userId },
     data: { userEmail: 'deleted@anonymized', userId: null }
   });
 }
 ```
 ### 5.2 Data Retention Policy
 | Data Type | Retention | Rationale |
 | :--- | :--- | :--- |
 | User accounts | Until deletion request | User control |
 | View events | 2 years | Business analytics |
 | AI usage logs | 2 years | Billing, cost analysis |
 | Watermarks | 2 years | Forensic tracing |
 | Sessions | 30 days after last activity | DRM enforcement |
 | Audit logs | 7 years | Legal compliance |
 | Deleted documents | 30 days (soft delete) | Recovery period |
 ### 5.3 Privacy by Design
 - Analytics data anonymized after retention period
 - No tracking of user behavior beyond what's necessary for the product
 - Cookie consent banner for EU users
 - Clear privacy policy with plain language
 - **No third-party tracking (except active payment providers like YooKassa for payments)**
 ---
 ## 🏗️ 6. Infrastructure Security
 ### 6.1 Network Security
 #### Requirements
 - All services behind Cloudflare (WAF + DDoS protection)
 - Private subnets for databases and internal services
 - Public subnets only for load balancers and CDN
 - Security groups: minimal inbound rules, explicit outbound rules
 - No direct database access from public internet
 ### 6.2 Secrets Management
 #### MVP
 - Environment variables via `.env` files (local dev)
 - Environment variables via hosting platform (production)
 - No secrets in code, logs, or error messages
 - `.env` files in `.gitignore`
 #### Phase 2+
 - AWS Secrets Manager or HashiCorp Vault
 - Automatic rotation of API keys
 - Audit trail for secret access
 ### 6.3 Dependency Security
 - Automated dependency scanning (Dependabot, Snyk)
 - Lock files committed (`package-lock.json`, `requirements.txt`)
 - No `latest` or `*` version tags in dependencies
 - Regular security audits (quarterly)
 ### 6.4 Container Security
 - Non-root user in containers
 - Read-only filesystem where possible
 - Minimal base images (Alpine, distroless)
 - Image scanning in CI/CD pipeline
 - No secrets baked into images
 ---
 ## 📊 7. Audit & Monitoring
 ### 7.1 Audit Logging
 #### What to Log
 - All authentication events (login, logout, failed attempts)
 - All authorization failures (403 responses)
 - All document access events (view, download, share)
 - All admin actions (user management, workspace changes)
 - All security-relevant configuration changes
 - All webhook deliveries (Payment providers, etc.)
 #### Log Format
 ```json
 {
   "timestamp": "2026-07-21T10:00:00Z",
   "level": "INFO",
   "event": "document.viewed",
   "user_id": "uuid",
   "document_id": "uuid",
   "session_id": "uuid",
   "ip_address": "1.2.3.4",
   "user_agent": "Mozilla/5.0...",
   "metadata": { "page": 15 }
 }
 ```
 #### Log Security
 - Logs stored in separate, access-controlled system
 - No sensitive data in logs (passwords, tokens, PII beyond user_id)
 - Immutable: No DELETE operations on audit logs
 - Retention: 7 years minimum
 ### 7.2 Security Monitoring
 #### Alerts
 - Multiple failed login attempts from same IP
 - Unusual geographic access patterns
 - Rate limit violations
 - Suspicious session patterns (rapid device changes)
 - Unusual AI usage spikes (potential abuse)
 - Failed webhook deliveries
 #### Tools
 - Sentry: Error tracking and performance monitoring
 - CloudWatch / Datadog: Infrastructure monitoring
 - Custom dashboards: Security metrics
 ---
 ## 🚨 8. Incident Response
 ### 8.1 Security Incident Categories
 | Severity | Description | Response Time |
 | :--- | :--- | :--- |
 | Critical | Data breach, unauthorized access to user data | 15 minutes |
 | High | Active exploitation, credential leak | 1 hour |
 | Medium | Vulnerability discovered, no active exploitation | 24 hours |
 | Low | Security misconfiguration, policy violation | 1 week |
 ### 8.2 Response Playbook
 #### Content Leak Response
 1. Identify leaked content (watermark forensic analysis)
 2. Identify source user (via `watermarks` table)
 3. Terminate all active sessions for source user
 4. Revoke access grants for source user
 5. Suspend user account
 6. Notify creator (document owner)
 7. Send DMCA takedown notice if content is publicly shared
 8. Document incident in audit log
 #### Account Compromise Response
 1. Terminate all sessions for compromised account
 2. Force password reset (invalidate all refresh tokens)
 3. Review recent activity for unauthorized actions
 4. Notify user via email
 5. Enable MFA if not already enabled
 6. Document incident
 ### 8.3 Disclosure Policy
 - Security vulnerabilities reported to `security@knowledgevault.com`
 - 90-day disclosure window
 - No legal action against good-faith reporters
 - Public acknowledgment of reporters (with permission)
 ---
 ##  9. Security Testing Requirements
 ### 9.1 Automated Security Testing
 #### In CI/CD Pipeline
 - SAST (Static Application Security Testing): ESLint security rules, Bandit (Python)
 - Dependency Scanning: Dependabot, Snyk
 - Secrets Detection: GitLeaks, TruffleHog
 - Container Scanning: Trivy, Snyk Container
 ### 9.2 Manual Security Testing
 #### Quarterly Penetration Testing
 - OWASP Top 10 coverage
 - Business logic testing (DRM bypass, privilege escalation)
 - API security testing (IDOR, mass assignment, parameter pollution)
 - Authentication testing (token manipulation, session fixation)
 #### Specific DRM Tests
 - Attempt to download raw PDF via network inspection
 - Attempt to bypass canvas rendering (DOM manipulation)
 - Attempt to remove watermark (CSS/DOM manipulation)
 - Attempt to share session across devices (concurrent limit bypass)
 - Attempt to reuse expired presigned URLs
 - Attempt to access document without access grant (IDOR)
 - Attempt to manipulate JWT claims (signature bypass)
 ### 9.3 Bug Bounty Program (Phase 3)
 - Public bug bounty program via HackerOne or Bugcrowd
 - Rewards based on severity
 - Clear scope definition
 - Safe harbor for good-faith researchers
 ---
 ##  10. Payment Security
 ### 10.1 PCI DSS Compliance
 **Requirement:** The system MUST NOT store, process, or transmit user payment data (card numbers, CVV, cardholder names).
 **Implementation:**
 - All payment operations are executed via the active `IPaymentProvider` (YooKassa for MVP).
 - KnowledgeVault servers only store `providerCustomerId` and `providerTransactionId`.
 - The frontend never renders raw card input fields; users enter data on the provider's secure hosted domain (Redirect flow).
 **Verification:**
 - Code audits must confirm the absence of fields like `cardNumber`, `cvv`, or `pan` in the database schema and API contracts.
 - Dependencies must be scanned for vulnerabilities (`npm audit`).
 ### 10.2 Webhook Signature Validation
 **Requirement:** All incoming webhook events from the payment provider MUST be cryptographically verified before processing.
 **Implementation:**
 - The `WebhookService` must use the active `IPaymentProvider.validateWebhookSignature()` method.
 - For YooKassa (MVP), signatures are validated using HMAC-SHA256 against the raw request body and the `X-YooKassa-Signature` header, using the `YOOKASSA_WEBHOOK_SECRET`.
 - Invalid signatures result in an immediate HTTP 400 Bad Request. No business logic is executed.
 **Requirements:**
 - The `WEBHOOK_SECRET` is stored exclusively in environment variables (`.env`) and never committed to version control.
 - All webhook attempts (successful and rejected) are logged for security auditing.
 ### 10.3 Workspace Isolation for Payments
 **Requirement:** A user can only initiate payments or view billing information for workspaces they own.
 **Implementation:**
 - All billing endpoints (except the public webhook endpoint) are protected by `WorkspaceOwnerGuard`.
 - The guard verifies that `workspace.ownerId === user.sub` (extracted from the JWT).
 - Attempting to create a payment or query status for another user's workspace returns HTTP 403 Forbidden.
 ### 10.4 Rate Limiting for Billing Endpoints
 **Requirement:** Billing endpoints must be protected against spam and brute-force attacks.
 **Implementation:**
 - `POST /v1/billing/create-payment`: Max 10 requests/minute per user.
 - `POST /v1/billing/webhook`: Max 100 requests/minute per IP (to accommodate provider retries).
 - Exceeding limits returns HTTP 429 Too Many Requests.
 ### 10.5 Sensitive Data Protection
 **Requirement:** API keys and provider secrets must never leak into client-side code, logs, or error messages.
 **Implementation:**
 - `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, and `YOOKASSA_WEBHOOK_SECRET` are injected strictly via `ConfigService` on the backend.
 - The frontend never receives `YOOKASSA_SECRET_KEY`.
 - Webhook logging must exclude the full payload; only `providerTransactionId`, `eventType`, and `workspaceId` are logged.
 **Verification:**
 - Pre-commit hooks must scan for hardcoded secrets (e.g., `git-secrets`, `trufflehog`).
 - Code reviews must explicitly check for `console.log(payload)` or similar leaks in the `WebhookController`.
 ---
 ## 📌 11. Key Takeaways for Implementation (Freebuff)
 ### Non-Negotiable Security Requirements
 - **Never stream files directly:** Always use S3 presigned URLs.
 - **Always validate ownership:** Every query must check workspace/document ownership.
 - **Always enforce session limits:** DRM is the core product value.
 - **Always watermark:** Every viewed page must have user-identifying watermark.
 - **Never log sensitive data:** No passwords, tokens, or raw PII in logs.
 - **Never trust client input:** Validate everything, escape everything.
 - **Always use parameterized queries:** No string concatenation in SQL.
 - **Always rotate refresh tokens:** Prevent token replay attacks.
 - **Always use HTTPS:** HSTS enabled, no HTTP fallback.
 - **Always audit security-relevant actions:** Every auth, access, and admin action logged.
 - **Always verify payment webhooks:** Cryptographic signature validation is mandatory.
 ### Security Review Checklist (Before Accepting Implementation)
 - [ ] All endpoints protected by appropriate guards (JWT, Roles, Ownership)
 - [ ] Input validation on all DTOs
 - [ ] Rate limiting applied
 - [ ] CORS policy configured correctly
 - [ ] Security headers present
 - [ ] No hardcoded secrets
 - [ ] No sensitive data in logs
 - [ ] Presigned URLs have appropriate expiry
 - [ ] Watermarking implemented correctly
 - [ ] Session limits enforced
 - [ ] Audit logging in place
 - [ ] Error messages don't leak sensitive info
 - [ ] Dependencies scanned for vulnerabilities
 - [ ] Tests cover security scenarios
 - [ ] Payment webhooks cryptographically verified
  Related Documents
 - [Authentication](./Authentication.md) - JWT structure, password hashing, OAuth flows
 - [Authorization](./Authorization.md) - RBAC model, guards, ownership validation
 - [Roles and Permissions](./Roles_and_Permissions.md) - Detailed permission matrix
 - [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) - Security principles in backend design
 - [Frontend Architecture](../03_Architecture_and_Design/Frontend_Architecture.md) - Canvas rendering, watermark overlay, DOM protection
 - [Database Design](../03_Architecture_and_Design/Database_Design.md) - Schema for security-critical tables
 - [API Contracts](../03_Architecture_and_Design/API_Contracts.md) - Rate limiting, error codes, presigned URL patterns
 - [Infrastructure](../05_Infrastructure_and_Operations/Infrastructure.md) - Network security, secrets management
 - [Testing Strategy](../06_Quality_and_Standards/Testing_Strategy.md) - Security testing requirements
 - [Billing Design](../03_Architecture_and_Design/Billing_Design.md) - Payment provider strategy and subscription model
 - [ADR-005: Payment Provider Strategy](../07_Management_and_Process/ADR/005_Payment_Provider_Selection.md) - YooKassa selection and architecture
```