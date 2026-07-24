Отлично. Выдаю следующий файл Раздела 04: `Authorization.md`.

```markdown
# Authorization

> **This document defines the authorization mechanisms, permission models, and access control strategies for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [System Architecture](./System_Architecture.md)
> - [Backend Architecture](./Backend_Architecture.md)
> - [Database Design](./Database_Design.md)
> - [Authentication](./Authentication.md)
> - [Roles and Permissions](./Roles_and_Permissions.md)
> - [Security Requirements](./Security_Requirements.md)

---

## 🎯 Architectural Decision Summary

| Aspect | Decision | Rationale | ADR Reference |
| :--- | :--- | :--- | :--- |
| AuthZ Model | RBAC (Role-Based Access Control) | Simple, scalable, aligns with business roles | ADR-020 |
| Granularity | Role + Resource Ownership | Prevents cross-tenant access, enforces multi-tenancy | ADR-021 |
| Session Control | Active session tracking in DB | DRM enforcement, concurrent device limits | ADR-022 |
| Policy Enforcement | Middleware + Service-level checks | Defense in depth, no single point of failure | ADR-023 |
| Workspace Isolation | Mandatory `workspace_id` in JWT + DB queries | Prevents data leakage between workspaces | ADR-024 |

---

## 🔐 Authorization Model Overview

The platform uses a **hybrid RBAC + Resource Ownership** model:

1. **Role-Based Access Control (RBAC)**: Determines what actions a user can perform based on their role (`admin`, `creator`, `viewer`).
2. **Resource Ownership**: Ensures users can only access resources they own or have been explicitly granted access to.
3. **Session-Level DRM**: Enforces concurrent session limits and device tracking for document viewers.

---

## 👥 Role Definitions

### 1. Admin (Platform Administrator)
**Scope**: Global platform access.

**Permissions**:
- Manage all users, workspaces, and documents.
- View platform-wide analytics.
- Manage subscriptions and billing.
- Access audit logs.
- Override DRM settings (for support purposes).

**Use Cases**:
- Internal platform operators.
- Customer support staff.

### 2. Creator (Content Owner)
**Scope**: Workspace-level access.

**Permissions**:
- Create, read, update, delete documents within owned workspaces.
- Configure document protection settings (watermarking, session limits).
- View analytics for owned documents.
- Manage workspace settings and billing.
- Grant/revoke access to documents (manual grants).

**Use Cases**:
- Authors, experts, course creators.
- Small businesses selling digital products.

### 3. Viewer (Content Buyer)
**Scope**: Document-level access (only purchased/granted documents).

**Permissions**:
- View documents they have purchased or been granted access to.
- Interact with AI features (Q&A, summaries) for accessible documents.
- Track their own reading progress.
- Manage their own profile.

**Use Cases**:
- End consumers of digital content.
- Students, professionals.

---

## 📋 Permission Matrix

| Action | Admin | Creator | Viewer |
| :--- | :---: | :---: | :---: |
| **Platform Management** | | | |
| Manage all users | ✅ | ❌ | ❌ |
| View platform analytics | ✅ | ❌ | ❌ |
| Access audit logs | ✅ | ❌ | ❌ |
| **Workspace Management** | | | |
| Create workspace | ✅ | ✅ | ❌ |
| Update workspace settings | ✅ | ✅ (own) | ❌ |
| Delete workspace | ✅ | ✅ (own) | ❌ |
| View workspace billing | ✅ | ✅ (own) | ❌ |
| **Document Management** | | | |
| Upload document | ✅ | ✅ (own workspace) | ❌ |
| Update document metadata | ✅ | ✅ (own) | ❌ |
| Delete document | ✅ | ✅ (own) | ❌ |
| Configure protection settings | ✅ | ✅ (own) | ❌ |
| View document analytics | ✅ | ✅ (own) | ❌ |
| **Document Access** | | | |
| View document | ✅ | ✅ (own) | ✅ (granted) |
| Download document | ✅ | ✅ (own, if allowed) | ✅ (granted, if allowed) |
| Use AI features | ✅ | ✅ (own) | ✅ (granted) |
| **Access Grants** | | | |
| Grant document access | ✅ | ✅ (own) | ❌ |
| Revoke document access | ✅ | ✅ (own) | ❌ |
| View access grants | ✅ | ✅ (own) | ❌ |
| **User Management** | | | |
| View own profile | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ |
| Delete own account | ✅ | ✅ | ✅ |

**Legend**:
- ✅ = Allowed
- ✅ (own) = Allowed only for resources owned by the user
- ✅ (granted) = Allowed only for resources explicitly granted to the user
- ❌ = Not allowed

---

## 🏢 Workspace-Level Authorization

### Principle
Every resource (document, analytics, settings) belongs to a **workspace**. Creators can only access resources within their own workspaces.

### Implementation

#### 1. JWT Contains `workspace_id`
```json
{
  "sub": "user_uuid",
  "email": "creator@example.com",
  "role": "creator",
  "workspace_id": "workspace_uuid", // Current active workspace
  "iat": 1690000000,
  "exp": 1690000900
}
```

#### 2. Middleware Validates Workspace Ownership
```typescript
// guards/workspace-owner.guard.ts
@Injectable()
export class WorkspaceOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // From JWT
    const workspaceId = request.params.workspaceId || request.body.workspaceId;

    // Check if user owns the workspace
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || workspace.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this workspace');
    }

    return true;
  }
}
```

#### 3. All Queries Filter by `workspace_id`
```typescript
// documents.service.ts
async findAllByWorkspace(workspaceId: string, userId: string) {
  // Verify workspace ownership
  const workspace = await this.prisma.workspace.findUnique({
    where: { id: workspaceId, ownerId: userId },
  });

  if (!workspace) {
    throw new ForbiddenException('Workspace not found or access denied');
  }

  // Query documents filtered by workspace
  return this.prisma.document.findMany({
    where: { workspaceId },
  });
}
```

---

## 📄 Document-Level Authorization (DRM)

### Principle
Viewers can only access documents they have been explicitly granted access to (via purchase or manual grant).

### Implementation

#### 1. Access Grant Check
```typescript
// access.service.ts
async validateDocumentAccess(userId: string, documentId: string) {
  const grant = await this.prisma.accessGrant.findFirst({
    where: {
      userId,
      documentId,
      isActive: true,
      OR: [
        { expiresAt: null }, // Lifetime access
        { expiresAt: { gt: new Date() } }, // Not expired
      ],
    },
  });

  if (!grant) {
    throw new ForbiddenException('You do not have access to this document');
  }

  return grant;
}
```

#### 2. Session Initialization with DRM Checks
```typescript
// viewer.service.ts
async initializeSession(userId: string, documentId: string) {
  // 1. Validate document access
  await this.validateDocumentAccess(userId, documentId);

  // 2. Check concurrent session limits
  const document = await this.prisma.document.findUnique({
    where: { id: documentId },
  });

  const activeSessions = await this.prisma.session.count({
    where: {
      userId,
      documentId,
      isActive: true,
    },
  });

  const maxSessions = document.protectionConfig.max_concurrent_sessions || 2;

  if (activeSessions >= maxSessions) {
    throw new ForbiddenException(
      `You have reached the maximum number of active devices (${maxSessions})`
    );
  }

  // 3. Create new session
  const session = await this.prisma.session.create({
    data: {
      userId,
      documentId,
      deviceFingerprint: generateFingerprint(),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      isActive: true,
    },
  });

  return session;
}
```

#### 3. Session Heartbeat Validation
```typescript
// viewer.service.ts
async validateSessionHeartbeat(sessionId: string, userId: string) {
  const session = await this.prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.isActive || session.userId !== userId) {
    throw new ForbiddenException('Session is invalid or terminated');
  }

  // Update last activity
  await this.prisma.session.update({
    where: { id: sessionId },
    data: { lastActivity: new Date() },
  });

  return { valid: true };
}
```

---

## 🔒 Resource Ownership Validation

### Principle
Every API endpoint that accesses a resource must verify that the requesting user owns or has access to that resource.

### Implementation Pattern

```typescript
// documents.controller.ts
@Get(':id')
@UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
async getDocument(
  @Param('id') id: string,
  @CurrentUser() user: User,
) {
  // 1. Fetch document
  const document = await this.documentsService.findById(id);

  // 2. Verify ownership
  if (document.workspace.ownerId !== user.id) {
    throw new ForbiddenException('You do not own this document');
  }

  return document;
}
```

### Common Pitfalls to Avoid
❌ **Insecure**: Fetching resource without ownership check
```typescript
// BAD: No ownership validation
const document = await this.prisma.document.findUnique({
  where: { id: documentId },
});
return document;
```

✅ **Secure**: Always validate ownership
```typescript
// GOOD: Ownership validated
const document = await this.prisma.document.findUnique({
  where: { id: documentId, workspace: { ownerId: user.id } },
});

