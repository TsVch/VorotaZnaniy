# ADR-002: Isolate AI and Document Processing into a Separate Service

> **Status:** Accepted
> **Date:** 2026-07-21
> **Deciders:** CTO

---

## 📝 Context
The platform requires heavy background processing: parsing large PDF/EPUB files, chunking text, generating vector embeddings via LLM APIs, and running RAG (Retrieval-Augmented Generation) queries. 
These tasks are CPU-intensive, memory-heavy, and rely heavily on the Python ecosystem (LangChain, PyPDF2, etc.), which differs from our core API stack (Node.js/TypeScript). Mixing them into the main API process risks blocking the event loop and degrading the user experience for standard CRUD operations.

## 🎯 Decision
We will build the AI and Document Processing logic as an **isolated microservice** (AI Worker) using **Python and FastAPI**. 
This service will communicate with the core NestJS backend exclusively via an asynchronous message queue (Redis + BullMQ) and internal HTTP endpoints for status checks.

## 📊 Alternatives Considered
- **Python for the entire backend (Django/FastAPI):** 
  - *Rejected:* NestJS provides superior out-of-the-box structure, typing, and enterprise patterns for the core CRUD/API logic.
- **Node.js for AI processing (LangChain.js):** 
  - *Rejected:* The Python AI/ML ecosystem is vastly superior, more mature, and better supported for vector operations and document parsing.
- **Include AI logic inside the Modular Monolith:** 
  - *Rejected:* Risks blocking the Node.js event loop during heavy PDF parsing and complicates dependency management (mixing npm and pip).

## ⚖️ Consequences
- **Positive:** 
  - Core API remains highly responsive and lightweight.
  - AI Worker can be scaled independently based on queue depth.
  - Allows using the best language for the specific job (TypeScript for API, Python for AI).
- **Negative / Risks:** 
  - Requires managing two separate Docker containers and deployments.
  - Requires setting up and maintaining a message broker (Redis).
  - Network latency for synchronous internal calls (mitigated by using async queues for 99% of interactions).

## 🔗 Related Documents
- [System Architecture](../../03_Architecture_and_Design/System_Architecture.md)
- [Backend Architecture](../../03_Architecture_and_Design/Backend_Architecture.md)
- [Integrations](../../05_Infrastructure_and_Operations/Integrations.md)