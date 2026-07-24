```markdown
# Testing Strategy

> **This document defines the comprehensive testing strategy, tools, coverage requirements, and specific testing methodologies for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [System Architecture](../03_Architecture_and_Design/System_Architecture.md)
> - [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md)
> - [Frontend Architecture](../03_Architecture_and_Design/Frontend_Architecture.md)
> - [Security Requirements](../04_Security_and_Access/Security_Requirements.md)
> - [Definition of Done](../07_Management_and_Process/Definition_of_Done.md)
> - [Acceptance Criteria](../07_Management_and_Process/Acceptance_Criteria.md)

---

## 🎯 Testing Philosophy

As a CTO, I enforce **Testability by Design**. Testing is not an afterthought; it is a fundamental requirement for every Task Package. 

### Core Principles
1. **Documentation is Truth**: Tests must verify that the implementation matches the Blueprint. If code passes tests but violates architecture, the tests are flawed.
2. **Pyramid Over Trophy**: Heavy investment in fast, isolated Unit and Integration tests. E2E tests are reserved for critical user journeys.
3. **Security is Testable**: DRM, rate limiting, and authorization must have explicit, automated negative tests (testing that things *fail* correctly).
4. **No Flaky Tests**: Flaky tests block the CI/CD pipeline and erode trust. They must be fixed or quarantined immediately.
5. **Freebuff Accountability**: Every Task Package generated for Freebuff will include explicit `Testing Requirements`. Freebuff must provide passing tests to meet the Definition of Done.

---

## 🏗️ Testing Pyramid

```text
          /\
         /  \  <-- E2E Tests (Playwright)
        /----\     Critical user journeys, cross-system integration.
       /      \    Slow, expensive, run on staging/production-like env.
      /--------\
     /          \ <-- Integration Tests (Jest, Pytest, TestContainers)
    /------------\    Service-to-DB, Service-to-Redis, API contracts.
   /              \   Moderate speed, high value.
  /----------------\
 /                  \ <-- Unit Tests (Jest, Pytest)
/--------------------\    Individual functions, services, utilities.
                        Fast, isolated, mocked dependencies.
