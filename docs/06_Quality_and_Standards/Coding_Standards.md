```markdown
# Coding Standards

> **This document defines the mandatory coding standards, naming conventions, formatting rules, and best practices for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md)
> - [Frontend Architecture](../03_Architecture_and_Design/Frontend_Architecture.md)
> - [Testing Strategy](./Testing_Strategy.md)
> - [Definition of Done](../07_Management_and_Process/Definition_of_Done.md)
> - [Project Structure](./Project_Structure.md)

---

## 🎯 Core Philosophy

As CTO, I enforce **Readability over Cleverness** and **Maintainability over Optimization**. Code is read far more often than it is written. Every line of code must be understandable by another developer (or AI agent) without requiring oral history.

### Guiding Principles
1. **KISS (Keep It Simple, Stupid)**: Avoid over-engineering. The simplest solution that meets the requirements is the best.
2. **YAGNI (You Aren't Gonna Need It)**: Do not add functionality "just in case". Implement only what is in the current Task Package.
3. **DRY (Don't Repeat Yourself)**: Abstract common logic, but do not prematurely abstract.
4. **SOLID**: Adhere to Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles.
5. **Clean Architecture**: Dependencies point inward. Business logic is isolated from frameworks, databases, and UI.
6. **Fail Fast**: Validate inputs at the boundaries. Throw errors early with clear, actionable messages.

---

## 📝 1. General Naming Conventions

Consistency is paramount. We use the following naming conventions across all languages.

| Entity | Convention | Example |
| :--- | :--- | :--- |
| **Variables / Functions** | `camelCase` | `userId`, `generatePresignedUrl` |
| **Classes / Interfaces / Types** | `PascalCase` | `UserService`, `DocumentMetadata` |
| **Constants / Enums** | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_SIZE`, `UserRole` |
| **Database Tables** | `snake_case` (plural) | `users`, `access_grants` |
| **Database Columns** | `snake_case` | `created_at`, `workspace_id` |
| **Files / Directories** | `kebab-case` | `user-service.ts`, `ai-worker` |
| **Environment Variables** | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `STRIPE_SECRET_KEY` |

### Specific Rules
- **Boolean variables**: Prefix with `is`, `has`, `can`, or `should` (e.g., `isVerified`, `hasAccess`).
- **Functions**: Must start with a verb (e.g., `fetchDocument`, `validateSession`, `calculateCost`).
- **Interfaces**: Do not prefix with `I` (e.g., use `User`, not `IUser`).

---

## 💻 2. Backend Standards (Node.js + NestJS)

### TypeScript Configuration
- `strict: true` is mandatory. No `any` types allowed. Use `unknown` if type is truly dynamic, followed by type guards.
- `noImplicitReturns: true`, `noUnusedLocals: true`, `noUnusedParameters: true`.

### NestJS Specifics
- **Controllers**: Thin. Only handle HTTP request/response mapping, validation, and calling services. No business logic.
- **Services**: Contain all business logic. Must be injectable and easily mockable for unit tests.
- **DTOs**: Use `class-validator` and `class-transformer` for all incoming request payloads.
- **Error Handling**: Use custom Exception Filters. Never return generic `500 Internal Server Error` without logging the root cause. Use standard HTTP status codes.

```typescript
// ✅ GOOD: Thin controller, delegated logic
@Post()
@UsePipes(new ValidationPipe({ transform: true }))
async createDocument(@Body() dto: CreateDocumentDto, @CurrentUser() user: User) {
  return this.documentsService.create(user.id, dto);
}

// ❌ BAD: Business logic in controller
@Post()
async createDocument(@Body() body: any, @Req() req: any) {
  const doc = await prisma.document.create({ data: body });
  return doc;
}
```

### Error Handling
- Always throw NestJS built-in exceptions (`BadRequestException`, `ForbiddenException`, `NotFoundException`) or custom domain exceptions.
- Error messages must be user-friendly but not leak internal system details (e.g., stack traces, DB schema).

---

## 🐍 3. AI Worker Standards (Python + FastAPI)

### Python Configuration
- Type hints are mandatory for all function signatures and class attributes (Python 3.10+ syntax).
- Use `pydantic` v2 for all request/response validation and settings management.

### FastAPI Specifics
- **Routers**: Group related endpoints. Keep them thin.
- **Dependencies**: Use FastAPI's `Depends` for database sessions, authentication, and shared logic.
- **Async**: Use `async def` for I/O bound operations (DB calls, LLM API calls). Use `def` for CPU-bound operations (text parsing, chunking) and offload to background tasks if blocking.

```python
# ✅ GOOD: Type hints, Pydantic, Async I/O
@router.post("/query")
async def query_document(
    query: QueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> QueryResponse:
    answer = await rag_service.generate_answer(query.document_id, query.question)
    return QueryResponse(answer=answer)
```

