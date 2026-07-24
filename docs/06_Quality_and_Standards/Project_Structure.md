```markdown
# Project Structure

> **This document defines the mandatory folder and file structure for the KnowledgeVault SaaS platform monorepo.**
> 
> **Related Documents:** 
> - [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md)
> - [Frontend Architecture](../03_Architecture_and_Design/Frontend_Architecture.md)
> - [Coding Standards](./Coding_Standards.md)
> - [Deployment](../05_Infrastructure_and_Operations/Deployment.md)
> - [INDEX](../INDEX.md)

---

## 🎯 Structural Philosophy

As CTO, I enforce **Convention over Configuration**. The project structure must be:
1. **Predictable**: Any developer (or AI agent) can find any file within 5 seconds.
2. **Scalable**: Structure supports growth from MVP to Enterprise without reorganization.
3. **Separation of Concerns**: Backend, Frontend, AI Worker, and Infrastructure are strictly isolated.
4. **Documentation First**: The `/docs` folder is the single source of truth and lives alongside the code.

---

## 📁 Root Monorepo Structure

```text
knowledge-vault-saas/
├── .github/                          # GitHub-specific configurations
│   ├── workflows/                    # CI/CD pipelines (GitHub Actions)
│   │   ├── pr-validation.yml
│   │   ├── staging-deploy.yml
│   │   └── production-deploy.yml
│   ├── ISSUE_TEMPLATE/               # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
│
├── docs/                             # Project Blueprint (Single Source of Truth)
│   ├── README.md
│   ├── INDEX.md
│   ├── 01_Strategy_and_Business/
│   ├── 02_Product_and_UX/
│   ├── 03_Architecture_and_Design/
│   ├── 04_Security_and_Access/
│   ├── 05_Infrastructure_and_Operations/
│   ├── 06_Quality_and_Standards/
│   └── 07_Management_and_Process/
│
├── backend/                          # NestJS Core API (Node.js)
│   ├── src/
│   ├── prisma/
│   ├── test/
│   └── [config files]
│
├── ai_worker/                        # Python FastAPI AI Service
│   ├── app/
│   ├── tests/
│   └── [config files]
│
├── frontend/                         # Next.js Web Application
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── [config files]
│
├── infrastructure/                   # Infrastructure as Code & DevOps
│   ├── docker/                       # Docker configurations
│   ├── terraform/                    # Terraform modules (Phase 2+)
│   ├── k8s/                          # Kubernetes manifests (Phase 3)
│   └── scripts/                      # Deployment and utility scripts
│
├── packages/                         # Shared code (optional, Phase 2+)
│   ├── shared-types/                 # TypeScript types shared between frontend/backend
│   └── eslint-config/                # Shared ESLint configuration
│
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── .nvmrc                            # Node.js version (20.x)
├── .prettierrc                       # Prettier configuration
├── .eslintrc.js                      # ESLint configuration
├── docker-compose.yml                # Local development environment
├── package.json                      # Root package.json (workspaces)
├── pnpm-workspace.yaml               # pnpm workspace configuration (if using pnpm)
├── README.md                         # Project overview
├── CHANGELOG.md                      # Release changelog
└── LICENSE                           # License file
```

---

## 📁 Backend Structure (`/backend`)

```text
backend/
├── src/
│   ├── main.ts                       # Application entry point
│   ├── app.module.ts                 # Root module
│   │
│   ├── auth/                         # Authentication & Authorization Module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── oauth.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── workspace-owner.guard.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── refresh-token.dto.ts
│   │   └── __tests__/
│   │       ├── auth.service.spec.ts
│   │       └── auth.controller.spec.ts
│   │
│   ├── users/                        # User Management Module
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   └── __tests__/
│   │
│   ├── workspaces/                   # Workspace Management Module
│   │   ├── workspaces.module.ts
│   │   ├── workspaces.controller.ts
│   │   ├── workspaces.service.ts
│   │   ├── entities/
│   │   │   └── workspace.entity.ts
│   │   ├── dto/
│   │   │   ├── create-workspace.dto.ts
│   │   │   └── update-workspace.dto.ts
│   │   └── __tests__/
│   │
│   ├── documents/                    # Document Management Module
│   │   ├── documents.module.ts
│   │   ├── documents.controller.ts
│   │   ├── documents.service.ts
│   │   ├── entities/
│   │   │   ├── document.entity.ts
│   │   │   └── document-version.entity.ts
│   │   ├── dto/
│   │   │   ├── create-document.dto.ts
│   │   │   ├── upload-init.dto.ts
│   │   │   └── upload-complete.dto.ts
│   │   ├── processors/
│   │   │   └── document-upload.processor.ts
│   │   └── __tests__/
│   │
│   ├── access/                       # DRM & Access Control Module
│   │   ├── access.module.ts
│   │   ├── access.controller.ts
│   │   ├── access.service.ts
│   │   ├── entities/
│   │   │   ├── access-grant.entity.ts
│   │   │   └── session.entity.ts
│   │   ├── services/
│   │   │   ├── watermark.service.ts
│   │   │   └── session-validator.service.ts
│   │   └── __tests__/
│   │
│   ├── viewer/                       # Secure Viewer Module
│   │   ├── viewer.module.ts
│   │   ├── viewer.controller.ts
│   │   ├── viewer.service.ts
│   │   └── __tests__/
│   │
│   ├── ai/                           # AI Integration Module (Proxy to AI Worker)
│   │   ├── ai.module.ts
│   │   ├── ai.controller.ts
│   │   ├── ai.service.ts
│   │   ├── dto/
│   │   │   ├── query.dto.ts
│   │   │   └── summary.dto.ts
│   │   └── __tests__/
│   │
│   ├── analytics/                    # Analytics & Tracking Module
│   │   ├── analytics.module.ts
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   ├── entities/
│   │   │   └── view-event.entity.ts
│   │   └── __tests__/
│   │
│   ├── billing/                      # Payment & Subscription Module
│   │   ├── billing.module.ts
│   │   ├── billing.controller.ts
│   │   ├── billing.service.ts
│   │   ├── entities/
│   │   │   └── subscription.entity.ts
│   │   ├── webhooks/
│   │   │   └── stripe-webhook.handler.ts
│   │   └── __tests__/
│   │
│   ├── shared/                       # Shared Infrastructure
│   │   ├── config/
│   │   │   ├── configuration.ts
│   │   │   └── env.validation.ts
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
│   │   │   ├── queue.service.ts
│   │   │   └── logger.service.ts
│   │   └── types/
│   │       ├── common.types.ts
│   │       └── events.ts
│   │
│   └── health/                       # Health Check Module
│       ├── health.module.ts
│       └── health.controller.ts
│
├── prisma/
│   ├── schema.prisma                 # Database schema definition
│   ├── migrations/                   # Database migrations
│   │   ├── 20260721000000_init/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── seed.ts                       # Database seeding script
│
├── test/
│   ├── unit/                         # Unit tests (co-located with modules preferred)
│   ├── integration/                  # Integration tests
│   │   ├── documents.integration.spec.ts
│   │   └── auth.integration.spec.ts
│   └── e2e/                          # End-to-end tests
│       └── app.e2e-spec.ts
│
├── .env.example                      # Environment variables template
├── .eslintrc.js                      # ESLint configuration
├── .prettierrc                       # Prettier configuration
├── nest-cli.json                     # NestJS CLI configuration
├── tsconfig.json                     # TypeScript configuration
├── tsconfig.build.json               # TypeScript build configuration
├── package.json                      # Dependencies and scripts
├── Dockerfile                        # Production Docker image
└── README.md                         # Backend-specific documentation
```

---

## 📁 AI Worker Structure (`/ai_worker`)

```text
ai_worker/
├── app/
│   ├── main.py                       # FastAPI application entry point
│   │
│   ├── api/                          # API Routes
│   │   ├── routes/
│   │   │   ├── health.py
│   │   │   ├── process.py            # Document processing endpoints
│   │   │   └── query.py              # RAG query endpoints
│   │   ├── deps.py                   # FastAPI dependencies
│   │   └── middleware/
│   │       └── auth.py               # Internal API authentication
│   │
│   ├── parsers/                      # Document Parsing Logic
│   │   ├── base_parser.py
│   │   ├── pdf_parser.py
│   │   ├── epub_parser.py
│   │   └── chunker.py                # Text chunking for embeddings
│   │
│   ├── rag/                          # RAG Pipeline
│   │   ├── embeddings.py             # Embedding generation
│   │   ├── vector_store.py           # Vector DB operations (pgvector)
│   │   ├── retriever.py              # Document retrieval
│   │   ├── generator.py              # LLM response generation
│   │   └── prompts/
│   │       ├── summary.txt
│   │       ├── qa.txt
│   │       └── quiz.txt
│   │
│   ├── jobs/                         # Background Workers
│   │   ├── base_job.py
│   │   ├── document_processor.py     # Main document processing job
│   │   └── embedding_generator.py    # Batch embedding job
│   │
│   ├── core/                         # Core Configuration
│   │   ├── config.py                 # Settings & environment variables
│   │   ├── database.py               # Database connection
│   │   ├── redis.py                  # Redis connection
│   │   └── logging.py                # Logging configuration
│   │
│   ├── models/                       # Pydantic Models
│   │   ├── document.py
│   │   ├── query.py
│   │   └── response.py
│   │
│   └── utils/                        # Utility Functions
│       ├── text_cleaner.py
│       ├── token_counter.py
│       └── cache.py
│
├── tests/
│   ├── unit/
│   │   ├── test_parsers.py
│   │   └── test_rag.py
│   ├── integration/
│   │   └── test_api.py
│   └── fixtures/                     # Test data
│       └── sample_documents/
│
├── .env.example                      # Environment variables template
├── requirements.txt                  # Python dependencies
├── pyproject.toml                    # Python project configuration
├── Dockerfile                        # Production Docker image
└── README.md                         # AI Worker-specific documentation
```

---

## 📁 Frontend Structure (`/frontend`)

```text
frontend/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Landing page (marketing)
│   ├── globals.css                   # Global styles
│   ├── providers.tsx                 # Global providers (QueryClient, Auth, Theme)
│   │
│   ├── (auth)/                       # Authentication Routes (no dashboard layout)
│   │   ├── layout.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── magic-link/
│   │       └── page.tsx
│   │
│   ├── (dashboard)/                  # Creator Dashboard (protected)
│   │   ├── layout.tsx                # Dashboard layout (sidebar, header)
│   │   ├── page.tsx                  # Dashboard home
│   │   ├── documents/
│   │   │   ├── page.tsx              # Document list
│   │   │   ├── upload/
│   │   │   │   └── page.tsx          # Upload flow
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Document details
│   │   │       ├── analytics/
│   │   │       │   └── page.tsx
│   │   │       └── settings/
│   │   │           └── page.tsx
│   │   ├── settings/
│   │   │   ├── page.tsx              # Workspace settings
│   │   │   └── billing/
│   │   │       └── page.tsx
│   │   └── analytics/
│   │       └── page.tsx              # Workspace analytics
│   │
│   ├── (viewer)/                     # Secure Viewer (Buyer)
│   │   ├── layout.tsx
│   │   ├── library/
│   │   │   └── page.tsx              # User's document library
│   │   └── view/
│   │       └── [documentId]/
│   │           └── page.tsx          # Secure document viewer
│   │
│   ├── (marketing)/                  # Public Marketing Pages
│   │   ├── layout.tsx
│   │   ├── pricing/
│   │   │   └── page.tsx
│   │   ├── features/
│   │   │   └── page.tsx
│   │   └── about/
│   │       └── page.tsx
│   │
│   └── api/                          # API Routes (Next.js serverless functions)
│       └── webhooks/
│           └── stripe/
│               └── route.ts          # Stripe webhook handler
│
├── components/                       # Reusable React Components
│   ├── ui/                           # shadcn/ui components (primitives)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   │
│   ├── viewer/                       # Secure Viewer Components
│   │   ├── SecureViewer.tsx          # Main viewer wrapper
│   │   ├── CanvasRenderer.tsx        # Canvas rendering logic
│   │   ├── WatermarkOverlay.tsx      # Dynamic watermark
│   │   ├── ViewerControls.tsx        # Zoom, page navigation
│   │   ├── AIAssistant.tsx           # AI chat sidebar
│   │   ├── TextLayer.tsx             # Controlled text selection
│   │   └── SessionGuard.tsx          # Session validation
│   │
│   ├── dashboard/                    # Dashboard Components
│   │   ├── DocumentCard.tsx
│   │   ├── UploadDropzone.tsx
│   │   ├── AnalyticsChart.tsx
│   │   ├── ProtectionSettings.tsx
│   │   └── StatsOverview.tsx
│   │
│   ├── auth/                         # Auth Components
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── OAuthButtons.tsx
│   │
│   └── shared/                       # Shared Components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       ├── Footer.tsx
│       ├── LoadingSpinner.tsx
│       ├── ErrorBoundary.tsx
│       └── EmptyState.tsx
│
├── hooks/                            # Custom React Hooks
│   ├── useAuth.ts                    # Authentication hook
│   ├── useDocument.ts                # Document data fetching
│   ├── useViewer.ts                  # Viewer state management
│   ├── useAI.ts                      # AI assistant hook
│   ├── useSessionHeartbeat.ts        # Session validation
│   ├── useDebounce.ts                # Debounce utility
│   └── useLocalStorage.ts            # Local storage hook
│
├── lib/                              # Utility Functions & Config
│   ├── api/                          # API Client
│   │   ├── client.ts                 # Fetch wrapper with auth
│   │   ├── endpoints.ts              # API endpoint definitions
│   │   ├── types.ts                  # API response types
│   │   └── errors.ts                 # Error handling
│   │
│   ├── utils/                        # Utility Functions
│   │   ├── cn.ts                     # Tailwind class merger (clsx + tailwind-merge)
│   │   ├── format.ts                 # Date/number formatters
│   │   ├── validation.ts             # Zod validation schemas
│   │   └── constants.ts              # App-wide constants
│   │
│   └── config/                       # Configuration
│       ├── env.ts                    # Environment variables
│       └── site.ts                   # Site metadata
│
├── stores/                           # Zustand Stores (Client State)
│   ├── viewerStore.ts                # Viewer state (page, zoom, sidebar)
│   ├── uiStore.ts                    # UI state (modals, toasts)
│   └── authStore.ts                  # Auth state (if needed beyond context)
│
├── types/                            # TypeScript Type Definitions
│   ├── document.ts
│   ├── user.ts
│   ├── api.ts
│   └── viewer.ts
│
├── styles/                           # Additional Styles (if needed)
│   └── viewer.css                    # Viewer-specific styles
│
├── public/                           # Static Assets
│   ├── images/
│   ├── fonts/
│   ├── icons/
│   └── favicon.ico
│
├── tests/                            # Test Files
│   ├── unit/                         # Unit tests (co-located with components preferred)
│   ├── integration/
│   └── e2e/                          # Playwright E2E tests
│       ├── viewer.spec.ts
│       ├── auth.spec.ts
│       └── dashboard.spec.ts
│
├── .env.local.example                # Environment variables template
├── .eslintrc.js                      # ESLint configuration
├── .prettierrc                       # Prettier configuration
├── next.config.js                    # Next.js configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
├── postcss.config.js                 # PostCSS configuration
├── package.json                      # Dependencies and scripts
├── vercel.json                       # Vercel deployment configuration
└── README.md                         # Frontend-specific documentation
```

---

## 📁 Infrastructure Structure (`/infrastructure`)

```text
infrastructure/
├── docker/                           # Docker Configurations
│   ├── backend/
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   ├── ai-worker/
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   └── frontend/
│       ├── Dockerfile
│       └── .dockerignore
│
├── terraform/                        # Infrastructure as Code (Phase 2+)
│   ├── modules/
│   │   ├── vpc/
│   │   ├── ecs/
│   │   ├── rds/
│   │   └── redis/
│   ├── environments/
│   │   ├── staging/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── terraform.tfvars
│   │   └── production/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       └── terraform.tfvars
│   └── README.md
│
├── k8s/                              # Kubernetes Manifests (Phase 3)
│   ├── base/
│   │   ├── backend-deployment.yaml
│   │   ├── ai-worker-deployment.yaml
│   │   └── ingress.yaml
│   └── overlays/
│       ├── staging/
│       └── production/
│
├── scripts/                          # Utility Scripts
│   ├── deploy.sh                     # Deployment script
│   ├── backup-db.sh                  # Database backup script
│   ├── migrate.sh                    # Database migration script
│   └── seed-db.sh                    # Database seeding script
│
└── README.md                         # Infrastructure documentation
```

---

## 📁 Documentation Structure (`/docs`)

```text
docs/
├── README.md                         # Blueprint overview
├── INDEX.md                          # Navigation hub
│
├── 01_Strategy_and_Business/
│   ├── Vision.md
│   ├── Business_Requirements.md
│   ├── Market_Analysis.md
│   ├── Competitive_Analysis.md
│   ├── Value_Proposition.md
│   └── Business_Model.md
│
├── 02_Product_and_UX/
│   ├── User_Personas.md
│   ├── User_Journey.md
│   ├── PRD.md
│   ├── Feature_Catalog.md
│   ├── MVP_Scope.md
│   └── Roadmap.md
│
├── 03_Architecture_and_Design/
│   ├── System_Architecture.md
│   ├── Backend_Architecture.md
│   ├── Frontend_Architecture.md
│   ├── Database_Design.md
│   └── API_Contracts.md
│
├── 04_Security_and_Access/
│   ├── Authentication.md
│   ├── Authorization.md
│   ├── Roles_and_Permissions.md
│   └── Security_Requirements.md
│
├── 05_Infrastructure_and_Operations/
│   ├── Integrations.md
│   ├── Infrastructure.md
│   ├── Deployment.md
│   └── Release_Plan.md
│
├── 06_Quality_and_Standards/
│   ├── Testing_Strategy.md
│   ├── Performance_Requirements.md
│   ├── Scalability_Strategy.md
│   ├── Coding_Standards.md
│   └── Project_Structure.md
│
└── 07_Management_and_Process/
    ├── Definition_of_Done.md
    ├── Acceptance_Criteria.md
    ├── ADR/
    │   ├── 000_ADR_Template.md
    │   ├── 001_modular_monolith.md
    │   └── ...
    ├── Risk_Register.md
    ├── Glossary.md
    └── Task_Package_Template.md