```

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend Unit/Integration** | Jest + Supertest | NestJS service and controller testing |
| **Backend AI Worker** | Pytest + HTTPX | FastAPI endpoint and RAG pipeline testing |
| **Frontend Unit/Component** | Jest + React Testing Library | Component rendering, hook logic, state |
| **Frontend E2E** | Playwright | Cross-browser user journey validation |
| **Database Testing** | TestContainers (PostgreSQL) | Real DB integration tests without mocking |
| **API Contract Testing** | Pact or OpenAPI validators | Ensure frontend/backend contracts don't drift |
| **Security Testing** | OWASP ZAP, Snyk, GitLeaks | Automated vulnerability and secret scanning |

---

## 📋 Testing Levels & Requirements

### 1. Unit Tests
**Scope**: Individual functions, services, utilities, and pure logic.
**Rules**:
- Must run in < 100ms per test.
- No external dependencies (DB, Redis, Network). Use mocks/spies.
- Test both happy paths and edge cases (null inputs, invalid types).

**Example (Backend)**:
```typescript
// session-validator.service.spec.ts
describe('SessionValidatorService', () => {
  it('should throw ForbiddenException if max sessions exceeded', async () => {
    const mockCount = jest.spyOn(prisma.session, 'count').mockResolvedValue(3);
    
    await expect(
      service.validateSessionLimit('user-1', 'doc-1', 2)
    ).rejects.toThrow(ForbiddenException);
    
    expect(mockCount).toHaveBeenCalledWith({
      where: { userId: 'user-1', documentId: 'doc-1', isActive: true }
    });
  });
});
```

### 2. Integration Tests
**Scope**: Interaction between modules and external dependencies (DB, Redis, S3).
**Rules**:
- Use TestContainers to spin up real PostgreSQL and Redis instances.
- Do not mock the database; test actual Prisma queries.
- Clean up state after each test (e.g., `prisma.$transaction([prisma.user.deleteMany()])`).

**Example (Backend)**:
```typescript
// documents.integration.spec.ts
describe('Document Upload Integration', () => {
  it('should create document record and return presigned URL', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/documents/upload-init')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ title: 'Test', file_name: 'test.pdf', file_size: 1024 });

    expect(response.status).toBe(200);
    expect(response.body.upload_url).toContain('https://');
    
    const dbRecord = await prisma.document.findFirst({ where: { title: 'Test' } });
    expect(dbRecord).toBeDefined();
    expect(dbRecord.status).toBe('PROCESSING');
  });
});
```

### 3. End-to-End (E2E) Tests
**Scope**: Critical user journeys from the browser to the database.
**Rules**:
- Run against a dedicated Staging environment.
- Use Playwright for reliable, headless browser automation.
- Limit to top 5-10 critical flows to keep CI/CD fast (< 15 mins total).

**Critical E2E Flows**:
1. **Creator Flow**: Register → Create Workspace → Upload PDF → Configure DRM → Get Embed Link.
2. **Buyer Flow**: Click Link → Stripe Checkout (Test Mode) → Receive Magic Link Email → Open Secure Viewer → Ask AI Question.
3. **DRM Enforcement Flow**: Open document on Device A → Attempt to open on Device B (success) → Attempt to open on Device C (blocked with 403).

### 4. Security & Negative Testing
**Scope**: Verifying that the system correctly *rejects* invalid or malicious actions.
**Rules**: Mandatory for all Task Packages involving auth, DRM, or payments.

**Test Cases**:
- Attempt to access another user's workspace (IDOR).
- Attempt to view a document without an `access_grant`.
- Attempt to reuse an expired presigned URL (expect 403).
- Attempt to exceed AI rate limits (expect 429).
- Attempt to inject XSS payloads into document metadata.

### 5. AI/RAG Specific Testing
**Scope**: Ensuring the AI worker behaves predictably and securely.
**Rules**:
- **Mock LLM Calls**: Use `vcrpy` (Python) or Jest mocks to record and replay LLM responses. Do not hit OpenAI API in CI.
- **Context Isolation**: Verify that a query for Document A never returns chunks from Document B.
- **Hallucination Check**: Test with out-of-context questions; the AI must respond with "I don't know based on the provided document."

---

## 📊 Coverage Requirements

| Component | Minimum Coverage | Critical Paths Coverage |
| :--- | :---: | :---: |
| Backend Services (NestJS) | 80% | 100% (Auth, DRM, Billing) |
| Backend AI Worker (FastAPI) | 70% | 100% (RAG retrieval, parsing) |
| Frontend Components (Next.js) | 70% | 100% (Secure Viewer, Auth Forms) |
| API Contracts | N/A | 100% (All endpoints validated) |

*Note: Coverage is a baseline, not a goal. Meaningful assertions are more important than hitting a percentage.*

---

## 🔄 CI/CD Integration

Testing is fully automated in GitHub Actions. No code is merged without passing the pipeline.

### Pipeline Gates
1. **Pre-commit**: Husky + lint-staged (formatting, basic linting).
2. **PR Validation**: 
   - `npm run test:unit` (Backend + Frontend)
   - `npm run test:integration` (Backend with TestContainers)
   - `npm run test:e2e` (Playwright)
   - `npm run security:scan` (Snyk, GitLeaks)
3. **Staging Deployment**: Automated smoke tests run immediately after deployment.

### Flaky Test Management
- If a test fails intermittently > 2 times, it is automatically quarantined (marked `.skip`).
- A GitHub Issue is created for the assigned developer to fix it within 24 hours.

---

## 📌 Key Takeaways for Implementation (Freebuff)

When Freebuff receives a Task Package, it **must** adhere to the following:

1. **Tests are Part of the Task**: A task is not "Done" until the corresponding tests are written and passing.
2. **Mock External Services**: Never make real network calls to Stripe, OpenAI, or S3 in unit/integration tests. Use mocks or local emulators (e.g., MinIO, LocalStack).
3. **Test the Negative Path**: For every feature, write at least one test proving that unauthorized/invalid access is blocked.
4. **Deterministic AI Tests**: Mock the LLM responses in AI worker tests to ensure CI runs are fast and deterministic.
5. **Clean State**: Ensure integration tests clean up the database after execution to prevent cross-test contamination.

---

## 🔗 Related Documents

- [Definition of Done](../07_Management_and_Process/Definition_of_Done.md) - Explicitly lists "Tests written and passing" as a requirement.
- [Acceptance Criteria](../07_Management_and_Process/Acceptance_Criteria.md) - Defines how to validate specific feature requirements.
- [Security Requirements](../04_Security_and_Access/Security_Requirements.md) - Details specific security test cases (DRM bypass, IDOR).
- [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) - Defines the modular structure that enables isolated unit testing.
```