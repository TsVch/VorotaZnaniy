# ADR-004: HTTP Bridge for NestJS ↔ Python AI Worker Communication

```markdown
# ADR-004: Use HTTP Bridge for NestJS ↔ Python AI Worker Communication

> **This document records an architectural decision regarding inter-service communication between the Node.js backend and the Python AI Worker.**
> 
> **Status:** Accepted  
> **Date:** 2026-07-21  
> **Deciders:** CTO  
> **Supersedes:** Implicit assumption that BullMQ would be used for NestJS ↔ Python communication.

---

## 📝 Context

The KnowledgeVault SaaS platform uses a **Modular Monolith** for the core backend (NestJS / Node.js) and an **isolated AI Worker** (Python / FastAPI) for document parsing, embedding generation, and RAG queries (see [ADR-001](./001_Modular_Monolith_over_Microservices.md) and [ADR-002](./002_Isolated_AI_Worker.md)).

During the onboarding phase, the Implementation AI (Freebuff) identified a critical architectural gap: **BullMQ is a Node.js-only library**. There is no reliable, production-grade Python client that can consume BullMQ jobs natively. The original [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) document assumed BullMQ would be the universal message broker between all services, which is technically incorrect for cross-language communication.

We need a reliable, debuggable, and simple mechanism for:
1. The NestJS backend to dispatch document processing jobs (e.g., `document.uploaded`)
2. The Python AI Worker to pick up pending jobs
3. The Python AI Worker to return results (e.g., `document.processed`) back to NestJS
4. NestJS to react to completed jobs (update DB status, notify frontend)

This must work for MVP without introducing new infrastructure components.

## 🎯 Decision

We will implement an **HTTP Bridge pattern** for MVP:

1. **NestJS continues to use BullMQ** for internal Node.js ↔ Node.js job queuing (e.g., analytics, email dispatch).
2. **A dedicated NestJS "Jobs Bridge" module** exposes an internal HTTP API for the AI Worker:
   - `GET /internal/jobs/pending` — AI Worker polls for pending jobs (filtered by `job_type: 'ai_processing'`)
   - `POST /internal/jobs/{id}/result` — AI Worker submits processing results
   - `POST /internal/jobs/{id}/failure` — AI Worker reports failures
3. **The AI Worker (Python)** polls the `/internal/jobs/pending` endpoint at a configurable interval (default: 5 seconds), processes jobs, and posts results back.
4. **Authentication**: Internal API is protected by a shared secret (`X-Internal-API-Key` header) and is only accessible within the private VPC (not exposed to the public internet).
5. **Phase 2 Migration**: When scale demands it, migrate to **Redis Streams** (with `redis-py` for Python) or **RabbitMQ** for true push-based, multi-language message brokering.

### Sequence Diagram

```text
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  NestJS      │ publish  │   BullMQ     │          │  AI Worker   │
│  (Node.js)   │─────────▶│  (Redis)     │          │  (Python)    │
└──────┬───────┘          └──────────────┘          └──────┬───────┘
       │                                                   │
       │  [Jobs Bridge Module persists pending             │
       │   AI jobs to `pending_jobs` DB table]             │
       │                                                   │
       │         GET /internal/jobs/pending ◀──────────────│ (poll every 5s)
       │         ─────────────────────────────────────────▶│
       │         { jobs: [{id, type, payload}] }           │
       │                                                   │
       │         [AI Worker processes document]            │
       │                                                   │
       │         POST /internal/jobs/{id}/result ─────────▶│
       │         ◀─────────────────────────────────────────│ { status: 'success' }
       │                                                   │
       │  [Jobs Bridge emits 'document.processed' event]   │
       │  [DB updated, frontend notified via polling/WS]   │
