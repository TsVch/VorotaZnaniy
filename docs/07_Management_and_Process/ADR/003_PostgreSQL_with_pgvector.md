# ADR-003: Use PostgreSQL with pgvector for Relational and Vector Data

> **Status:** Accepted
> **Date:** 2026-07-21
> **Deciders:** CTO

---

## 📝 Context
The application requires a robust relational database for users, workspaces, documents, and billing. Additionally, the AI RAG features require a vector database to store and query document embeddings (for semantic search). 
Managing two separate database systems (e.g., PostgreSQL + Pinecone/Milvus) increases infrastructure costs, operational complexity, and complicates transactional integrity between relational data and vector data.

## 🎯 Decision
We will use **PostgreSQL** as our single primary database and enable the **`pgvector`** extension to handle vector storage and similarity searches. 

## 📊 Alternatives Considered
- **Dedicated Vector DB (Pinecone, Milvus, Qdrant):** 
  - *Rejected for MVP:* Adds unnecessary infrastructure overhead, extra cost, and requires syncing data between two systems. (Note: Can be reconsidered in Phase 3 if pgvector hits performance limits at massive scale).
- **MongoDB (with Atlas Vector Search):** 
  - *Rejected:* We need strict ACID compliance and complex relational joins for billing, access grants, and workspace isolation, which PostgreSQL handles much better.

## ⚖️ Consequences
- **Positive:** 
  - Drastically simplifies infrastructure (one database to backup, secure, and scale).
  - Reduces costs (no separate vector DB subscription).
  - Allows transactional consistency (e.g., deleting a document automatically cascades to its embeddings via foreign keys).
  - Prisma ORM supports `pgvector` via unsupported types/raw SQL for migrations.
- **Negative / Risks:** 
  - `pgvector` may not scale as efficiently as dedicated vector DBs for billions of vectors (acceptable risk for MVP and early Growth phases).
  - Requires careful index management (HNSW or IVFFlat) to ensure query latency remains < 50ms.

## 🔗 Related Documents
- [Database Design](../../03_Architecture_and_Design/Database_Design.md)
- [Infrastructure](../../05_Infrastructure_and_Operations/Infrastructure.md)
- [Scalability Strategy](../../06_Quality_and_Standards/Scalability_Strategy.md)