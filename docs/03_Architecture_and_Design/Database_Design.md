```markdown
# File: 03_Architecture_and_Design/Database_Design.md

# Database Design
 > **This document defines the database schema, data models, relationships, and storage strategy for the KnowledgeVault SaaS platform.**
 > 
 > **Related Documents:** 
 > - [System Architecture](./System_Architecture.md)
 > - [Backend Architecture](./Backend_Architecture.md)
 > - [API Contracts](./API_Contracts.md)
 > - [Security Requirements](../04_Security_and_Access/Security_Requirements.md)
 > - [Scalability Strategy](../06_Quality_and_Standards/Scalability_Strategy.md)
 > - [Billing Design](./Billing_Design.md)
 > - [ADR-005: Payment Provider Strategy](../07_Management_and_Process/ADR/005_Payment_Provider_Selection.md)
 ---
 ## 🎯 Technology Decision Summary
 | Component | Decision | Rationale | ADR Reference |
 | :--- | :--- | :--- | :--- |
 | Primary DB | PostgreSQL 15+ | ACID compliance, JSONB support, mature ecosystem, row-level security | ADR-003 |
 | Vector DB | `pgvector` extension | Single database for relational + vector data (KISS/YAGNI principle) | ADR-003 |
 | Object Storage | AWS S3 / Cloudflare R2 | Durable, scalable, cost-effective, native presigned URL support | ADR-005 |
 | ORM / Query Builder | Prisma 5 | Type-safe, excellent DX, automated migrations, connection pooling | ADR-003 |
 | Caching / Queue | Redis 7 | Sub-millisecond latency, BullMQ integration, ephemeral session storage | ADR-007 |
 | Payment Tracking | Provider-Agnostic Schema | Supports YooKassa (MVP), T-Bank, Stripe via Strategy Pattern | ADR-005 |
 ---
 ## 📊 Entity Relationship Diagram (ERD)
 ```text
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                              USERS & WORKSPACES                              │
 ├─────────────────────────────────────────────────────────────────────────────┤
 │  ┌──────────────────┐         ┌──────────────────┐                          │
 │  │      users       │         │    workspaces    │                          │
 │  ├──────────────────┤         ├──────────────────┤                          │
 │  │ id (PK)          │         │ id (PK)          │                          │
 │  │ email (Unique)   │◄────────│ owner_id (FK)    │                          │
 │  │ password_hash    │         │ name             │                          │
 │  │ name             │         │ slug (Unique)    │                          │
 │  │ avatar_url       │         │ plan             │                          │
 │  │ role             │         │ active_payment   │                          │
 │  │ email_verified   │         │ provider_customer│                          │
 │  │ created_at       │         │ created_at       │                          │
 │  │ updated_at       │         │ updated_at       │                          │
 │  └──────────────────┘         └──────────────────┘                          │
 └─────────────────────────────────────────────────────────────────────────────┘
                                       │ 1:N
                                       ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                              DOCUMENTS & CONTENT                             │
 ├─────────────────────────────────────────────────────────────────────────────┤
 │  ┌──────────────────┐         ┌──────────────────┐         ──────────────┐ │
 │  │    documents     │         │ document_versions│         │  embeddings  │ │
 │  ├──────────────────┤         ├──────────────────┤         ├──────────────┤ │
 │  │ id (PK)          │         │ id (PK)          │         │ id (PK)      │ │
 │  │ workspace_id(FK) │         │ document_id (FK) │         │ document_id  │ │
 │  │ title            │         │ version_number   │         │ chunk_index  │ │
 │  │ description      │         │ file_url         │         │ chunk_text   │ │
 │  │ file_type        │         │ page_count       │         │ embedding    │ │
 │  │ file_size        │         │ processed_at     │         │ created_at   │ │
 │  │ status           │         │ status           │         └──────────────┘ │
 │  │ protection_config│         └──────────────────┘                          │
 │  │ created_at       │                                                        │
 │  │ updated_at       │                                                        │
 │  ──────────────────┘                                                        │
 └─────────────────────────────────────────────────────────────────────────────┘
                                       │ 1:N
                                       ▼
 ┌─────────────────────────────────────────────────────────────────────────────
 │                            ACCESS & SECURITY                                 │
 ├─────────────────────────────────────────────────────────────────────────────┤
 │  ┌──────────────────┐         ──────────────────┐         ┌──────────────┐ │
 │  │  access_grants   │         │     sessions     │         │   watermarks │ │
 │  ├──────────────────         ├──────────────────┤         ├──────────────┤ │
 │  │ id (PK)          │         │ id (PK)          │         │ id (PK)      │ │
 │  │ user_id (FK)     │         │ user_id (FK)     │         │ session_id   │ │
 │  │ document_id (FK) │         │ document_id (FK) │         │ user_email   │ │
 │  │ granted_at       │         │ device_fingerprint│        │ user_id      │ │
 │  │ expires_at       │         │ ip_address       │         │ ip_address   │ │
 │  │ is_active        │         │ user_agent       │         │ timestamp    │ │
 │  │ source           │         │ is_active        │         │ created_at   │ │
 │  └──────────────────┘         │ last_activity    │         ──────────────┘ │
 │                               │ created_at       │                          │
 │                               └──────────────────┘                          │
 └─────────────────────────────────────────────────────────────────────────────┘
                                       │ 1:N
                                       ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                           ANALYTICS & BILLING                                │
 ├─────────────────────────────────────────────────────────────────────────────┤
 │  ┌──────────────────┐         ──────────────────┐         ┌──────────────┐ │
 │  │   view_events    │         │  subscriptions   │         │ ai_usage_log │ │
 │  ├──────────────────         ├──────────────────┤         ├──────────────┤ │
 │  │ id (PK)          │         │ id (PK)          │         │ id (PK)      │ │
 │  │ user_id (FK)     │         │ workspace_id(FK) │         │ user_id (FK) │ │
 │  │ document_id (FK) │         │ provider         │         │ document_id  │ │
 │  │ session_id (FK)  │         │ provider_sub_id  │         │ query_type   │ │
 │  │ page_number      │         │ status           │         │ tokens_used  │ │
 │  │ time_spent_sec   │         │ current_period   │         │ cost         │ │
 │  │ completed        │         │ created_at       │         │ created_at   │ │
 │  │ created_at       │         └──────────────────┘         ──────────────┘ │
 │  └──────────────────┘                                                        │
 └─────────────────────────────────────────────────────────────────────────────
 ```
 ## 📋 Table Definitions (Prisma Schema Representation)
 ### 1. users
 Stores all user accounts (Creators, Buyers, Admins).
 ```prisma
 model User {
   id             String    @id @default(uuid())
   email          String    @unique
   passwordHash   String?   // Null for OAuth-only users
   name           String?
   avatarUrl      String?
   role           Role      @default(VIEWER) // ADMIN, CREATOR, VIEWER
   emailVerified  Boolean   @default(false)
   createdAt      DateTime  @default(now())
   updatedAt      DateTime  @updatedAt
   
   workspaces     Workspace[]
   accessGrants   AccessGrant[]
   sessions       Session[]
   viewEvents     ViewEvent[]
   aiUsageLogs    AiUsageLog[]
   watermarks     Watermark[]
 }
 
 enum Role {
   ADMIN
   CREATOR
   VIEWER
 }
 ```
 ### 2. workspaces
 Organizational units for Creators.
 ```prisma
 model Workspace {
   id                    String       @id @default(uuid())
   ownerId               String
   owner                 User         @relation(fields: [ownerId], references: [id], onDelete: Cascade)
   name                  String
   slug                  String       @unique
   plan                  Plan         @default(STARTER) // STARTER, PRO, BUSINESS, ENTERPRISE
   
   // Billing fields (Provider-Agnostic, ADR-005)
   activePaymentProvider String?      @default("yookassa") // "yookassa", "tbank", "stripe"
   providerCustomerId    String?      @unique // Client ID in the active provider
   
   createdAt             DateTime     @default(now())
   updatedAt             DateTime     @updatedAt
   
   documents             Document[]
   subscriptions         Subscription[]
   
   @@index([ownerId])
   @@index([slug])
 }
 
 enum Plan {
   STARTER
   PRO
   BUSINESS
   ENTERPRISE
 }
 ```
 ### 3. documents
 Core entity representing uploaded content.
 ```prisma
 model Document {
   id                 String   @id @default(uuid())
   workspaceId        String
   workspace          Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
   title              String
   description        String?
   fileType           String   // pdf, epub, zip
   fileSize           Int      // in bytes
   status             DocStatus @default(PROCESSING) // PROCESSING, READY, ERROR
   protectionConfig   Json     // { watermarkEnabled: true, maxConcurrentSessions: 2, ... }
   createdAt          DateTime @default(now())
   updatedAt          DateTime @updatedAt
   
   versions           DocumentVersion[]
   accessGrants       AccessGrant[]
   sessions           Session[]
   viewEvents         ViewEvent[]
   aiUsageLogs        AiUsageLog[]
   embeddings         Embedding[]
   
   @@index([workspaceId])
   @@index([status])
 }
 
 enum DocStatus {
   PROCESSING
   READY
   ERROR
 }
 ```
 ### 4. document_versions
 Tracks different versions of a document.
 ```prisma
 model DocumentVersion {
  id            String      @id @default(uuid())
  documentId    String
  document      Document    @relation(fields: [documentId], references: [id], onDelete: Cascade)
  versionNumber Int
  fileUrl       String      // S3 key or presigned base
  pageCount     Int?
  processedAt   DateTime?
  status        DocStatus   @default(PENDING)
  createdAt     DateTime    @default(now())
  
  @@unique([documentId, versionNumber])
  @@index([documentId])
 }
 ```
 ### 5. embeddings
 Vector embeddings for AI RAG functionality (requires `pgvector` extension).
 ```prisma
 model Embedding {
  id          String   @id @default(uuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  chunkIndex  Int
  chunkText   String   @db.Text
  embedding   Unsupported("vector(1536)") // OpenAI embedding dimension
  createdAt   DateTime @default(now())
  
  @@index([documentId])
  // Note: Vector index (IVFFlat or HNSW) must be created via raw SQL migration
 }
 ```
 ### 6. access_grants
 Tracks which users have access to which documents.
 ```prisma
 model AccessGrant {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  documentId  String
  document    Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  grantedAt   DateTime  @default(now())
  expiresAt   DateTime? // Null for lifetime access
  isActive    Boolean   @default(true)
  source      String    // purchase, gift, manual
  
  @@unique([userId, documentId])
  @@index([userId])
  @@index([documentId])
 }
 ```
 ### 7. sessions
 Tracks active viewing sessions for DRM enforcement.
 ```prisma
 model Session {
   id                String    @id @default(uuid())
   userId            String
   user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
   documentId        String
   document          Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
   deviceFingerprint String?
   ipAddress         String?   @db.Inet
   userAgent         String?
   isActive          Boolean   @default(true)
   lastActivity      DateTime  @default(now())
   createdAt         DateTime  @default(now())
   
   viewEvents        ViewEvent[]
   watermarks        Watermark[]
   
   @@index([userId])
   @@index([documentId])
   @@index([isActive])
 }
 ```
 ### 8. watermarks
 Audit log of all watermarks generated (critical for tracking leaks).
 ```prisma
 model Watermark {
  id          String    @id @default(uuid())
  sessionId   String
  session     Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userEmail   String
  userId      String?
  user        User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  ipAddress   String?   @db.Inet
  timestamp   DateTime  @default(now())
  createdAt   DateTime  @default(now())
  
  @@index([sessionId])
  @@index([userEmail])
 }
 ```
 ### 9. view_events
 Analytics data for document viewing (high write volume).
 ```prisma
 model ViewEvent {
   id                String    @id @default(uuid())
   userId            String?
   user              User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
   documentId        String
   document          Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
   sessionId         String?
   session           Session?  @relation(fields: [sessionId], references: [id], onDelete: SetNull)
   pageNumber        Int?
   timeSpentSeconds  Int?
   completed         Boolean   @default(false)
   createdAt         DateTime  @default(now())
   
   @@index([documentId])
   @@index([createdAt])
   // Note: Consider table partitioning by `createdAt` for large-scale deployments
 }
 ```
 ### 10. subscriptions
 Provider-agnostic subscription tracking for workspace billing (ADR-005).
 ```prisma
 model Subscription {
  id                     String    @id @default(uuid())
  workspaceId            String
  workspace              Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  plan                   String
  
  // Provider-Agnostic Fields
  provider               String    @default("yookassa") // "yookassa", "tbank", "stripe"
  providerSubscriptionId String    @unique
  status                 String    // active, past_due, canceled, trialing
  
  currentPeriodStart     DateTime
  currentPeriodEnd       DateTime
  createdAt              DateTime  @default(now())
  
  @@index([workspaceId])
 }
 ```
 ### 11. ai_usage_log
 Tracks AI API usage for billing, rate limiting, and cost analysis.
 ```prisma
 model AiUsageLog {
  id          String    @id @default(uuid())
  userId      String?
  user        User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  documentId  String
  document    Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  queryType   String    // summary, qa, quiz, flashcard
  tokensUsed  Int
  cost        Decimal   @db.Decimal(10, 6) // in USD (OpenAI billing currency)
  createdAt   DateTime  @default(now())
  
  @@index([userId])
  @@index([documentId])
  @@index([createdAt])
 }
 ```
 ## 🔐 Security Considerations
 ### Data Encryption
 - **At Rest:** Database cluster must be encrypted (e.g., AWS RDS encrypted volumes).
 - **In Transit:** All database connections must enforce TLS 1.3.
 - **Sensitive Fields:** `passwordHash` must use bcrypt with a cost factor of at least 12.
 ### Access Control
 - Row-Level Security (RLS) can be enabled in PostgreSQL for multi-tenant isolation (Phase 3).
 - Application-level checks must always verify `workspaceId` ownership before any mutation.
 - Soft deletes are preferred over hard deletes for audit trails (except for GDPR "Right to be Forgotten" requests, which require explicit anonymization).
 ### Performance Optimization
 - **Connection Pooling:** Prisma connection pool configured appropriately (e.g., `?connection_limit=10`).
 - **Indexing:** All foreign keys and frequently queried columns (email, status, dates) are indexed.
 - **Partitioning:** `ViewEvent` and `AiUsageLog` tables should be partitioned by month (`PARTITION BY RANGE (createdAt)`) once data volume exceeds 10M rows.
 ## 📊 Migration Strategy
 - **Version Control:** All schema changes are managed via Prisma Migrate (`prisma/migrations/`).
 - **Idempotency:** Migrations must be reversible or safely re-runnable.
 - **Zero-Downtime:** For production, use blue-green deployment or expand-contract patterns for schema changes (e.g., add column, backfill, switch reads, drop old column).
 - **Vector Index Creation:** The `pgvector` index (IVFFlat or HNSW) must be created via a raw SQL migration after initial data seeding to avoid locking the table during creation.
 ## 📈 Scalability Path
 | Phase | Database Strategy |
 | :--- | :--- |
 | **MVP** | Single PostgreSQL instance + `pgvector` + Prisma connection pooling. |
 | **Growth** | Read replicas for analytics queries. Partition `view_events` by date. |
 | **Enterprise** | Dedicated vector database (e.g., Qdrant) if `pgvector` becomes a bottleneck. Sharding by `workspaceId` for strict multi-tenant isolation. |
 ## 📌 Key Takeaways for Implementation
 - **Single Source of Truth:** The Prisma schema is the absolute source of truth for the database structure.
 - **No Direct SQL in App Code:** Use Prisma Client for all queries to ensure type safety and prevent SQL injection.
 - **Auditability:** The `watermarks` and `view_events` tables are critical for DRM and must never be silently truncated.
 - **Cost Control:** `ai_usage_log` must be actively monitored to prevent runaway LLM costs.
 - **Provider Agnostic Billing:** The `Subscription` and `Workspace` models use generic provider fields (`provider`, `providerCustomerId`) to support YooKassa (MVP), T-Bank, and Stripe (Phase 2) without schema changes.
```