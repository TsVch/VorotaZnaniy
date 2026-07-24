Вы абсолютно правы. Исправляю форматирование. Ниже представлены полные, правильно оформленные Markdown-файлы для всех трех документов раздела 03.

---

### 15. `/docs/03_Architecture_and_Design/System_Architecture.md`

```markdown
# System Architecture

> **This document defines the high-level system architecture, core components, and data flow of the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [Backend_Architecture.md](./Backend_Architecture.md)
> - [Frontend_Architecture.md](./Frontend_Architecture.md)
> - [Security_Requirements.md](../04_Security_and_Access/Security_Requirements.md)
> - [Infrastructure.md](../05_Infrastructure_and_Operations/Infrastructure.md)

## 🏗️ Architectural Style

We will employ a **Modular Monolith** architecture for the core backend, coupled with a dedicated, isolated **AI/Processing Microservice**.

### Why Modular Monolith?
- Minimizes initial operational complexity (KISS principle)
- Avoids premature distributed system pitfalls (YAGNI principle)
- Allows for rapid MVP delivery while maintaining strict domain boundaries (Clean Architecture)
- Enables future extraction into microservices if scale demands it

### Why Isolated AI Service?
- AI/RAG workloads have different scaling, memory, and dependency requirements (e.g., Python, vector DBs, heavy GPU/CPU usage)
- Isolating it prevents AI processing spikes from degrading core API performance
- Allows independent scaling and technology choices for AI components

## 📐 C4 Model: Level 1 (System Context)

```text
┌─────────────────────────────────────────────────────────────┐
│                     External Actors                          │
├─────────────────────────────────────────────────────────────┤
│  [Creator]          [Buyer]          [Platform Admin]        │
└────────────┬────────────┬──────────────────┬────────────────┘
             │            │                  │
             ▼            ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              KnowledgeVault SaaS Platform                    │
│  (Secure document delivery & AI-enhanced learning platform) │
└────────────┬────────────┬──────────────────┬────────────────┘
             │            │                  │
             ▼            ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
