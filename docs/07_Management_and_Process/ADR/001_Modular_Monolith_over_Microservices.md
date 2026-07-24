# ADR-001: Adopt Modular Monolith over Microservices for MVP

> **Status:** Accepted
> **Date:** 2026-07-21
> **Deciders:** CTO

---

## 📝 Context
We are building a SaaS platform for secure digital content distribution with AI features. The system involves user management, document processing, DRM enforcement, billing, and AI integration. 
As a startup launching an MVP, we need an architecture that allows rapid development, easy deployment, and simple debugging, while still being structured enough to scale or extract services later if the business demands it.

## 🎯 Decision
We will implement the core backend as a **Modular Monolith** using NestJS (Node.js/TypeScript). 
The codebase will be strictly divided into independent domain modules (e.g., `auth`, `documents`, `billing`, `access`). Modules will communicate via well-defined internal interfaces or asynchronous events (Redis/BullMQ), and will **never** directly access each other's database tables.

## 📊 Alternatives Considered
- **Microservices from Day 1:** 
  - *Rejected:* Introduces massive operational complexity (networking, distributed tracing, multiple deployments, complex CI/CD) which violates KISS and YAGNI for an MVP team.
- **Standard (Spaghetti) Monolith:** 
  - *Rejected:* Leads to high technical debt, tight coupling, and makes future extraction of services (like the AI worker) extremely difficult.

## ⚖️ Consequences
- **Positive:** 
  - Single deployment artifact simplifies CI/CD and infrastructure.
  - Faster local development and debugging (no network hops between services).
  - Strict module boundaries enforce Clean Architecture and prepare the codebase for future microservice extraction if needed.
- **Negative / Risks:** 
  - All modules share the same database instance, requiring strict discipline to avoid cross-module table joins.
  - A memory leak or CPU spike in one module (e.g., document parsing) could theoretically affect the whole monolith (mitigated by offloading heavy tasks to the isolated AI Worker - see ADR-002).

## 🔗 Related Documents
- [System Architecture](../../03_Architecture_and_Design/System_Architecture.md)
- [Backend Architecture](../../03_Architecture_and_Design/Backend_Architecture.md)