```

## 📊 Alternatives Considered

### Alternative 1: Python BullMQ Client Library
- **Description**: Use an unofficial/community Python port of BullMQ (e.g., `py-bullmq`).
- **Rejected because**: 
  - No mature, maintained library exists.
  - High risk of protocol incompatibility with BullMQ's internal Redis data structures.
  - Would create a fragile dependency on an unofficial project.

### Alternative 2: Redis Streams (Direct)
- **Description**: Use Redis Streams (`XADD`, `XREADGROUP`) with `redis-py` in the AI Worker.
- **Rejected for MVP because**: 
  - Requires NestJS to also use Redis Streams instead of BullMQ for AI jobs, splitting the queuing strategy.
  - More complex to implement correctly (consumer groups, acknowledgments, dead-letter handling).
  - **Deferred to Phase 2** as the migration target.

### Alternative 3: RabbitMQ
- **Description**: Introduce RabbitMQ as a universal, multi-language message broker.
- **Rejected because**: 
  - Adds a new infrastructure component (violates KISS for MVP).
  - Increases operational complexity (another service to monitor, backup, and scale).
  - Overkill for the current job volume.

### Alternative 4: Shared Database Table (Job Queue Pattern)
- **Description**: NestJS writes jobs to a `jobs` table; AI Worker polls the table.
- **Rejected because**: 
  - Anti-pattern: database becomes a queue, leading to row-locking contention.
  - No built-in retry, dead-letter, or priority handling.
  - Poor scalability characteristics.

## ⚖️ Consequences

### Positive
- **Zero new infrastructure**: Uses existing NestJS HTTP server and Redis (for BullMQ internal jobs).
- **Language-agnostic**: Python AI Worker only needs `httpx` (already in `requirements.txt`).
- **Easy to debug**: Jobs are visible in NestJS logs, DB table, and via internal API.
- **Simple to test**: Mock HTTP endpoints in integration tests.
- **Clear migration path**: Phase 2 migration to Redis Streams is a drop-in replacement at the protocol level.

### Negative / Risks
- **Polling overhead**: AI Worker polls every 5 seconds, even when idle. Mitigated by:
  - Exponential backoff when no jobs are found (5s → 10s → 30s max).
  - Low cost: single lightweight HTTP request.
- **Latency**: Worst-case 5 seconds between job creation and pickup. Acceptable for async document processing (not user-facing latency).
- **DB table for pending jobs**: Adds a `pending_jobs` table to the schema. Mitigated by:
  - Automatic cleanup of completed jobs (TTL: 24 hours).
  - Indexed by `status` and `job_type`.
- **Single point of failure**: If NestJS is down, AI Worker cannot fetch jobs. Mitigated by:
  - AI Worker retries with backoff.
  - NestJS has high availability via ECS auto-scaling.

## 🔗 Related Documents

- [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) — Updated to reflect HTTP Bridge pattern.
- [System Architecture](../03_Architecture_and_Design/System_Architecture.md) — High-level service interaction.
- [ADR-001](./001_Modular_Monolith_over_Microservices.md) — Modular monolith decision.
- [ADR-002](./002_Isolated_AI_Worker.md) — AI Worker isolation decision.
- [API Contracts](../03_Architecture_and_Design/API_Contracts.md) — Will be updated with internal job endpoints.
- [Security Requirements](../04_Security_and_Access/Security_Requirements.md) — Internal API authentication rules.

## 📌 Implementation Notes (for Freebuff)

When implementing TASK-001 and subsequent tasks:
1. Create a new NestJS module: `src/jobs-bridge/` with:
   - `jobs-bridge.controller.ts` — Internal HTTP endpoints
   - `jobs-bridge.service.ts` — Job persistence and event emission
   - `jobs-bridge.module.ts`
2. Add `pending_jobs` table to Prisma schema (see updated [Database Design](../03_Architecture_and_Design/Database_Design.md)).
3. AI Worker: implement `app/jobs/poller.py` with `httpx.AsyncClient` polling loop.
4. Internal API endpoints must be guarded by `InternalApiKeyGuard` (validates `X-Internal-API-Key` header).
5. All internal API endpoints must be excluded from public Swagger documentation (`@ApiExcludeEndpoint()`).
```
