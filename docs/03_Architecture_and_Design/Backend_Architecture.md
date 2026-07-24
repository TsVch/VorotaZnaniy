# Backend Architecture
 > **This document details the server-side architecture, technology stack, and modular structure of the backend.**
 > 
 > **Related Documents:** 
 > - [System Architecture](./System_Architecture.md)
 > - [Database Design](./Database_Design.md)
 > - [API Contracts](./API_Contracts.md)
 > - [Authentication](../04_Security_and_Access/Authentication.md)
 > - [Authorization](../04_Security_and_Access/Authorization.md)
 > - [Security Requirements](../04_Security_and_Access/Security_Requirements.md)
 > - [Infrastructure](../05_Infrastructure_and_Operations/Infrastructure.md)
 > - [Project Structure](../06_Quality_and_Standards/Project_Structure.md)
 > - [ADR-004](../07_Management_and_Process/ADR/004_HTTP_Bridge_for_AI_Worker.md) — HTTP Bridge for NestJS ↔ Python AI Worker
 > - [ADR-005](../07_Management_and_Process/ADR/005_Payment_Provider_Selection.md) — Payment Provider Strategy
 ---
 ## 🎯 Architectural Decision Summary
 | Aspect | Decision | Rationale | ADR Reference |
 | :--- | :--- | :--- | :--- |
 | Overall Style | Modular Monolith | KISS/YAGNI for MVP; future microservices-ready | ADR-001 |
 | Core API | Node.js 20 + NestJS | TypeScript, strict architecture, strong ecosystem | ADR-006 |
 | AI Worker | Python 3.11 + FastAPI | Native AI/ML library support, async performance | ADR-002 |
 | Internal Queues | Redis 7 + BullMQ | Reliable queues for Node.js ↔ Node.js jobs | ADR-007 |
 | Cross-Language Jobs | **HTTP Bridge (NestJS ↔ Python)** | BullMQ is Node.js-only; HTTP bridge is simple and language-agnostic | **ADR-004** |
 | ORM | Prisma 5 | Type-safe, great DX, migration support | ADR-003 |
 | File Storage | AWS S3 / Cloudflare R2 | Durable, scalable, presigned URLs | ADR-005 |
 | API Documentation | `@nestjs/swagger` (OpenAPI 3.0) | Auto-generated from DTOs, keeps docs in sync | ADR-008 |
 | Payment Provider | **YooKassa (MVP)** | Russian market leader, supports MIR/SBP, compliant with 152-FZ | **ADR-005** |
 ---
 ## 🛠️ Technology Stack
 ### Core API (Node.js + NestJS)
 - **Runtime**: Node.js 20+ (LTS)
 - **Framework**: NestJS 10+ (TypeScript)
 - **Why NestJS?**:
   - Strict architectural patterns (Controllers, Services, Modules, Guards)
   - Excellent TypeScript support with decorators
   - Built-in security/validation features (`class-validator`, `class-transformer`)
   - Modular design aligns with Clean Architecture principles
   - Strong ecosystem (Prisma, BullMQ, Passport.js, Helmet integrations)
   - Dependency injection container for testability
 - **API Documentation**: `@nestjs/swagger` for automatic OpenAPI 3.0 spec generation from DTOs and controllers.
 ### AI & Processing Worker (Python + FastAPI)
 - **Runtime**: Python 3.11+
 - **Framework**: FastAPI 0.110+
 - **Why FastAPI?**:
   - Native compatibility with AI/ML libraries (LangChain, LlamaIndex, PyPDF2)
   - High-performance async capabilities via asyncio
   - Automatic OpenAPI documentation generation
   - Type hints and validation via Pydantic
   - Background tasks support
 ### Message Broker (Internal Node.js Jobs)
 - **Technology**: Redis 7+ with BullMQ (Node.js)
 - **Scope**: Used exclusively for **Node.js ↔ Node.js** job queuing (e.g., analytics processing, email dispatch, internal event handling).
 - **Why Redis + BullMQ?**:
   - Reliable job queuing with retry mechanisms and dead-letter queues
   - Priority queues for different task types
   - Built-in rate limiting and concurrency control
   - Simple to deploy, monitor, and scale
   - Supports delayed and scheduled jobs
 ### HTTP Bridge (Cross-Language Jobs: NestJS ↔ Python)
 - **Technology**: Internal HTTP API exposed by NestJS, consumed by Python AI Worker via `httpx`.
 - **Scope**: Used for **all AI-related jobs** (document parsing, embedding generation, RAG queries, summary generation).
 - **Why HTTP Bridge?**: BullMQ is Node.js-only; no reliable Python client exists. HTTP is language-agnostic and debuggable. See [ADR-004](../07_Management_and_Process/ADR/004_HTTP_Bridge_for_AI_Worker.md).
 - **Phase 2 Migration**: Plan to migrate to Redis Streams or RabbitMQ when scale demands push-based messaging.
 ### Database ORM
 - **Technology**: Prisma 5+
 - **Why Prisma?**:
   - Type-safe database access with auto-generated TypeScript types
   - Easy migrations and schema management
   - Excellent developer experience with Prisma Studio
   - Strong performance characteristics with connection pooling
   - Support for PostgreSQL-specific features (JSONB, pgvector)
 ---
 ## 📦 Modular Monolith Structure (Core API)
 The NestJS application is divided into strict, independent domains. Each module owns its data, business logic, and API surface. Modules communicate via well-defined internal APIs or events, never by directly accessing another module's database tables.
 ```text
 backend/
 ├── src/
 │   ├── auth/                          # Authentication & Authorization
 │   │   ├── auth.controller.ts
 │   │   ├── auth.service.ts
 │   │   ├── auth.module.ts
 │   │   ├── strategies/
 │   │   │   ├── jwt.strategy.ts
 │   │   │   └── oauth.strategy.ts
 │   │   ├── guards/
 │   │   │   ├── jwt-auth.guard.ts
 │   │   │   └── roles.guard.ts
 │   │   └── dto/
 │   │       ├── login.dto.ts
 │   │       └── register.dto.ts
 │   │
 │   ├── users/                         # User Management
 │   │   ├── users.controller.ts
 │   │   ├── users.service.ts
 │   │   ├── users.module.ts
 │   │   ├── entities/
 │   │   │   └── user.entity.ts
 │   │   └── dto/
 │   │       ├── create-user.dto.ts
 │   │       └── update-user.dto.ts
 │   │
 │   ├── workspaces/                    # Workspace/Org Management
 │   │   ├── workspaces.controller.ts
 │   │   ├── workspaces.service.ts
 │   │   └── workspaces.module.ts
 │   │
 │   ├── documents/                     # Document Management
 │   │   ├── documents.controller.ts
 │   │   ├── documents.service.ts
 │   │   ├── documents.module.ts
 │   │   ├── entities/
 │   │   │   └── document.entity.ts
 │   │   ├── dto/
 │   │   │   ├── create-document.dto.ts
 │   │   │   └── upload-document.dto.ts
 │   │   └── processors/
 │   │       └── document-upload.processor.ts
 │   │
 │   ├── access/                        # DRM & Access Control
 │   │   ├── access.controller.ts
 │   │   ├── access.service.ts
 │   │   ├── access.module.ts
 │   │   ├── entities/
 │   │   │   ├── access-grant.entity.ts
 │   │   │   └── session.entity.ts
 │   │   └── services/
 │   │       ├── watermark.service.ts
 │   │       └── session-validator.service.ts
 │   │
 │   ├── analytics/                     # Analytics & Tracking
 │   │   ├── analytics.controller.ts
 │   │   ├── analytics.service.ts
 │   │   ├── analytics.module.ts
 │   │   └── processors/
 │   │       └── analytics.processor.ts
 │   │
 │   ├── billing/                       # Payment & Subscription
 │   │   ├── billing.controller.ts
 │   │   ├── billing.service.ts
 │   │   ├── billing.module.ts
 │   │   └── webhooks/
 │   │       └── yookassa-webhook.handler.ts
 │   │
 │   ├── jobs-bridge/                   # 🆕 HTTP Bridge for AI Worker (ADR-004)
 │   │   ├── jobs-bridge.controller.ts  # Internal HTTP endpoints
 │   │   ├── jobs-bridge.service.ts     # Job persistence + event emission
 │   │   ├── jobs-bridge.module.ts
 │   │   ├── guards/
 │   │   │   └── internal-api-key.guard.ts  # Validates X-Internal-API-Key
 │   │   ├── entities/
 │   │   │   └── pending-job.entity.ts
 │   │   └── dto/
 │   │       ├── job-result.dto.ts
 │   │       └── job-failure.dto.ts
 │   │
 │   ├── shared/                        # Shared Infrastructure
 │   │   ├── config/
 │   │   │   └── configuration.ts
 │   │   ├── filters/
 │   │   │   └── http-exception.filter.ts
 │   │   ├── interceptors/
 │   │   │   ├── logging.interceptor.ts
 │   │   │   └── transform.interceptor.ts
 │   │   ├── decorators/
 │   │   │   ├── current-user.decorator.ts
 │   │   │   └── roles.decorator.ts
 │   │   ├── utils/
 │   │   │   ├── s3.service.ts
 │   │   │   ├── queue.service.ts       # BullMQ wrapper (Node.js internal jobs)
 │   │   │   └── swagger.ts             # OpenAPI/Swagger configuration
 │   │   └── types/
 │   │       ├── common.types.ts
 │   │       └── events.ts
 │   │
 │   ├── app.module.ts
 │   └── main.ts                        # Bootstrap with Swagger setup
 │
 ├── prisma/
 │   ├── schema.prisma
 │   └── migrations/
 │
 ├── test/
 │   ├── unit/
 │   ├── integration/
 │   └── e2e/
 │
 ├── .env.example
 ├── nest-cli.json
 ├── tsconfig.json
 └── package.json
Module Communication Rules
No Direct Database Access: Modules cannot directly query another module's tables.
Event-Driven Communication (Internal Node.js): Use Redis/BullMQ for async inter-module communication within NestJS.
HTTP Bridge (Cross-Language): Use the `jobs-bridge` module for all AI Worker communication.
Internal APIs: For synchronous communication, expose internal services (not controllers).
Shared Types: Common interfaces and DTOs live in `shared/types/`.
⚙️ AI & Document Processing Worker Structure (Python)
ai_worker/
 ├── app/
 │   ├── api/
 │   │   ├── routes/
 │   │   │   ├── health.py
 │   │   │   └── internal.py            # Health + metrics endpoints
 │   │   ├── deps.py
 │   │   └── main.py
 │   │
 │   ├── parsers/
 │   │   ├── pdf_parser.py
 │   │   ├── epub_parser.py
 │   │   └── base_parser.py
 │   │
 │   ├── rag/
 │   │   ├── embeddings.py
 │   │   ├── vector_store.py
 │   │   ├── retriever.py
 │   │   ├── generator.py
 │   │   └── prompts/
 │   │       ├── summary.txt
 │   │       ├── qa.txt
 │   │       └── quiz.txt
 │   │
 │   ├── jobs/
 │   │   ├── poller.py                  # 🆕 HTTP polling loop (calls NestJS bridge)
 │   │   ├── document_processor.py      # Main document processing job
 │   │   ├── embedding_generator.py     # Embedding batch job
 │   │   └── base_job.py
 │   │
 │   ├── core/
 │   │   ├── config.py
 │   │   ├── database.py
 │   │   ├── redis.py
 │   │   ├── http_client.py             # 🆕 httpx.AsyncClient for NestJS bridge
 │   │   └── logging.py
 │   │
 │   └── utils/
 │       ├── text_cleaner.py
 │       └── chunker.py
 │
 ├── tests/
 │   ├── unit/
 │   ├── integration/
 │   └── fixtures/
 │
 ├── requirements.txt
 ├── Dockerfile
 └── README.md
🔌 Inter-Service Communication
1. Internal Node.js Communication (BullMQ)
Used for NestJS module ↔ NestJS module communication only.
Examples:
`documents` module publishes `document.uploaded` → `analytics` module consumes for tracking
`billing` module publishes `payment.succeeded` → `access` module grants document access
2. Cross-Language Communication (HTTP Bridge — ADR-004)
Used for NestJS ↔ Python AI Worker communication.
Internal API Endpoints (Exposed by NestJS)
All endpoints are under `/internal/jobs/` and protected by `InternalApiKeyGuard`.
`GET /internal/jobs/pending`
AI Worker polls for pending AI jobs.
Request:
GET /internal/jobs/pending?job_type=ai_processing&limit=10
X-Internal-API-Key: <shared-secret>
Response (200 OK):
{
  "jobs": [
    {
      "id": "job_uuid",
      "job_type": "document_processing",
      "payload": {
        "document_id": "doc_uuid",
        "file_url": "s3://bucket/path/to/file.pdf",
        "file_type": "pdf"
      },
      "created_at": "2026-07-21T10:00:00Z",
      "attempts": 0
    }
  ]
}
`POST /internal/jobs/:id/result`
AI Worker submits successful job result.
Request:
POST /internal/jobs/job_uuid/result
X-Internal-API-Key: <shared-secret>
Content-Type: application/json
{
  "status": "success",
  "result": {
    "page_count": 150,
    "chunks_generated": 45,
    "summary": "This document covers...",
    "processing_time_ms": 12500
  }
}
Response (200 OK):
{ "acknowledged": true }
`POST /internal/jobs/:id/failure`
AI Worker reports job failure.
Request:
POST /internal/jobs/job_uuid/failure
X-Internal-API-Key: <shared-secret>
Content-Type: application/json
{
  "error_type": "PARSING_FAILED",
  "error_message": "PDF is password-protected",
  "retryable": false
}
AI Worker Polling Loop (Python)
# ai_worker/app/jobs/poller.py
 import asyncio
 import httpx
 from app.core.config import settings
 class JobPoller:
     def __init__(self):
         self.client = httpx.AsyncClient(
             base_url=settings.NESTJS_INTERNAL_URL,
             headers={"X-Internal-API-Key": settings.INTERNAL_API_KEY},
             timeout=30.0,
         )
         self.poll_interval = 5.0  # seconds
         self.backoff_multiplier = 2.0
         self.max_backoff = 30.0
     async def run(self):
         current_interval = self.poll_interval
         while True:
             try:
                 jobs = await self._fetch_pending_jobs()
                 if jobs:
                     current_interval = self.poll_interval  # Reset backoff
                     await asyncio.gather(*[self._process_job(job) for job in jobs])
                 else:
                     current_interval = min(current_interval * self.backoff_multiplier, self.max_backoff)
             except Exception as e:
                 logger.error(f"Polling error: {e}")
                 current_interval = self.max_backoff
             await asyncio.sleep(current_interval)
     async def _fetch_pending_jobs(self) -> list[dict]:
         response = await self.client.get(
             "/internal/jobs/pending",
             params={"job_type": "ai_processing", "limit": 10},
         )
         response.raise_for_status()
         return response.json()["jobs"]
     async def _process_job(self, job: dict):
         try:
             result = await document_processor.process(job)
             await self.client.post(f"/internal/jobs/{job['id']}/result", json={
                 "status": "success",
                 "result": result,
             })
         except Exception as e:
             await self.client.post(f"/internal/jobs/{job['id']}/failure", json={
                 "error_type": type(e).__name__,
                 "error_message": str(e),
                 "retryable": True,
             })
Event Flow Diagram
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
 │  NestJS      │ publish  │   BullMQ     │          │  AI Worker   │
 │  (Node.js)   │─────────▶│  (Redis)     │          │  (Python)    │
 └──────┬───────┘          └──────────────┘          └──────┬───────┘
        │                                                   │
        │  [jobs-bridge module persists AI jobs             │
        │   to `pending_jobs` DB table]                     │
        │                                                   │
        │         GET /internal/jobs/pending ◀──────────────│ (poll every 5s)
        │         ─────────────────────────────────────────▶│
        │         { jobs: [{id, type, payload}] }           │
        │                                                   │
        │         [AI Worker processes document]            │
        │         [generates embeddings, summary]           │
        │                                                   │
        │         POST /internal/jobs/{id}/result ─────────▶│
        │         ◀─────────────────────────────────────────│ { acknowledged: true }
        │                                                   │
        │  [jobs-bridge emits 'document.processed' event]   │
        │  [documents module updates DB status → READY]     │
        │  [Frontend notified via polling/WebSocket]        │
3. External Service Communication
YooKassa: Webhooks (`POST /v1/webhooks/yookassa`) with signature verification.
OpenAI / Anthropic: Direct HTTPS calls from AI Worker (Python).
Email (Resend/SendGrid): Called from NestJS `shared/utils/email.service.ts`.
S3 / R2: Presigned URLs generated by NestJS; direct upload/download by frontend.
🛡️ Backend Security Principles
Zero Trust Architecture
Every internal endpoint validates context (user ID, permissions, session).
No implicit trust between modules or services.
Internal API (jobs-bridge) authenticated via `X-Internal-API-Key` header (shared secret, rotated quarterly).
Internal API endpoints are not exposed to public internet (VPC-only, Cloudflare WAF blocks `/internal/*`).
No Direct File Serving
The backend never streams file bytes directly to clients.
It only generates and validates Presigned URLs for Object Storage.
Rate Limiting Strategy
API Gateway Level: 100 requests/min per IP (Cloudflare WAF).
Business Logic Level:
Max 10 AI queries/min per user.
Max 5 document uploads/hour per creator.
Implementation: Redis-based sliding window counters.
Input Validation
All DTOs validated with `class-validator` (NestJS) and Pydantic (FastAPI).
Strict type checking with TypeScript strict mode.
File upload validation: size, MIME type, magic bytes.
Audit Logging
All critical actions logged with user context, timestamp, and IP.
Logs stored in structured JSON format.
Sensitive data (passwords, tokens) never logged.
📊 Performance Considerations
Caching Strategy
Redis Cache: Frequently accessed data (user sessions, document metadata).
CDN Cache: Static assets, processed document tiles.
Application Cache: In-memory cache for hot paths (AI summary results).
Database Optimization
Indexed columns for frequent queries (user email, document ID, access grants).
Connection pooling via Prisma (default pool size: 10 connections).
Read replicas for analytics queries (future scaling).
Async Processing
All heavy operations (document parsing, AI generation) are async.
User receives immediate response with job ID for status tracking.
WebSocket or polling for real-time updates.
HTTP Bridge Performance
AI Worker polling interval: 5s (with exponential backoff to 30s when idle).
Batch processing: AI Worker can fetch up to 10 jobs per poll.
Expected latency: 0-5s between job creation and pickup (acceptable for async processing).
🧪 Testing Strategy
Unit Tests
Each service tested in isolation with mocked dependencies.
Coverage target: 80%+ for core business logic.
Framework: Jest (Node.js), pytest (Python).
Integration Tests
Module-to-database integration tests using test containers.
HTTP Bridge tests: Mock NestJS internal API in AI Worker tests; mock AI Worker in NestJS tests.
BullMQ queue processing tests with in-memory Redis.
E2E Tests
Full API flow tests (upload → jobs-bridge → AI Worker → result callback → DB update).
YooKassa webhook simulation tests.
📈 Scalability Path
Phase 1 (MVP)
Single NestJS instance + single AI Worker.
PostgreSQL with pgvector.
Redis for BullMQ (internal Node.js jobs) + cache.
HTTP Bridge for NestJS ↔ Python communication.
Phase 2 (Growth)
Horizontal scaling of NestJS behind load balancer.
Multiple AI Worker replicas based on pending jobs count.
PostgreSQL read replicas.
Migrate HTTP Bridge → Redis Streams or RabbitMQ for push-based, lower-latency messaging.
Phase 3 (Enterprise)
Extract high-load modules (analytics, billing) into separate services.
Dedicated vector database (Qdrant) if pgvector becomes bottleneck.
Multi-region deployment.
📌 Key Takeaways for Implementation (Freebuff)
Modular boundaries are strict: No cross-module database access.
Two queuing mechanisms:
BullMQ for NestJS ↔ NestJS (internal Node.js jobs).
HTTP Bridge (`jobs-bridge` module) for NestJS ↔ Python AI Worker.
Internal API is private: `/internal/*` endpoints must not be exposed publicly.
Security is non-negotiable: `InternalApiKeyGuard` on all jobs-bridge endpoints.
Testability by design: Every service must be testable in isolation.
Documentation is truth: Any deviation requires an ADR update.
OpenAPI from day one: Configure `@nestjs/swagger` in `main.ts` bootstrap.
---