│  Stripe API     │ │ LLM Provider │ │ Email Provider   │
│ (Payments)      │ │ (OpenAI/     │ │ (SendGrid/       │
│                 │ │  Anthropic)  │ │  Resend)         │
└─────────────────┘ └──────────────┘ └──────────────────┘
```

## 📐 C4 Model: Level 2 (Containers)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        KnowledgeVault SaaS Platform                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  Client Web App  │    │ Embeddable Widget│    │   API Gateway /  │  │
│  │    (Next.js)     │───▶│ (Vanilla JS/TS)  │    │  Core Backend    │  │
│  │                  │    │                  │    │ (Node.js+NestJS) │  │
│  └────────┬─────────┘    └──────────────────┘    └────────┬─────────┘  │
│           │                                                │             │
│           │                                                ▼             │
│           │                                     ┌──────────────────┐    │
│           │                                     │ Message Queue    │    │
│           │                                     │ (Redis/BullMQ)   │    │
│           │                                     └────────┬─────────┘    │
│           │                                              │               │
│           │                                              ▼               │
│           │                                     ┌──────────────────┐    │
│           │                                     │ AI & Document    │    │
│           │                                     │ Processing Svc   │    │
│           │                                     │ (Python+FastAPI) │    │
│           │                                     └────────┬─────────┘    │
│           │                                              │               │
│           ▼                                              ▼               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Data Storage Layer                             │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │ PostgreSQL   │  │ Vector DB    │  │ Object Storage       │  │  │
│  │  │ (pgvector)   │  │ (pgvector)   │  │ (AWS S3 / R2)        │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    External Services                              │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │ CDN & WAF    │  │ Stripe API   │  │ LLM Provider API     │  │  │
│  │  │ (Cloudflare) │  │              │  │ (OpenAI/Anthropic)   │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Container Descriptions

1. **Client Web App (Next.js)**: Responsive web application for Creators (Dashboard) and Buyers (Secure Library & Viewer).

2. **Embeddable Widget (Vanilla JS/TS)**: Lightweight script for creators to embed the viewer/buy button on external sites.

3. **API Gateway / Core Backend (Node.js + NestJS)**: Handles authentication, authorization, CRUD operations, Stripe webhooks, and serves the secure viewer metadata.

4. **AI & Document Processing Service (Python + FastAPI)**: Asynchronous worker service responsible for parsing uploaded documents, generating embeddings, and handling RAG (Retrieval-Augmented Generation) queries.

5. **Message Queue (Redis / BullMQ)**: Decouples the Core Backend from the AI Service for async tasks (e.g., "on upload complete, trigger summarization").

6. **Relational Database (PostgreSQL)**: Stores users, workspaces, document metadata, access grants, and analytics.

7. **Vector Database (pgvector)**: Stores document embeddings for AI RAG functionality. Using `pgvector` extension in PostgreSQL is preferred for MVP to reduce operational complexity (KISS).

8. **Object Storage (AWS S3 / Cloudflare R2)**: Stores raw uploaded files and processed, secure page tiles. **Never serves files directly to the client.**

9. **CDN & WAF (Cloudflare)**: Caches static assets, provides DDoS protection, and enforces basic WAF rules.

## 🔄 Core Data Flow: Secure Document Viewing

```text
┌─────────┐         ┌──────────────┐         ┌─────────────┐         ┌──────────┐
│  Buyer  │────────▶│ Client Web   │────────▶│ Core Backend│────────▶│  Object  │
│ (User)  │         │ App (Next.js)│         │  (NestJS)   │         │ Storage  │
└─────────┘         └──────┬───────┘         └──────┬──────┘         └────┬─────┘
                           │                        │                     │
                           │  1. Request view       │                     │
                           │◀───────────────────────┘                     │
                           │                        │                     │
                           │                        │  2. Validate JWT,   │
                           │                        │     check access    │
                           │                        │                     │
                           │                        │  3. Request         │
                           │                        │     Presigned URL   │
                           │                        │────────────────────▶│
                           │                        │                     │
                           │                        │  4. Return          │
                           │                        │◀────────────────────│
                           │                        │     Presigned URL   │
                           │                        │                     │
                           │  5. Return URL +       │                     │
                           │     Watermark Token    │                     │
                           │◀───────────────────────┘                     │
                           │                                              │
                           │  6. Fetch asset via Presigned URL            │
                           │─────────────────────────────────────────────▶│
                           │                                              │
                           │  7. Return secure asset                      │
                           │◀─────────────────────────────────────────────│
                           │                                              │
                           │  8. Render on <canvas> + overlay watermark   │
                           │                                              │
```

### Flow Description

1. Buyer requests to view a document via the Client Web App.
2. Core Backend validates the user's JWT, checks active session limits, and verifies purchase/access rights.
3. Core Backend requests a **short-lived (5-minute) Presigned URL** from Object Storage for the specific document's secure assets.
4. Core Backend returns the Presigned URL and a unique, session-bound **Watermark Token** to the Client.
5. Client Web App fetches the asset via the Presigned URL and renders it on an HTML5 `<canvas>`.
6. Client Web App overlays the dynamic watermark (tied to the Watermark Token) on top of the canvas.

## 🎯 Key Architectural Decisions

| Decision | Rationale | ADR Reference |
| :--- | :--- | :--- |
| Modular Monolith over Microservices | KISS/YAGNI for MVP, easier to deploy and debug | ADR-001 |
| Isolated AI Worker Service | Different scaling needs, prevents resource contention | ADR-002 |
| PostgreSQL + pgvector | Single database for relational + vector data (MVP simplicity) | ADR-003 |
| Canvas-based rendering | Prevents direct file access, enables watermarking | ADR-004 |
| Presigned URLs for assets | Secure, time-limited access without backend proxying | ADR-005 |

## 📊 Scalability Considerations

- **Horizontal Scaling**: Core API can scale horizontally behind a load balancer.
- **Database Scaling**: PostgreSQL read replicas for analytics queries; pgvector can be sharded if needed.
- **AI Worker Scaling**: Independent auto-scaling based on queue depth.
- **CDN**: Cloudflare handles global distribution and DDoS protection.
```

