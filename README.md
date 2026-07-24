# KnowledgeVault SaaS

> **Secure document delivery and interactive learning platform — a SaaS for creators who sell digital knowledge.**

## Overview

KnowledgeVault replaces insecure file downloads with a protected, analytics-driven, AI-enhanced web viewing experience. Authors upload their content (PDFs, books, templates), configure DRM protections, and buyers get a secure canvas-based viewer with an AI assistant trained on the specific document.

## Monorepo Structure

```
├── backend/           # NestJS Core API (Node.js + TypeScript)
├── frontend/          # Next.js Web Application
├── ai_worker/         # Python FastAPI AI Service
├── infrastructure/    # Docker, Terraform, Kubernetes configs
├── packages/          # Shared code (types, configs)
└── docs/              # Project Blueprint (single source of truth)
```

## Prerequisites

- **Node.js** >= 20.0.0 (see `.nvmrc`)
- **pnpm** >= 9.0.0
- **Docker** & **Docker Compose** (for local development)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables
cp .env.example .env
# Edit .env with your local values

# 3. Start development services (requires Docker)
docker compose up -d

# 4. Start development servers
pnpm dev
```

## Available Commands

| Command             | Description                            |
| :------------------ | :------------------------------------- |
| `pnpm dev`          | Start all services in development mode |
| `pnpm build`        | Build all packages for production      |
| `pnpm lint`         | Run ESLint across all packages         |
| `pnpm format`       | Format code with Prettier              |
| `pnpm format:check` | Check formatting without writing       |
| `pnpm type-check`   | Run TypeScript type checking           |
| `pnpm test`         | Run all tests                          |
| `pnpm clean`        | Clean build artifacts                  |

## Documentation

The complete **Project Blueprint** lives in the [`/docs`](./docs/README.md) directory. This is the single source of truth for all architectural decisions, security requirements, and product strategy.

## License

All rights reserved. KnowledgeVault SaaS — proprietary software.
