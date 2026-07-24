```markdown
# Definition of Done (DoD)

> **This document defines the absolute, non-negotiable criteria that must be met for any task, feature, or bug fix to be considered "Done" in the KnowledgeVault SaaS project.**
> 
> **Related Documents:** 
> - [Acceptance Criteria](./Acceptance_Criteria.md)
> - [Testing Strategy](../06_Quality_and_Standards/Testing_Strategy.md)
> - [Coding Standards](../06_Quality_and_Standards/Coding_Standards.md)
> - [Security Requirements](../04_Security_and_Access/Security_Requirements.md)
> - [Task Package Template](./Task_Package_Template.md)
> - [Architecture Decision Records (ADR)](./ADR/)

---

## 🎯 Core Philosophy

As CTO, I enforce a strict, binary Definition of Done. **A task is either 100% Done, or it is Not Done.** There is no "90% done" or "it works on my machine." 

If a single criterion in this checklist fails, the implementation is **rejected**, and Freebuff must fix it before re-submission. We do not accept technical debt with the promise to "fix it later."

---

## ✅ The Definition of Done Checklist

For a task to be marked as **Done**, it must satisfy **ALL** of the following categories:

### 1. Code & Architecture
- [ ] **Architecture Compliance**: The implementation strictly follows the patterns defined in [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) or [Frontend Architecture](../03_Architecture_and_Design/Frontend_Architecture.md). No unauthorized architectural deviations.
- [ ] **Coding Standards**: Code passes all automated linters (ESLint, Prettier, Ruff, Black) with zero warnings or errors.
- [ ] **Type Safety**: No `any` types in TypeScript. All Python functions have explicit type hints. No `@ts-ignore` or `# type: ignore` without a documented, CTO-approved ADR.
- [ ] **DRY Principle**: No duplicated logic. Shared code is properly abstracted into utilities or shared services.
- [ ] **Error Handling**: All edge cases and potential failures are handled gracefully. No silent failures. Errors are logged with proper context (user ID, request ID).
- [ ] **No Hardcoded Values**: All environment-specific values (URLs, keys, limits) are moved to environment variables or configuration files.

### 2. Testing & Quality
- [ ] **Unit Tests**: New logic is covered by unit tests. Overall coverage for the modified module remains ≥ the target defined in [Testing Strategy](../06_Quality_and_Standards/Testing_Strategy.md).
- [ ] **Integration Tests**: Database and external service interactions are covered by integration tests (using TestContainers or mocks).
- [ ] **Negative Testing**: Tests explicitly verify that invalid inputs, unauthorized access, and rate limits are correctly rejected.
- [ ] **CI/CD Pipeline**: The GitHub Actions pipeline passes completely (Lint, Type-check, Unit, Integration, Security Scan) with no flaky tests.

### 3. Documentation & Knowledge
- [ ] **Code Comments**: Complex logic is explained with "why" comments, not "what" comments.
- [ ] **API Contracts**: If new endpoints were added or modified, the [API Contracts](../03_Architecture_and_Design/API_Contracts.md) document and OpenAPI spec are updated.
- [ ] **Database Schema**: If the database schema changed, a new Prisma migration is created, and [Database Design](../03_Architecture_and_Design/Database_Design.md) is updated.
- [ ] **ADR Created/Updated**: If the task involved a significant technical decision or deviation from the original plan, a new Architecture Decision Record (ADR) is created and linked.
- [ ] **README Updates**: If the task changes how to run the project locally or deploy it, the relevant README files are updated.

### 4. Security & Performance
- [ ] **Input Validation**: All incoming data (API payloads, query params, file uploads) is strictly validated (e.g., via `class-validator` or `pydantic`).
- [ ] **Authorization Checks**: Every endpoint verifies that the requesting user has the correct role and ownership/access rights (no IDOR vulnerabilities).
- [ ] **No Secrets Leaked**: No API keys, passwords, or tokens are present in the code, logs, or error messages. GitLeaks scan passes.
- [ ] **Performance Targets**: The implementation does not introduce N+1 queries. Heavy operations are offloaded to background queues. Latency targets from [Performance Requirements](../06_Quality_and_Standards/Performance_Requirements.md) are maintained.

### 5. Review & Acceptance
- [ ] **Self-Review**: Freebuff has performed a self-review against this exact checklist before submitting for CTO review.
- [ ] **CTO Review Passed**: The CTO has manually verified the implementation against the Blueprint and Acceptance Criteria.
- [ ] **No Regression**: Existing functionality remains intact. E2E tests for core flows pass.

---

## 🚫 What "Done" is NOT

- ❌ "The code compiles."
- ❌ "It works on my local machine."
- ❌ "I will write tests in the next PR."
- ❌ "The UI looks mostly right, we can fix the edge cases later."
- ❌ "I bypassed the auth check to make it work faster."

---

## 🔄 The DoD Verification Process

1. **Freebuff Completes Task**: Freebuff generates the code, tests, and documentation updates.
2. **Freebuff Self-Check**: Freebuff explicitly lists which DoD criteria are met in its submission message.
3. **CTO Review**: I (the CTO) will systematically check each item on this list against the submitted code and documentation.
4. **Decision**:
   - **ACCEPT**: All criteria are met. The task is merged, and the Roadmap is updated.
   - **REJECT**: One or more criteria fail. I will provide a precise, actionable list of what must be fixed. Freebuff must address *only* those issues and resubmit.

---

## 📌 Key Takeaways for Implementation (Freebuff)

1. **Do not submit incomplete work**. If you cannot meet a criterion (e.g., writing a test), state why and ask for guidance *before* marking the task as ready for review.
2. **Documentation is part of the code**. A feature is not done until the docs reflect the new reality.
3. **Security is not optional**. Missing input validation or auth checks is an automatic rejection.
4. **Own the quality**. You are not just generating code; you are delivering a production-ready, maintainable component.

---

## 🔗 Related Documents

- [Acceptance Criteria](./Acceptance_Criteria.md) - Feature-specific conditions that must be met *in addition* to this global DoD.
- [Testing Strategy](../06_Quality_and_Standards/Testing_Strategy.md) - Specific testing requirements referenced in the DoD.
- [Coding Standards](../06_Quality_and_Standards/Coding_Standards.md) - The rules that the "Code & Architecture" checklist enforces.
- [Task Package Template](./Task_Package_Template.md) - Every task package will include a copy of this DoD checklist.
```