---

### 16. `/docs/03_Architecture_and_Design/Backend_Architecture.md`

```markdown
# Backend Architecture

> **This document details the server-side architecture, technology stack, and modular structure of the backend.**
> 
> **Related Documents:** 
> - [System_Architecture.md](./System_Architecture.md)
> - [Database_Design.md](./Database_Design.md)
> - [API_Contracts.md](./API_Contracts.md)

## 🛠️ Technology Stack

### Core API
- **Runtime**: Node.js 20+ (LTS)
- **Framework**: **NestJS** (TypeScript)
- **Why NestJS?**: 
  - Strict architectural patterns (Controllers, Services, Modules)
  - Excellent TypeScript support with decorators
  - Built-in security/validation features (class-validator, class-transformer)
  - Modular design aligns with Clean Architecture principles
  - Strong ecosystem (Prisma, BullMQ, Passport.js integrations)

### AI & Processing Worker
- **Runtime**: Python 3.11+
- **Framework**: **FastAPI**
- **Why FastAPI?**: 
  - Native compatibility with AI/ML libraries (LangChain, LlamaIndex, PyPDF2)
  - High-performance async capabilities
  - Automatic OpenAPI documentation generation
  - Type hints and validation via Pydantic

### Message Broker
- **Technology**: **Redis** with **BullMQ** (Node.js)
- **Why Redis + BullMQ?**: 
  - Reliable job queuing with retry mechanisms
  - Priority queues for different task types
  - Built-in rate limiting and concurrency control
  - Simple to deploy and monitor

### Database ORM
- **Technology**: **Prisma** (for Node.js)
- **Why Prisma?**: 
  - Type-safe database access with auto-generated types
  - Easy migrations and schema management
  - Excellent developer experience with Prisma Studio
  - Strong performance characteristics

## 📦 Modular Monolith Structure (Core API)

The NestJS application is divided into strict, independent domains. Modules can only communicate via well-defined internal APIs or events, never by directly accessing another module's database tables.

```text
backend/
├── src/
│   ├── auth/                          # Authentication & Authorization Module
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
│   ├── users/                         # User Management Module
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   │
│   ├── documents/                     # Document Management Module
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
│   ├── access/                        # DRM & Access Control Module
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
│   ├── analytics/                     # Analytics & Tracking Module
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   ├── analytics.module.ts
│   │   ├── entities/
│   │   │   └── view-event.entity.ts
│   │   └── processors/
│   │       └── analytics.processor.ts
│   │
│   ├── billing/                       # Payment & Subscription Module
│   │   ├── billing.controller.ts
│   │   ├── billing.service.ts
│   │   ├── billing.module.ts
│   │   ├── entities/
│   │   │   └── subscription.entity.ts
│   │   └── webhooks/
│   │       └── stripe-webhook.handler.ts
│   │
│   ├── shared/                        # Shared Utilities & Infrastructure
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
│   │   │   └── queue.service.ts
│   │   └── types/
│   │       └── common.types.ts
│   │
│   ├── app.module.ts                  # Root Application Module
│   └── main.ts                        # Application Entry Point
│
├── prisma/
│   ├── schema.prisma                  # Database Schema Definition
│   └── migrations/                    # Database Migrations
│
├── test/
│   ├── unit/                          # Unit Tests
│   ├── integration/                   # Integration Tests
│   └── e2e/                           # End-to-End Tests
│
├── .env.example                       # Environment Variables Template
├── nest-cli.json                      # NestJS Configuration
├── tsconfig.json                      # TypeScript Configuration
└── package.json                       # Dependencies & Scripts
```

### Module Communication Rules

1. **No Direct Database Access**: Modules cannot directly query another module's tables.
2. **Event-Driven Communication**: Use Redis/BullMQ for async inter-module communication.
3. **Internal APIs**: For synchronous communication, expose internal services (not controllers).
4. **Shared Types**: Common interfaces and DTOs live in `shared/types/`.

## ⚙️ AI & Document Processing Worker Structure (Python)

```text
ai_worker/
├── app/
│   ├── api/                           # FastAPI Endpoints
│   │   ├── routes/
│   │   │   ├── health.py
│   │   │   ├── process.py
│   │   │   └── query.py
│   │   ├── deps.py                    # Dependencies
│   │   └── main.py                    # FastAPI App
│   │
│   ├── parsers/                       # Document Parsing Logic
│   │   ├── pdf_parser.py
│   │   ├── epub_parser.py
│   │   └── base_parser.py
│   │
│   ├── rag/                           # RAG Pipeline
│   │   ├── embeddings.py              # Embedding generation
│   │   ├── vector_store.py            # Vector DB operations
│   │   ├── retriever.py               # Document retrieval
│   │   ├── generator.py               # LLM response generation
│   │   └── prompts/
│   │       ├── summary.txt
│   │       ├── qa.txt
│   │       └── quiz.txt
│   │
│   ├── jobs/                          # Background Workers
│   │   ├── document_processor.py      # Main processing job
│   │   ├── embedding_generator.py     # Embedding batch job
│   │   └── base_job.py
│   │
│   ├── core/                          # Core Configuration
│   │   ├── config.py                  # Settings & env vars
│   │   ├── database.py                # DB connections
│   │   └── logging.py                 # Logging configuration
│   │
│   └── utils/                         # Utility Functions
│       ├── text_cleaner.py
│       └── chunker.py
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── requirements.txt                   # Python Dependencies
├── Dockerfile                         # Container Definition
└── README.md                          # Worker Documentation
```

## 🔌 Inter-Service Communication

### Synchronous Communication (HTTP/gRPC)
- **When to use**: Only when absolutely necessary (e.g., Core API asking AI service for a quick summary status).
- **Implementation**: Internal HTTP endpoints with service-to-service authentication.
- **Example**: `GET /internal/ai/document/{id}/status`

### Asynchronous Communication (Event-Driven via Redis/BullMQ)
- **When to use**: Preferred for most inter-service communication.
- **Implementation**: Publish/subscribe pattern with typed events.

#### Event Flow Example

```text
┌──────────────┐         ┌─────────────┐         ┌──────────────┐
│   Core API   │         │ Redis Queue │         │  AI Worker   │
│  (NestJS)    │         │  (BullMQ)   │         │  (FastAPI)   │
└──────┬───────┘         └──────┬──────┘         └──────┬───────┘
       │                        │                       │
       │  1. Publish event      │                       │
       │  "document.uploaded"   │                       │
       │───────────────────────▶│                       │
       │                        │                       │
       │                        │  2. Consume event     │
       │                        │──────────────────────▶│
       │                        │                       │
       │                        │                       │  3. Process doc
       │                        │                       │     Generate embeddings
       │                        │                       │
       │                        │  4. Publish result    │
       │                        │◀──────────────────────│
       │                        │  "document.processed" │
       │  5. Consume result     │                       │
       │◀───────────────────────│                       │
       │                        │                       │
       │  6. Update DB status   │                       │
       │                        │                       │
