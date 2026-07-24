```markdown
# Infrastructure

> **This document defines the cloud infrastructure, network topology, compute environments, storage strategy, and operational standards for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [System Architecture](../03_Architecture_and_Design/System_Architecture.md)
> - [Security Requirements](../04_Security_and_Access/Security_Requirements.md)
> - [Integrations](./Integrations.md)
> - [Deployment](./Deployment.md)

---

## 🎯 Infrastructure Decision Summary

| Component | Decision | Rationale | ADR Reference |
| :--- | :--- | :--- | :--- |
| Cloud Provider | AWS + Cloudflare | Industry standard, robust, Cloudflare for zero-egress storage/CDN | ADR-030 |
| Frontend Hosting | Vercel | Global edge network, seamless Next.js integration, zero ops | ADR-031 |
| Backend Compute | AWS ECS Fargate (or Render) | Containerized, serverless scaling, no VM management overhead | ADR-032 |
| Database | AWS RDS (PostgreSQL 15) | Managed, automated backups, Multi-AZ support, pgvector ready | ADR-033 |
| Cache / Queue | AWS ElastiCache (Redis 7) | Managed, low latency, native BullMQ support | ADR-034 |
| Object Storage | Cloudflare R2 (or AWS S3) | S3-compatible API, **zero egress fees** (critical for document viewing) | ADR-035 |
| DNS / WAF / CDN | Cloudflare | DDoS protection, edge caching, unified security posture | ADR-036 |
| Secrets Management | AWS Secrets Manager / Doppler | Centralized, encrypted, audit-logged, no `.env` files in repos | ADR-037 |

---

## 🌐 Network Topology

The infrastructure is designed with a strict **Public vs. Private** network segregation to enforce Security by Design.

### Virtual Private Cloud (VPC) Architecture
- **Public Subnets**: 
  - Application Load Balancer (ALB) for backend API.
  - NAT Gateway (to allow private resources to fetch updates/packages).
- **Private Subnets**: 
  - ECS Fargate tasks (Backend API, AI Worker).
  - AWS RDS (PostgreSQL).
  - AWS ElastiCache (Redis).
- **Security Groups**:
  - **ALB**: Inbound 443 (from Cloudflare IPs only), Outbound to ECS.
  - **ECS Backend**: Inbound 3000 (from ALB only), Outbound to RDS, Redis, S3/R2, External APIs.
  - **ECS AI Worker**: Inbound 8000 (from ECS Backend only), Outbound to RDS, Redis, External LLM APIs.
  - **RDS**: Inbound 5432 (from ECS Security Groups only).
  - **Redis**: Inbound 6379 (from ECS Security Groups only).

### Edge Layer (Cloudflare)
- All public traffic routes through Cloudflare.
- Cloudflare WAF blocks known malicious IPs, SQLi, and XSS patterns.
- Cloudflare CDN caches static frontend assets and public marketing pages.
- Strict TLS 1.3 enforced at the edge.

---

## 💻 Compute Environments

### 1. Frontend (Next.js)
- **Provider**: Vercel
- **Deployment Model**: Serverless functions for API routes (webhooks), Edge/Server Components for rendering.
- **Scaling**: Automatic, global edge distribution.
- **Configuration**: `vercel.json` enforces security headers, custom domains, and environment variable injection.

### 2. Backend API (NestJS)
- **Provider**: AWS ECS Fargate (or Render.com for MVP simplicity)
- **Deployment Model**: Docker container.
- **Scaling**: 
  - MVP: 1-2 tasks, 0.5 vCPU, 1GB RAM.
  - Scale-out: Target Tracking Scaling Policy based on CPU utilization (>70%) or ALB request count.
- **Health Checks**: `/health` endpoint returning 200 OK.

### 3. AI Worker (Python + FastAPI)
- **Provider**: AWS ECS Fargate (separate Task Definition)
- **Deployment Model**: Docker container.
- **Scaling**: 
  - MVP: 1 task, 1 vCPU, 2GB RAM.
  - Scale-out: Based on Redis BullMQ queue depth (e.g., scale up if queue > 50 jobs).
- **Isolation**: Completely decoupled from the Backend API to prevent AI processing spikes from degrading API latency.

---

## 🗄️ Data Storage Strategy

### 1. Primary Database (PostgreSQL)
- **Service**: AWS RDS
- **Engine**: PostgreSQL 15+ (with `pgvector` extension enabled)
- **MVP Configuration**: `db.t4g.small` (2 vCPU, 2GB RAM), Single-AZ.
- **Production Configuration**: `db.m6g.large`, Multi-AZ deployment for high availability.
- **Backups**: Automated daily snapshots, 7-day retention, Point-in-Time Recovery (PITR) enabled.

### 2. Cache & Message Broker (Redis)
- **Service**: AWS ElastiCache (or Upstash Redis for serverless MVP)
- **Engine**: Redis 7.x
- **MVP Configuration**: Single-node (cache.t4g.micro).
- **Usage**: 
  - BullMQ job queues (reliable, persisted).
  - Session state and rate limiting counters.
  - Short-lived caching of frequent queries (e.g., document metadata).

### 3. Object Storage (Documents & Assets)
- **Service**: **Cloudflare R2** (Strongly recommended over AWS S3 for MVP)
- **Rationale**: S3-compatible API, but **zero egress fees**. Since our core product involves serving document pages (images/tiles) to viewers, egress costs on AWS S3 would scale linearly with usage and destroy margins. R2 eliminates this.
- **Bucket Configuration**:
  - Private by default (no public read access).
  - CORS configured to allow `GET`/`PUT` only from `https://app.knowledgevault.com`.
  - Lifecycle rules: Transition deleted documents to cold storage after 30 days, permanent delete after 60 days.