```

---

## 📌 Key Takeaways for Implementation (Freebuff)

When Freebuff creates or modifies files, it **must** adhere to this structure:

1. **No Deviations**: Do not create new top-level folders without CTO approval.
2. **Co-locate Tests**: Unit tests should be in `__tests__/` folders within each module (backend) or co-located with components (frontend).
3. **Shared Code**: If code is shared between backend and frontend, it goes in `/packages/shared-types/` (Phase 2+). For MVP, duplicate types are acceptable.
4. **Configuration Files**: All configuration files (`.eslintrc`, `tsconfig.json`, etc.) must be at the root of their respective service folders (`/backend`, `/frontend`, `/ai_worker`).
5. **Documentation**: All architectural decisions must be documented in `/docs`. Code comments are for "why", not "what".
6. **Environment Variables**: Never hardcode environment variables. Always use `.env.example` as a template and inject via CI/CD.

---

## 🔗 Related Documents

- [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) - Detailed NestJS module structure.
- [Frontend Architecture](../03_Architecture_and_Design/Frontend_Architecture.md) - Detailed Next.js component structure.
- [Coding Standards](./Coding_Standards.md) - Naming conventions and file organization rules.
- [Deployment](../05_Infrastructure_and_Operations/Deployment.md) - How this structure maps to Docker and CI/CD.
- [INDEX](../INDEX.md) - Overall project navigation.
```