```

### Event Types

```typescript
// Shared event definitions
enum DocumentEvents {
  UPLOADED = 'document.uploaded',
  PROCESSED = 'document.processed',
  PROCESSING_FAILED = 'document.processing_failed',
}

enum AnalyticsEvents {
  VIEW_STARTED = 'analytics.view_started',
  VIEW_COMPLETED = 'analytics.view_completed',
  AI_QUERY_MADE = 'analytics.ai_query_made',
}
```

## 🛡️ Backend Security Principles

### Zero Trust Architecture
- Every internal endpoint validates context (user ID, permissions, session).
- No implicit trust between modules or services.

### No Direct File Serving
- The backend **never** streams file bytes directly to clients.
- It only generates and validates Presigned URLs for Object Storage.

### Rate Limiting Strategy
- **API Gateway Level**: 100 requests/min per IP (Cloudflare WAF).
- **Business Logic Level**: 
  - Max 10 AI queries/min per user.
  - Max 5 document uploads/hour per creator.
- **Implementation**: Redis-based sliding window counters.

### Input Validation
- All DTOs validated with `class-validator` (NestJS) and Pydantic (FastAPI).
- Strict type checking with TypeScript strict mode.
- File upload validation (size, MIME type, magic bytes).

### Audit Logging
- All critical actions logged with user context, timestamp, and IP.
- Logs stored in structured format (JSON) for easy querying.
- Sensitive data (passwords, tokens) never logged.

## 📊 Performance Considerations

### Caching Strategy
- **Redis Cache**: Frequently accessed data (user sessions, document metadata).
- **CDN Cache**: Static assets, processed document tiles.
- **Application Cache**: In-memory cache for hot paths (e.g., AI summary results).

### Database Optimization
- Indexed columns for frequent queries (user email, document ID, access grants).
- Connection pooling (Prisma connection pool).
- Read replicas for analytics queries (future scaling).

### Async Processing
- All heavy operations (document parsing, AI generation) are async.
- User receives immediate response with job ID for status tracking.
- WebSocket or polling for real-time updates.
```