if (!document) {
  throw new ForbiddenException('Document not found or access denied');
}
return document;
```

---

## 🛡️ Defense in Depth Strategy

### Layer 1: Middleware (Route-Level)
- **JwtAuthGuard**: Validates JWT token.
- **RolesGuard**: Checks user role (admin, creator, viewer).
- **WorkspaceOwnerGuard**: Validates workspace ownership.

### Layer 2: Service-Level Checks
- Every service method validates resource ownership before performing operations.
- Prevents bypassing middleware via internal API calls.

### Layer 3: Database-Level Constraints
- Foreign key constraints ensure referential integrity.
- Row-Level Security (RLS) can be enabled in PostgreSQL for multi-tenant isolation (Phase 3).

---

## 📋 Implementation Guidelines (for Freebuff)

### Backend (NestJS)

#### 1. Guards Structure
```text
src/auth/guards/
├── jwt-auth.guard.ts          # Validates JWT token
├── roles.guard.ts             # Checks user role
├── workspace-owner.guard.ts   # Validates workspace ownership
└── document-access.guard.ts   # Validates document access (for viewers)
```

#### 2. Roles Guard Implementation
```typescript
// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No roles required
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.role === role);
  }
}

// Usage in controller
@Roles('admin', 'creator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Get()
async getDocuments() {
  // Only admins and creators can access
}
```

#### 3. Decorator for Current User
```typescript
// decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Usage in controller
@Get('me')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user: User) {
  return user;
}
```

#### 4. Workspace Owner Guard
```typescript
// guards/workspace-owner.guard.ts
@Injectable()
export class WorkspaceOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId = request.params.workspaceId || request.body.workspaceId;

    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || workspace.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this workspace');
    }

    // Attach workspace to request for downstream use
    request.workspace = workspace;

    return true;
  }
}
```

#### 5. Document Access Guard (for Viewers)
```typescript
// guards/document-access.guard.ts
@Injectable()
export class DocumentAccessGuard implements CanActivate {
  constructor(private accessService: AccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const documentId = request.params.documentId;

    // Admins and creators (owners) bypass access check
    if (user.role === 'admin') {
      return true;
    }

    if (user.role === 'creator') {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: { workspace: true },
      });

