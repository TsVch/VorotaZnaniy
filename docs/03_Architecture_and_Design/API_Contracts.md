```markdown
# File: 03_Architecture_and_Design/API_Contracts.md

# API Contracts
 > **This document defines the API contracts, endpoints, request/response formats, and communication protocols for the KnowledgeVault SaaS platform.**
 > 
 > **Related Documents:** 
 > - [System Architecture](./System_Architecture.md)
 > - [Backend Architecture](./Backend_Architecture.md)
 > - [Database Design](./Database_Design.md)
 > - [Authentication](../04_Security_and_Access/Authentication.md)
 > - [Security Requirements](../04_Security_and_Access/Security_Requirements.md)
 > - [Billing Design](./Billing_Design.md)
 ---
 ## 🎯 API Design Principles
 1. **RESTful & Resource-Oriented**: Standard HTTP methods (`GET`, `POST`, `PUT`, `DELETE`) and plural noun URLs.
 2. **JSON Only**: All requests and responses use `application/json` (except initial file uploads to S3).
 3. **API First**: OpenAPI 3.0 specification is auto-generated from code and serves as the contract between Frontend and Backend.
 4. **Secure by Design**: 
    - **No direct file proxying**: The backend never streams document bytes. It only issues short-lived Presigned URLs.
    - **Direct-to-S3 Uploads**: Heavy files are uploaded directly to Object Storage via Presigned PUT URLs to prevent backend bottlenecking.
 5. **Idempotency**: `PUT` and `DELETE` operations are idempotent. Critical `POST` operations (like payments) use idempotency keys.
 6. **Paginated**: List endpoints use cursor-based or offset-based pagination.
 ---
 ##  API Overview
 ### Base URLs
 - **Production**: `https://api.knowledgevault.com/v1`
 - **Staging**: `https://api-staging.knowledgevault.com/v1`
 - **Development**: `http://localhost:3000/v1`
 ### Versioning
 - URL-based versioning (`/v1/`, `/v2/`).
 - Breaking changes require a new major version.
 - Non-breaking changes (new optional fields) are added to the existing version.
 ---
 ## 🔐 Authentication & Headers
 ### Standard Headers
 ```http
 Content-Type: application/json
 Accept: application/json
 Authorization: Bearer <jwt_access_token>
 X-Workspace-Id: <workspace_uuid> // Required for creator-scoped requests
 X-Idempotency-Key: <uuid> // Required for POST /billing/...
 ```
 ### Authentication Flow
 1. Client sends credentials to `/auth/login`.
 2. Server returns `access_token` (short-lived, e.g., 15 mins) and `refresh_token` (long-lived, e.g., 7 days, stored in HttpOnly cookie or secure storage).
 3. Client attaches `access_token` to the `Authorization` header.
 4. On `401 Unauthorized`, client calls `/auth/refresh` to get a new `access_token`.
 ---
 ## 📡 Core Endpoints
 ### 1. Authentication (`/auth`)
 #### `POST /v1/auth/register`
 Register a new user (Creator or Buyer).
 ```json
 // Request
 {
   "email": "creator@example.com",
   "password": "SecurePass123!",
   "name": "Alex Expert",
   "role": "creator"
 }
 // Response (201 Created)
 {
   "user": { "id": "uuid", "email": "...", "role": "creator" },
   "access_token": "eyJhbG...",
   "refresh_token": "eyJhbG..."
 }
 ```
 #### `POST /v1/auth/login`
 ```json
 // Request
 { "email": "...", "password": "..." }
 // Response (200 OK)
 { "access_token": "...", "refresh_token": "...", "expires_in": 900 }
 ```
 ### 2. Documents & Uploads (`/documents`)
 *Note: To ensure scalability and security, file uploads use the Presigned URL pattern.*
 #### `POST /v1/documents/upload-init`
 Initiates an upload and returns a Presigned S3 URL.
 ```json
 // Request
 {
   "title": "Advanced SEO Guide",
   "file_name": "seo_guide.pdf",
   "file_size": 5242880,
   "mime_type": "application/pdf",
   "protection_config": {
     "watermark_enabled": true,
     "max_concurrent_sessions": 2,
     "allow_download": false
   }
 }
 // Response (200 OK)
 {
   "document_id": "uuid",
   "upload_url": "https://s3.amazonaws.com/bucket/...?X-Amz-Signature=...",
   "expires_in": 300
 }
 ```
 #### `POST /v1/documents/:id/upload-complete`
 Called by the client after successful S3 upload.
 ```json
 // Response (202 Accepted)
 {
   "document_id": "uuid",
   "status": "processing",
   "message": "Document queued for parsing and AI embedding."
 }
 ```
 #### `GET /v1/documents`
 List documents in a workspace (Creator) or library (Buyer).
 ```json
 // Query Params: ?page=1&limit=20&status=ready
 // Response (200 OK)
 {
   "data": [
     {
       "id": "uuid",
       "title": "Advanced SEO Guide",
       "status": "ready",
       "page_count": 150,
       "created_at": "2026-01-01T00:00:00Z"
     }
   ],
   "meta": { "total": 45, "page": 1, "limit": 20 }
 }
 ```
 ### 3. Secure Viewer (`/viewer`)
 #### `POST /v1/viewer/sessions`
 Initializes a secure viewing session. Validates access rights and concurrent session limits.
 ```json
 // Request
 { "document_id": "uuid" }
 // Response (200 OK)
 {
   "session_id": "uuid",
   "document": {
     "id": "uuid",
     "title": "...",
     "page_count": 150,
     "protection_config": { "allow_text_selection": false }
   },
   "watermark_data": {
     "user_email": "buyer@example.com",
     "session_id_short": "a1b2c3",
     "timestamp": "2026-07-21T10:00:00Z"
   }
 }
 ```
 #### `GET /v1/viewer/sessions/:sessionId/pages/:pageNumber`
 Returns a short-lived Presigned URL for a specific rendered page tile/image.
 ```json
 // Response (200 OK)
 {
   "page_number": 1,
   "image_url": "https://s3.../tiles/doc_uuid/page_1.webp?signature=...",
   "expires_in": 60
 }
 ```
 #### `POST /v1/viewer/sessions/:sessionId/heartbeat`
 Keeps the session alive and reports current page for analytics.
 ```json
 // Request
 { "current_page": 15, "time_spent_sec": 45 }
 // Response (200 OK)
 { "session_valid": true, "next_heartbeat_in": 60 }
 // Response (403 Forbidden - if session was killed due to multi-device login)
 { "error": "SESSION_TERMINATED", "message": "Logged in from another device." }
 ```
 ### 4. AI Assistant (`/ai`)
 #### `POST /v1/ai/query`
 RAG-based Q&A strictly scoped to the document.
 ```json
 // Request
 {
   "document_id": "uuid",
   "session_id": "uuid",
   "question": "What are the top 3 on-page SEO factors?"
 }
 // Response (200 OK)
 {
   "answer": "The top 3 factors are...",
   "sources": [
     { "page": 15, "snippet": "Title tags are crucial..." }
   ],
   "tokens_used": 450
 }
 ```
 #### `GET /v1/ai/summary/:documentId`
 Retrieves the cached AI summary (generated asynchronously upon upload).
 ```json
 // Response (200 OK)
 { "summary": "This comprehensive guide covers...", "generated_at": "..." }
 ```
 ### 5. Billing & Webhooks (`/billing`)
 *Implemented using Strategy Pattern. Endpoints are provider-agnostic.*
 #### `POST /v1/billing/create-payment`
 Creates a new payment via the active provider (YooKassa for MVP) and returns a redirect URL.
 ```json
 // Request
 {
   "workspaceId": "uuid",
   "amount": 99000,
   "currency": "RUB",
   "description": "Pro Subscription - 1 month"
 }
 // Response (200 OK)
 {
   "paymentId": "uuid",
   "confirmationUrl": "https://yoomoney.ru/checkout/...",
   "status": "pending"
 }
 ```
 #### `POST /v1/billing/webhook`
 Receives events from the active payment provider. Secured via cryptographic signature verification (HMAC-SHA256 for YooKassa).
 ```json
 // Request (from Provider)
 {
   "type": "payment.succeeded",
   "event": {
     "id": "evt_123",
     "status": "succeeded",
     "amount": { "value": "990.00", "currency": "RUB" },
     "metadata": { "workspace_id": "uuid" },
     "created_at": "2026-07-21T10:00:00Z"
   }
 }
 // Response (200 OK)
 { "received": true }
 ```
 ---
 ##  Standard Error Response Format
 All errors follow a consistent envelope structure to simplify frontend error handling.
 ```json
 {
   "error": {
     "code": "CONCURRENT_SESSION_LIMIT",
     "message": "You have reached the maximum number of active devices for this document.",
     "details": {
       "max_sessions": 2,
       "active_devices": ["Chrome on Windows", "Safari on iPhone"]
     },
     "trace_id": "req_abc123xyz"
   }
 }
 ```
 ### Common Business Error Codes
 | HTTP Status | Error Code | Description |
 | :--- | :--- | :--- |
 | 400 | INVALID_FILE_TYPE | Uploaded file is not PDF/EPUB/ZIP. |
 | 402 | SUBSCRIPTION_REQUIRED | Workspace plan limit reached. |
 | 403 | ACCESS_DENIED | User does not own or hasn't purchased the document. |
 | 403 | SESSION_TERMINATED | DRM enforcement (e.g., concurrent login detected). |
 | 404 | DOCUMENT_NOT_FOUND | Document ID invalid or deleted. |
 | 429 | RATE_LIMIT_EXCEEDED | Too many AI queries or API requests. |
 ---
 ## 📊 Rate Limiting Strategy
 Rate limits are applied per user (via JWT) or per IP (for unauthenticated routes).
 | Endpoint Category | Limit | Window |
 | :--- | :--- | :--- |
 | Auth (`/auth/*`) | 5 requests | 1 minute (per IP) |
 | AI Queries (`/ai/*`) | 10 requests | 1 minute (per User) |
 | Viewer Heartbeat | 2 requests | 1 minute (per Session) |
 | General API | 100 requests | 1 minute (per User) |
 | Billing (`/billing/create-payment`) | 10 requests | 1 minute (per User) |
 | Billing Webhook (`/billing/webhook`) | 100 requests | 1 minute (per IP) |
 ### Rate Limit Headers
 ```http
 X-RateLimit-Limit: 100
 X-RateLimit-Remaining: 95
 X-RateLimit-Reset: 1690000000
 ```
 ---
 ## 📌 Key Takeaways for Implementation (Freebuff)
 1. **Never stream files**: Always use S3 Presigned URLs for both upload (`PUT`) and download/view (`GET`).
 2. **Strict Session Validation**: Every `/viewer/*` request must validate the `session_id` against Redis/DB to enforce DRM rules.
 3. **Async AI**: AI generation (summary, embeddings) happens in the background. The API should return `202 Accepted` or serve cached results.
 4. **Provider-Agnostic Billing**: Billing endpoints must not hardcode any specific payment provider logic. Use the `IPaymentProvider` interface.
 5. **OpenAPI Generation**: Use NestJS Swagger plugins to auto-generate the `openapi.json` spec from the DTOs and Controllers.
```