```markdown
# Performance Requirements

> **This document defines the Service Level Agreements (SLAs), latency targets, throughput limits, and resource constraints for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [System Architecture](../03_Architecture_and_Design/System_Architecture.md)
> - [Frontend Architecture](../03_Architecture_and_Design/Frontend_Architecture.md)
> - [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md)
> - [Database Design](../03_Architecture_and_Design/Database_Design.md)
> - [Scalability Strategy](./Scalability_Strategy.md)
> - [Testing Strategy](./Testing_Strategy.md)

---

## 🎯 Performance Philosophy

As a CTO, I enforce **Performance by Design**. We do not optimize prematurely, but we design systems that are inherently performant under expected MVP and Growth loads. 

### Core Principles
1. **Measurable over Subjective**: Every performance requirement must have a quantifiable metric (e.g., "p95 latency < 200ms", not "fast").
2. **User-Centric**: Prioritize metrics that directly impact the user experience (e.g., Time to Interactive for the Secure Viewer).
3. **Cost-Aware**: Performance optimizations must not disproportionately increase infrastructure costs (e.g., aggressive caching to reduce LLM API calls).
4. **Graceful Degradation**: Under heavy load, non-critical features (e.g., AI summaries) may be delayed or queued, but core functionality (auth, viewing) must remain available.

---

## ⚡ 1. Frontend Performance (Next.js)

### Core Web Vitals (Lighthouse / Vercel Analytics)
Targets apply to the Creator Dashboard and Marketing pages on a standard 4G connection (or equivalent throttled desktop).

| Metric | Target (p75) | Critical Threshold |
| :--- | :--- | :--- |
| **LCP** (Largest Contentful Paint) | < 1.5s | < 2.5s |
| **FID** (First Input Delay) / **INP** | < 100ms | < 200ms |
| **CLS** (Cumulative Layout Shift) | < 0.05 | < 0.1 |
| **TTI** (Time to Interactive) | < 2.0s | < 3.0s |

### Secure Viewer Specifics
The Secure Viewer is the core product. Its performance is paramount.

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| **Initial Viewer Load** | < 2.0s | Time from clicking "View" to first page rendered on canvas. |
| **Page Turn Latency** | < 150ms | Time to render next/previous page (must feel instantaneous). |
| **AI Chat Response (TTFB)** | < 1.5s | Time to first token from the AI assistant. |
| **Memory Usage (Desktop)** | < 150MB | Prevent browser tab crashes on long documents. |
| **Memory Usage (Mobile)** | < 80MB | Ensure compatibility with mid-tier mobile devices. |

**Optimization Mandates:**
- Lazy load document pages (render only current, prev, and next).
- Serve processed page tiles via Cloudflare CDN (cached, compressed WebP).
- Defer non-critical JavaScript (e.g., analytics, AI chat widget initialization).

---

## 🚀 2. Backend API Performance (NestJS)

Targets apply to the Production environment under normal load (up to 1,000 concurrent users).

### Latency Targets (p95)

| Endpoint Category | Target (p95) | Max Allowed (p99) |
| :--- | :--- | :--- |
| **Authentication** (`/auth/*`) | < 100ms | < 250ms |
| **Document Metadata** (`GET /documents`) | < 150ms | < 300ms |
| **Upload Init** (`POST /documents/upload-init`) | < 200ms | < 500ms |
| **Presigned URL Generation** (`GET /viewer/.../pages/...`) | < 50ms | < 100ms |
| **Session Heartbeat** (`POST /viewer/.../heartbeat`) | < 50ms | < 100ms |
| **AI Query** (`POST /ai/query`) | < 2000ms | < 4000ms *(Excludes LLM generation time)* |

### Throughput & Concurrency
- **Target RPS (Requests Per Second)**: 500 RPS sustained per backend instance.
- **Max Concurrent Connections**: 10,000 per backend instance (handled via Node.js event loop + connection pooling).
- **Queue Processing**: AI Worker must process document embedding jobs at a rate of at least 10 pages/second per worker instance.

---

## 🗄️ 3. Database & Storage Performance (PostgreSQL + Redis + R2)

### PostgreSQL
| Metric | Target | Action if Exceeded |
| :--- | :--- | :--- |
| **Simple Query (Indexed)** | < 10ms | Review index usage, add missing index. |
| **Complex Query (Joins/Aggregations)** | < 100ms | Optimize query, consider materialized view. |
| **Connection Pool Saturation** | < 70% | Increase pool size or add read replicas. |
| **Write Latency (Insert/Update)** | < 20ms | Check disk I/O, batch writes if possible. |

### Redis (Cache & Queue)
| Metric | Target | Action if Exceeded |
| :--- | :--- | :--- |
| **Cache Hit Latency** | < 5ms | N/A (Normal operation) |
| **Queue Job Dispatch** | < 10ms | Check Redis CPU/Memory limits. |
| **Memory Usage** | < 80% of allocated | Implement LRU eviction policy, review TTLs. |

### Object Storage (Cloudflare R2 / S3)
- **Presigned URL Generation**: < 20ms.
- **Asset Fetch (via CDN)**: < 100ms (p95) globally.
- **Upload Throughput**: Support sustained 50 MB/s per user (limited by client network, not backend).

---

## 🤖 4. AI & RAG Worker Performance

AI operations are inherently slower, but we must enforce strict boundaries to prevent runaway costs and UX degradation.

| Operation | Target | Constraints |
| :--- | :--- | :--- |
| **Document Parsing & Chunking** | < 5s per 10 pages | Run asynchronously. Update status via webhook/queue. |
| **Embedding Generation** | < 2s per 10 chunks | Batch requests (up to 100 chunks per API call). |
| **Vector Search (pgvector)** | < 50ms (p95) | Limit `top_k` to 5-10. Ensure IVFFlat/HNSW index is built. |
| **LLM Generation (Q&A)** | < 3s (Time to First Byte) | Stream response to frontend if possible. Max 500 output tokens. |
| **Summary Generation** | < 10s (Total) | Run async on upload. Cache result indefinitely. |

**Circuit Breaker Rule**: If LLM API latency exceeds 5000ms or error rate exceeds 5%, the AI service must return a graceful fallback message ("AI is temporarily busy, please try again") rather than hanging the request.

---

## 📊 5. Load Testing & Scalability Targets

Before any Major Release, the system must pass automated load testing (e.g., using k6 or Artillery).

### MVP Load Test Scenario
- **Users**: 1,000 concurrent virtual users.
- **Duration**: 15 minutes.
- **Mix**: 60% Viewer page loads, 20% AI queries, 10% Auth, 10% Dashboard actions.
- **Pass Criteria**:
  - 0% error rate (5xx responses).
  - p95 latency remains within defined targets.
  - Database CPU < 60%.
  - No memory leaks detected in Node.js or Python processes.

### Growth Load Test Scenario (Phase 2)
- **Users**: 10,000 concurrent virtual users.
- **Pass Criteria**: Same as MVP, but validates auto-scaling triggers (ECS task count increases, read replicas engage).

---

## 🚨 6. Monitoring & Alerting Thresholds

Performance is useless without visibility. The following alerts must be configured in CloudWatch / Datadog / Sentry.

| Metric | Warning Threshold | Critical Threshold |
| :--- | :--- | :--- |
| **API Error Rate (5xx)** | > 1% over 5 min | > 5% over 2 min |
| **API Latency (p95)** | > 500ms over 10 min | > 1000ms over 5 min |
| **Database CPU** | > 70% over 10 min | > 90% over 5 min |
| **Database Connections** | > 80% of max pool | > 95% of max pool |
| **Redis Memory** | > 75% | > 90% |
| **AI Worker Queue Depth** | > 100 jobs | > 500 jobs |
| **Frontend JS Errors** | > 50 per hour | > 200 per hour |

---

## 📌 Key Takeaways for Implementation (Freebuff)

When implementing features, Freebuff must adhere to these performance constraints:

1. **N+1 Queries are Forbidden**: Always use Prisma `include` or batch queries. N+1 queries will fail the p95 latency target.
2. **Pagination is Mandatory**: Any endpoint returning a list of resources must implement cursor or offset pagination. Never return unbounded arrays.
3. **Async for Heavy Lifting**: Document parsing, AI embedding, and summary generation **must** be offloaded to the Redis queue. The API must return `202 Accepted` immediately.
4. **Index Your Queries**: Every `WHERE`, `ORDER BY`, or `JOIN` clause in Prisma must have a corresponding database index defined in `Database_Design.md`.
5. **Stream or Cache AI**: For long AI responses, implement streaming (Server-Sent Events) or cache identical queries to reduce LLM latency and cost.
6. **Measure Before Optimizing**: Do not add complex caching layers (e.g., Redis) without first proving the endpoint is a bottleneck via profiling.

---

## 🔗 Related Documents

- [Testing Strategy](./Testing_Strategy.md) - Defines how performance and load tests are executed in CI/CD.
- [Scalability Strategy](./Scalability_Strategy.md) - Defines how the system adapts when these performance targets are exceeded.
- [Database Design](../03_Architecture_and_Design/Database_Design.md) - Contains the required indexes to meet query latency targets.
- [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) - Defines the queue-based async processing model.
```