---

### 17. `/docs/03_Architecture_and_Design/Frontend_Architecture.md`

```markdown
# Frontend Architecture

> **This document defines the client-side architecture, technology stack, and specific implementation strategies for the secure viewer.**
> 
> **Related Documents:** 
> - [System_Architecture.md](./System_Architecture.md)
> - [Security_Requirements.md](../04_Security_and_Access/Security_Requirements.md)
> - [Performance_Requirements.md](../06_Quality_and_Standards/Performance_Requirements.md)

## 🛠️ Technology Stack

### Core Framework
- **Framework**: **Next.js 14+** with App Router
- **Why Next.js?**: 
  - Excellent SSR/SSG for marketing pages and SEO
  - Robust, type-safe environment for dashboard
  - Built-in image optimization and routing
  - Strong ecosystem and community support

### Language
- **TypeScript** (Strict mode enabled)
- All components, hooks, and utilities fully typed.

### Styling
- **Tailwind CSS**: Utility-first CSS framework for rapid, consistent styling.
- **shadcn/ui**: High-quality, accessible component library built on Radix UI.
- **Why this combination?**: 
  - Consistent design system out of the box.
  - Excellent accessibility (a11y) support.
  - Rapid development with minimal custom CSS.

### State Management

#### Server State
- **TanStack Query (React Query) v5**: 
  - Caching, deduplication, background refetching.
  - Optimistic updates for better UX.
  - Automatic garbage collection of stale data.

#### Client State
- **Zustand**: Lightweight, minimal boilerplate for ephemeral UI state.
- **Use cases**: 
  - Current viewer page number.
  - UI toggles (sidebar open/closed).
  - Temporary form data.

### Secure Rendering
- **PDF.js** (customized fork) or **react-pdf**: 
  - Configured to render pages to HTML5 `<canvas>` elements.
  - **Never** uses native `<iframe>` or `<object>` tags (security risk).

## 📁 Project Structure

```text
frontend/
├── app/                               # Next.js App Router
│   ├── (auth)/                        # Authentication Routes
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/                   # Creator Dashboard
│   │   ├── documents/
│   │   │   ├── page.tsx               # Document list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx           # Document details
│   │   │   │   └── analytics/
│   │   │   │       └── page.tsx       # Analytics view
│   │   │   └── upload/
│   │   │       └── page.tsx           # Upload flow
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (viewer)/                      # Secure Viewer (Buyer)
│   │   ├── library/
│   │   │   └── page.tsx               # User's document library
│   │   ├── view/
│   │   │   └── [documentId]/
│   │   │       └── page.tsx           # Secure document viewer
│   │   └── layout.tsx
│   │
│   ├── (marketing)/                   # Public Marketing Pages
│   │   ├── page.tsx                   # Landing page
│   │   ├── pricing/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── api/                           # API Routes (if needed)
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.ts
│   │
│   ├── layout.tsx                     # Root Layout
│   └── providers.tsx                  # Global Providers (Query, Auth, etc.)
│
├── components/                        # Reusable Components
│   ├── ui/                            # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   │
│   ├── viewer/                        # Secure Viewer Components
│   │   ├── SecureViewer.tsx           # Main viewer wrapper
│   │   ├── CanvasRenderer.tsx         # Canvas rendering logic
│   │   ├── WatermarkOverlay.tsx       # Dynamic watermark
│   │   ├── ViewerControls.tsx         # Zoom, page navigation
│   │   └── AIAssistant.tsx            # AI chat sidebar
│   │
│   ├── dashboard/                     # Dashboard Components
│   │   ├── DocumentCard.tsx
│   │   ├── UploadDropzone.tsx
│   │   └── AnalyticsChart.tsx
│   │
│   └── shared/                        # Shared Components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── LoadingSpinner.tsx
│
├── hooks/                             # Custom React Hooks
│   ├── useAuth.ts                     # Authentication hook
│   ├── useDocument.ts                 # Document data fetching
│   ├── useViewer.ts                   # Viewer state management
│   └── useAI.ts                       # AI assistant hook
│
├── lib/                               # Utility Functions & Config
│   ├── api/                           # API Client
│   │   ├── client.ts                  # Axios/fetch wrapper
│   │   ├── endpoints.ts               # API endpoint definitions
│   │   └── types.ts                   # API response types
│   │
│   ├── utils/                         # Utility Functions
│   │   ├── cn.ts                      # Tailwind class merger
│   │   ├── format.ts                  # Date/number formatters
│   │   └── validation.ts              # Validation schemas
│   │
│   └── constants.ts                   # App-wide constants
│
├── stores/                            # Zustand Stores
│   ├── viewerStore.ts                 # Viewer state
│   └── uiStore.ts                     # UI state (sidebar, modals)
│
├── types/                             # TypeScript Type Definitions
│   ├── document.ts
│   ├── user.ts
│   └── api.ts
│
├── styles/                            # Global Styles
│   └── globals.css
│
├── public/                            # Static Assets
│   ├── images/
│   └── fonts/
│
├── tests/                             # Test Files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.local.example                 # Environment Variables Template
├── next.config.js                     # Next.js Configuration
├── tailwind.config.ts                 # Tailwind Configuration
├── tsconfig.json                      # TypeScript Configuration
└── package.json                       # Dependencies & Scripts
```

## 🛡️ Secure Viewer Implementation Strategy

The secure viewer is the most critical frontend component. It must balance protection with UX.

### 1. Canvas Rendering
- Documents are rendered as images on a `<canvas>` element.
- **Benefits**: 
  - Prevents native browser "Save As" functionality.
  - Makes text selection/copying controllable.
  - Enables dynamic watermark overlay.

```typescript
// Simplified canvas rendering example
const renderPage = async (pageNumber: number) => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  
  // Fetch secure page image via presigned URL
  const imageUrl = await getSecurePageUrl(documentId, pageNumber);
  const img = new Image();
  img.src = imageUrl;
  
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
};
```

### 2. Dynamic Watermark Overlay
- A semi-transparent, absolutely positioned `<div>` is rendered **on top** of the canvas.
- Contains: user's email, user ID, and current timestamp.

```typescript
// Watermark component
const WatermarkOverlay = ({ userEmail, userId, timestamp }) => {
  return (
    <div 
      className="absolute inset-0 pointer-events-none select-none"
      style={{
        backgroundImage: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 100px,
          rgba(0, 0, 0, 0.03) 100px,
          rgba(0, 0, 0, 0.03) 200px
        )`,
      }}
    >
      {/* Repeating watermark text */}
      <div className="absolute inset-0 flex flex-wrap gap-20 opacity-20">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="text-sm text-gray-500 rotate-45">
            {userEmail} | {timestamp}
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### Anti-Screenshot Measures
- The watermark grid subtly shifts/rotates based on mouse movement or scroll position.
- Makes it difficult to cleanly crop out in a screenshot.

### 3. DOM Protection

```typescript
// Disable right-click
const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  return false;
};

// Disable text selection (unless explicitly allowed)
const viewerStyles = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  MozUserSelect: 'none',
  msUserSelect: 'none',
};

// If text selection is allowed, append watermark to copied text
const handleCopy = (e: React.ClipboardEvent) => {
  const selectedText = window.getSelection()?.toString();
  if (selectedText) {
    const watermark = `\n\n---\nCopied from KnowledgeVault\nUser: ${userEmail}\nTimestamp: ${new Date().toISOString()}`;
    e.clipboardData.setData('text/plain', selectedText + watermark);
    e.preventDefault();
  }
};
```

### 4. Session Heartbeat
- Frontend sends a lightweight heartbeat every 60 seconds.
- If backend detects session violation (e.g., login from 3rd device), it revokes the token.
- Frontend immediately displays "Session Terminated" screen.

```typescript
const useSessionHeartbeat = (documentId: string) => {
  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await validateSession(documentId);
      if (!response.valid) {
        showSessionTerminatedModal();
        clearInterval(interval);
      }
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, [documentId]);
};
```

## 📱 Responsive Design & UX

### Mobile-First Approach
- Viewer supports pinch-to-zoom and swipe navigation on mobile devices.
- Touch-friendly controls (large buttons, adequate spacing).
- Responsive layout adapts from mobile (320px) to desktop (1920px+).

### Lazy Loading Strategy
- Only the current page, the previous page, and the next page are rendered in the DOM.
- Minimizes memory usage and ensures < 2s load times.

```typescript
const useLazyPageLoading = (currentPage: number, totalPages: number) => {
  const pagesToRender = useMemo(() => {
    const pages = [];
    // Current page
    pages.push(currentPage);
    // Previous page
    if (currentPage > 1) pages.push(currentPage - 1);
    // Next page
    if (currentPage < totalPages) pages.push(currentPage + 1);
    return pages;
  }, [currentPage, totalPages]);
  
  return pagesToRender;
};
```

### Skeleton Loaders
- Used during AI generation or document fetching to maintain perceived performance.
- Provides visual feedback while content loads.

```typescript
const ViewerSkeleton = () => {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-96 bg-gray-200 rounded"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
};
```

## 🔄 Build & Deployment

### CI/CD Pipeline
- **GitHub Actions** runs on every PR:
  - `tsc --noEmit` (TypeScript type checking)
  - `eslint` (Code linting)
  - `prettier --check` (Code formatting)
  - `jest` (Unit tests)
  - `playwright` (E2E tests)

### Hosting
- **Vercel** or **AWS Amplify** for the Next.js frontend.
- Ensures global edge caching for static assets.
- Automatic HTTPS and CDN distribution.

### Environment Variables
```bash
# .env.local.example
NEXT_PUBLIC_API_URL=https://api.knowledgevault.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

## 📊 Performance Metrics

### Core Web Vitals Targets
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Monitoring
- **Sentry**: Error tracking and performance monitoring.
- **Vercel Analytics**: Real-user metrics (RUM).
- **Custom analytics**: Track viewer-specific metrics (page load time, AI query latency).
```