- **Fallback**: AWS S3 with CloudFront CDN (if R2 is not viable for specific compliance reasons).

---

## 🌍 Environment Strategy

Strict isolation between environments to prevent data leakage and ensure stable testing.

| Environment | Purpose | Infrastructure | Data | Access |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | Local developer machines | Docker Compose (local DB, Redis, MinIO) | Mock/Seed data | Developers only |
| **Staging** | Pre-production validation | Mirrors Production (smaller instance sizes) | Anonymized Production snapshot | Internal team, Beta testers |
| **Production** | Live customer traffic | Full HA configuration (Multi-AZ, Auto-scaling) | Real customer data | Restricted (CTO, DevOps) |

**Rules:**
- No direct database access from local machines to Production.
- Staging must be used for all integration and E2E testing before Production deployment.
- Environment variables must be explicitly defined for each environment; no sharing of secrets.

---

## 🔐 Secrets Management

### Principles
- **Zero Secrets in Code**: No `.env` files committed to Git. `.env.example` only.
- **Least Privilege**: Services only receive the secrets they need (e.g., AI Worker does not get Stripe keys).
- **Rotation**: API keys and database passwords rotated every 90 days.

### Implementation
- **MVP**: Environment variables injected via Vercel Dashboard (Frontend) and Render/ECS Task Definitions (Backend), managed securely.
- **Phase 2+**: AWS Secrets Manager or Doppler. Applications fetch secrets at startup via IAM roles (no static credentials).

---

## 🛡️ Disaster Recovery & Business Continuity

### Recovery Time Objective (RTO)
- **MVP**: 4 hours
- **Production**: 1 hour

### Recovery Point Objective (RPO)
- **MVP**: 24 hours (daily backups)
- **Production**: 15 minutes (PITR + synchronous Multi-AZ replication)

### Backup Strategy
1. **Database**: Automated daily snapshots + continuous WAL archiving (PITR).
2. **Object Storage**: Cloudflare R2 versioning enabled. Deleted objects retained for 30 days.
3. **Infrastructure as Code (IaC)**: All infrastructure defined in Terraform/Pulumi. Recovery is a matter of re-applying the state, not manual console clicking.

---

## 📊 Monitoring & Observability

### 1. Application Monitoring
- **Sentry**: Captures unhandled exceptions, performance traces, and release health for both Next.js and NestJS/FastAPI.
- **Custom Metrics**: Pushed to CloudWatch/Datadog (e.g., `ai_query_latency_ms`, `document_upload_success_rate`).

### 2. Infrastructure Monitoring
- **AWS CloudWatch**: CPU, Memory, Disk I/O, ALB 5xx errors, RDS connections.
- **Alerts**: 
  - CPU > 80% for 5 minutes.
  - Database connections > 80% of max limit.
  - BullMQ failed jobs > 10 in 5 minutes.
  - Stripe webhook failures > 0.

### 3. Logging
- **Format**: Structured JSON logs.
- **Aggregation**: CloudWatch Logs or Datadog Log Management.
- **Retention**: 30 days for standard logs, 1 year for security/audit logs.
- **PII Masking**: Automated redaction of emails, IPs, and tokens in log streams.

---

## 📌 Key Takeaways for Implementation (Freebuff)

1. **Design for Cloudflare R2**: Use AWS SDK `@aws-sdk/client-s3` but configure the endpoint to point to Cloudflare R2. This is a critical cost-saving measure.
2. **Containerize Everything**: Backend and AI Worker must have production-ready `Dockerfile`s (multi-stage builds, non-root user, minimal base image like `node:20-alpine` or `python:3.11-slim`).
3. **Health Checks are Mandatory**: Every service must expose a `/health` endpoint that checks its critical dependencies (e.g., Backend `/health` checks DB and Redis connectivity).
4. **No Hardcoded URLs**: All external service URLs (DB, Redis, Storage) must be injected via environment variables.
5. **CORS Strictness**: Storage buckets must explicitly whitelist the frontend domain. Wildcard `*` is forbidden.
6. **IaC Mindset**: Even if deploying manually for MVP, structure configurations so they can be easily translated to Terraform/Pulumi later.

---

## 🔗 Related Documents

- [System Architecture](../03_Architecture_and_Design/System_Architecture.md) - High-level container and network design.
- [Security Requirements](../04_Security_and_Access/Security_Requirements.md) - Network isolation, WAF, and encryption standards.
- [Integrations](./Integrations.md) - Specific API and service connection details.
- [Deployment](./Deployment.md) - CI/CD pipelines, release strategies, and environment promotion.
```