---

## 🎨 4. Frontend Standards (Next.js + React)

### TypeScript & React
- **Functional Components**: Use exclusively. No class components.
- **Props**: Define using `interface` or `type`. Destructure props in the function signature.
- **Hooks**: Custom hooks must start with `use` (e.g., `useDocumentAccess`).
- **Server vs Client Components**: Default to Server Components (`'use server'` implicitly in App Router). Use `'use client'` only when interactivity (state, effects, event listeners) is strictly required.

### Styling (Tailwind CSS)
- Use utility classes directly in JSX.
- Use `clsx` or `tailwind-merge` (`cn` utility) for conditional classes.
- Do not create custom CSS files unless absolutely necessary (e.g., complex canvas animations).

```tsx
// ✅ GOOD: Clean, typed, conditional classes
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-md font-medium transition-colors",
        variant === 'primary' ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-800",
        className
      )}
      {...props}
    />
  );
}
```

---

## 🛠️ 5. Tooling & Automation

Manual enforcement of standards fails. We automate everything.

### Linting & Formatting
- **ESLint**: Enforces code quality and catches potential bugs.
  - Config: `eslint-config-next` + `@typescript-eslint/recommended` + `eslint-plugin-security`.
- **Prettier**: Enforces consistent formatting (no debates about tabs vs spaces).
  - Config: `printWidth: 100`, `singleQuote: true`, `trailingComma: 'es5'`.
- **Husky + lint-staged**: Runs Prettier and ESLint on staged files *before* every commit.

### Pre-commit Hook Example
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

---

## 📦 6. Git & Version Control

### Branching Strategy
- `main`: Production-ready code. Protected. Requires PR + CI checks.
- `develop`: Integration branch for staging. Protected.
- `feature/<ticket-id>-<short-description>`: Feature branches (e.g., `feature/123-add-watermark`).
- `bugfix/<ticket-id>-<short-description>`: Bug fix branches.

### Commit Message Convention
We use **Conventional Commits** to enable automated changelog generation and clear history.

Format: `<type>(<scope>): <subject>`

| Type | Description |
| :--- | :--- |
| `feat` | A new feature (correlates with MINOR version) |
| `fix` | A bug fix (correlates with PATCH version) |
| `docs` | Documentation only changes |
| `style` | Changes that do not affect the meaning of the code (formatting) |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `test` | Adding missing tests or correcting existing tests |
| `chore` | Changes to the build process or auxiliary tools |

**Examples:**
- `feat(viewer): add dynamic watermark overlay`
- `fix(auth): resolve magic link expiration bug`
- `refactor(api): extract session validation to dedicated guard`

---

## 🪵 7. Logging Standards

Logs are for debugging and auditing, not for general application flow.

### Rules
1. **Structured Logging**: Always log in JSON format.
2. **Log Levels**:
   - `DEBUG`: Detailed diagnostic information (disabled in production).
   - `INFO`: Normal application flow (e.g., "User logged in", "Document processed").
   - `WARN`: Unexpected but handled situations (e.g., "Rate limit approaching", "Fallback to cached AI response").
   - `ERROR`: Unhandled exceptions, failed external API calls, business logic failures (e.g., "Stripe webhook signature invalid").
3. **No Sensitive Data**: NEVER log passwords, tokens, full credit card numbers, or raw PII beyond what is necessary for audit (use user IDs instead of emails where possible).
4. **Context**: Always include `userId`, `documentId`, or `requestId` in logs for traceability.

```typescript
// ✅ GOOD: Structured, contextual, safe
logger.info({ event: 'document_viewed', userId: user.id, documentId: doc.id, page: 15 }, 'Document page viewed');

// ❌ BAD: Unstructured, leaks PII
console.log(`User ${user.email} with token ${token} viewed page 15`);
```

---

## 📌 Key Takeaways for Implementation (Freebuff)

When Freebuff generates code, it **must** pass the following automated and manual checks:

1. **Zero ESLint/Prettier Errors**: The CI pipeline will fail otherwise.
2. **Strict TypeScript**: No `any`, no `@ts-ignore` without a documented ADR.
3. **Conventional Commits**: All commit messages must follow the specified format.
4. **No Business Logic in Controllers**: Services must handle the logic.
5. **Structured Logs**: No `console.log` in production code. Use the injected logger service.
6. **DRY**: If a piece of logic is duplicated more than twice, abstract it into a utility or shared service.

---

## 🔗 Related Documents

- [Project Structure](./Project_Structure.md) - Defines where files should be placed.
- [Testing Strategy](./Testing_Strategy.md) - Defines how code quality is verified beyond linting.
- [Definition of Done](../07_Management_and_Process/Definition_of_Done.md) - Includes "Code adheres to Coding Standards" as a mandatory checklist item.
- [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) - Provides context for NestJS module structure.
```