      if (document && document.workspace.ownerId === user.id) {
        return true;
      }
    }

    // Viewers must have explicit access grant
    await this.accessService.validateDocumentAccess(user.id, documentId);

    return true;
  }
}
```

---

## 🧪 Testing Requirements

### Unit Tests
- Role-based permission checks (each role tested against all actions).
- Workspace ownership validation.
- Document access grant validation.
- Concurrent session limit enforcement.

### Integration Tests
- Creator A cannot access Creator B's workspace.
- Viewer cannot access document without purchase.
- Viewer can access document after purchase.
- Concurrent session limit blocks 3rd device.
- Admin can access all resources.

### Security Tests
- Attempt to access resource by changing ID in URL (IDOR prevention).
- Attempt to bypass workspace ownership by manipulating JWT.
- Attempt to access expired document grant.
- Attempt to exceed concurrent session limit.

---

## 📌 Key Takeaways

1. **RBAC + Resource Ownership**: Roles define capabilities, ownership defines scope.
2. **Workspace Isolation**: Every query must filter by `workspace_id` and validate ownership.
3. **DRM Enforcement**: Document access requires explicit grants, validated on every request.
4. **Session Tracking**: Concurrent sessions enforced via DB + heartbeats.
5. **Defense in Depth**: Middleware + service-level checks + DB constraints.
6. **No Implicit Trust**: Every endpoint validates ownership, even if middleware already checked.

---

## 🔗 Related Documents

- [Roles and Permissions](./Roles_and_Permissions.md) - Detailed role definitions and permission matrix.
- [Security Requirements](./Security_Requirements.md) - DRM implementation details.
- [Authentication](./Authentication.md) - JWT structure and token management.
- [Database Design](./Database_Design.md) - Schema for `access_grants`, `sessions`, `workspaces`.
```