```markdown
# Roles and Permissions

> **This document provides detailed role definitions, permission matrices, and access control rules for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [Authentication](./Authentication.md)
> - [Authorization](./Authorization.md)
> - [Security Requirements](./Security_Requirements.md)
> - [Database Design](../03_Architecture_and_Design/Database_Design.md)
> - [API Contracts](../03_Architecture_and_Design/API_Contracts.md)

---

## 🎯 Role-Based Access Control (RBAC) Overview

The platform implements a **three-tier role system** with strict isolation and resource ownership validation:

| Role | Scope | Primary Use Case |
| :--- | :--- | :--- |
| **Admin** | Global (Platform-wide) | Internal platform operators, support staff |
| **Creator** | Workspace-level | Authors, experts, course creators, businesses |
| **Viewer** | Document-level (granted only) | End consumers, students, professionals |

---

## 👤 Role 1: Admin (Platform Administrator)

### Identity
- **Who**: Internal team members, platform operators, customer support.
- **Authentication**: Email + password (mandatory), MFA recommended.
- **JWT Claims**:
  ```json
  {
    "sub": "user_uuid",
    "email": "admin@knowledgevault.com",
    "role": "admin",
    "workspace_id": null, // Admins operate across all workspaces
    "iat": 1690000000,
    "exp": 1690000900
  }
  ```

### Capabilities

#### Platform Management
- ✅ View, create, update, delete **all users** across the platform.
- ✅ View, create, update, delete **all workspaces**.
- ✅ Access platform-wide analytics and metrics.
- ✅ Manage platform settings (feature flags, rate limits, maintenance mode).
- ✅ View and search audit logs for security investigations.
- ✅ Override workspace-level DRM settings (for support/debugging).
- ✅ Manually grant/revoke access to any document (customer support).

#### Billing & Subscriptions
- ✅ View all subscription statuses across workspaces.
- ✅ Manually adjust subscription plans (for support).
- ✅ Issue refunds and credits.
- ✅ View platform revenue and MRR metrics.

#### Security & Compliance
- ✅ Terminate any user session (emergency response).
- ✅ Ban/suspend user accounts.
- ✅ Access GDPR data deletion requests.
- ✅ View security incidents and breach reports.

### Restrictions
- ❌ Cannot delete platform infrastructure or core configuration.
- ❌ Cannot modify other admin accounts (requires super-admin approval).
- ❌ Cannot access raw user passwords or OAuth tokens.

### Use Cases
1. **Customer Support**: "User forgot password, need to send magic link manually."
2. **Security Incident**: "Suspicious activity detected, need to terminate sessions."
3. **Billing Issue**: "Creator's payment failed, need to extend trial period."
4. **Compliance**: "GDPR deletion request received, need to anonymize user data."

---

## 👤 Role 2: Creator (Content Owner)

### Identity
- **Who**: Authors, experts, coaches, course creators, small businesses.
- **Authentication**: Email + password, OAuth (Google/GitHub), or magic link.
- **JWT Claims**:
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

### Capabilities

#### Workspace Management
- ✅ Create new workspaces (up to plan limit).
- ✅ Update workspace settings (name, branding, custom domain).
- ✅ Delete workspace (soft delete, 30-day recovery period).
- ✅ View workspace billing and subscription status.
- ✅ Upgrade/downgrade workspace plan via Stripe.
- ✅ Invite team members to workspace (future feature, Phase 3).

#### Document Management
- ✅ Upload documents (PDF, EPUB, ZIP) to owned workspaces.
- ✅ Update document metadata (title, description, tags).
- ✅ Delete documents (soft delete, 30-day recovery).
- ✅ Configure document protection settings:
  - Enable/disable watermarking.
  - Set max concurrent sessions (1-5).
  - Allow/disallow text selection.
  - Allow/disallow direct download.
- ✅ View document processing status (upload → parse → AI embed → ready).
- ✅ Re-process documents (re-generate AI summaries, embeddings).
- ✅ Upload new document versions (existing buyers get access to new version).

#### Analytics & Insights
- ✅ View document-level analytics:
  - Total views, unique viewers.
  - Average time spent per page.
  - Drop-off rates (which pages are skipped).
  - AI interaction counts (Q&A, summaries).
- ✅ Export analytics data (CSV, PDF reports).
- ✅ View AI usage metrics (tokens consumed, cost).

#### Access Grants
- ✅ Manually grant document access to specific users (by email).
- ✅ Revoke document access from specific users.
- ✅ View list of all users with access to each document.
- ✅ Set expiration dates for access grants (optional).

#### Distribution
- ✅ Generate secure access links for documents.
- ✅ Embed viewer widget on external websites (via script tag).
- ✅ Integrate with Stripe Checkout (webhook-based).
- ✅ Create coupon codes for discounts (future feature).

### Restrictions
- ❌ Cannot access documents or workspaces owned by other creators.
- ❌ Cannot view platform-wide analytics (only own workspace).
- ❌ Cannot modify platform settings or other users' accounts.
- ❌ Cannot exceed plan limits (document count, viewer count, AI usage).
- ❌ Cannot disable DRM features below plan minimum (e.g., Starter plan requires watermarking).

### Use Cases
1. **Content Upload**: "I wrote a 200-page SEO guide, need to upload and protect it."
2. **Analytics Review**: "Which chapters are readers skipping? Need to improve content."
3. **Access Management**: "VIP customer needs lifetime access, granting manually."
4. **Version Update**: "Fixed typos in guide, uploading v2 for existing buyers."
5. **Integration**: "Embedding secure viewer on my Webflow site."

---

## 👤 Role 3: Viewer (Content Buyer)

### Identity
- **Who**: End consumers, students, professionals who purchased or were granted access.
- **Authentication**: Magic link (passwordless) or email + password (if they create account).
- **JWT Claims**:
  ```json
  {
    "sub": "user_uuid",
    "email": "buyer@example.com",
    "role": "viewer",
    "workspace_id": null, // Viewers don't own workspaces
    "iat": 1690000000,
    "exp": 1690000900
  }
  ```

### Capabilities

#### Document Library
- ✅ View list of all documents they have access to (purchased or granted).
- ✅ Access documents from any device (subject to concurrent session limits).
- ✅ Track reading progress (last page viewed, completion percentage).
- ✅ Bookmark pages (future feature, Phase 2).

#### Secure Viewing
- ✅ View documents in secure canvas-based viewer.
- ✅ Navigate pages (next/prev, jump to page).
- ✅ Zoom in/out (pinch-to-zoom on mobile).
- ✅ Search within document (if text layer is enabled).
- ✅ View dynamic watermark (user email + timestamp + session ID).

#### AI Features
- ✅ Access AI-generated summary for each document.
- ✅ Use AI Q&A assistant (ask questions, get answers with source citations).
- ✅ Take AI-generated quizzes (if enabled by creator).
- ✅ Use AI-generated flashcards (if enabled by creator).
- ✅ View AI usage stats (queries remaining for current period).

#### Progress Tracking
- ✅ View completion certificates (if document has quiz/completion tracking).
- ✅ Track time spent reading (for personal analytics).
- ✅ Resume from last viewed page.

#### Account Management
- ✅ View and update own profile (name, email, avatar).
- ✅ View access grant history (which documents, when granted, expiration).
- ✅ Request data deletion (GDPR "Right to be Forgotten").
- ✅ Delete own account.

### Restrictions
- ❌ Cannot access documents without explicit access grant.
- ❌ Cannot download raw document files (unless creator explicitly allows).
- ❌ Cannot share access with other users (access is non-transferable).
- ❌ Cannot exceed concurrent session limits (enforced via DRM).
- ❌ Cannot modify document protection settings.
- ❌ Cannot view document analytics (only creator can).
- ❌ Cannot upload documents (viewers are consumers, not creators).
- ❌ Cannot disable watermarks or DRM features.

### Use Cases
1. **Purchase Access**: "Bought SEO guide via Stripe, received magic link in email."
2. **Reading**: "Opening guide on iPad during commute, resuming from page 45."
3. **AI Assistance**: "Asking AI assistant to explain a complex concept from the guide."
4. **Quiz**: "Taking auto-generated quiz to test my understanding."
5. **Multi-Device**: "Reading on laptop at work, switching to phone on train."

---

## 📋 Detailed Permission Matrix

### Platform-Level Actions

| Action | Admin | Creator | Viewer |
| :--- | :---: | :---: | :---: |
| View platform-wide analytics | ✅ | ❌ | ❌ |
| Manage all users | ✅ | ❌ | ❌ |
| Manage all workspaces | ✅ | ❌ | ❌ |
| Access audit logs | ✅ | ❌ | ❌ |
| Override DRM settings | ✅ | ❌ | ❌ |
| Terminate any session | ✅ | ❌ | ❌ |
| Ban/suspend users | ✅ | ❌ | ❌ |
| View platform revenue | ✅ | ❌ | ❌ |

### Workspace-Level Actions

| Action | Admin | Creator | Viewer |
| :--- | :---: | :---: | :---: |
| Create workspace | ✅ | ✅ | ❌ |
| Update workspace settings | ✅ | ✅ (own) | ❌ |
| Delete workspace | ✅ | ✅ (own) | ❌ |
| View workspace billing | ✅ | ✅ (own) | ❌ |
| Upgrade/downgrade plan | ✅ | ✅ (own) | ❌ |
| Invite team members | ✅ | ✅ (own) | ❌ |
| View workspace analytics | ✅ | ✅ (own) | ❌ |

### Document-Level Actions

| Action | Admin | Creator | Viewer |
| :--- | :---: | :---: | :---: |
| Upload document | ✅ | ✅ (own workspace) | ❌ |
| Update document metadata | ✅ | ✅ (own) | ❌ |
| Delete document | ✅ | ✅ (own) | ❌ |
| Configure protection settings | ✅ | ✅ (own) | ❌ |
| View document analytics | ✅ | ✅ (own) | ❌ |
| Re-process document (AI) | ✅ | ✅ (own) | ❌ |
| Upload new version | ✅ | ✅ (own) | ❌ |
| View document | ✅ | ✅ (own) | ✅ (granted) |
| Download document | ✅ | ✅ (own, if allowed) | ✅ (granted, if allowed) |
| Use AI features | ✅ | ✅ (own) | ✅ (granted) |
| Search within document | ✅ | ✅ (own) | ✅ (granted, if enabled) |
| View completion certificate | ✅ | ✅ (own) | ✅ (granted) |

### Access Grant Actions

| Action | Admin | Creator | Viewer |
| :--- | :---: | :---: | :---: |
| Grant document access | ✅ | ✅ (own) | ❌ |
| Revoke document access | ✅ | ✅ (own) | ❌ |
| View access grants | ✅ | ✅ (own) | ❌ |
| Set expiration on grant | ✅ | ✅ (own) | ❌ |
| View own access grants | ✅ | ✅ | ✅ |

### User Management Actions

| Action | Admin | Creator | Viewer |
| :--- | :---: | :---: | :---: |
| View own profile | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ |
| Delete own account | ✅ | ✅ | ✅ |
| View other users' profiles | ✅ | ❌ | ❌ |
| Update other users' profiles | ✅ | ❌ | ❌ |
| Delete other users' accounts | ✅ | ❌ | ❌ |

---

## 🔒 Resource Ownership Rules

### Rule 1: Workspace Isolation
**Principle**: Creators can only access resources within their own workspaces.

**Implementation**:
- Every query for workspace-scoped resources must include `WHERE workspace_id = ? AND workspace.owner_id = ?`.
- JWT contains `workspace_id` to prevent cross-workspace access.
- Middleware validates workspace ownership before allowing mutations.

**Example**:
```typescript
// Creator A tries to access Creator B's document
const document = await prisma.document.findFirst({
  where: {
    id: documentId,
    workspace: {
      ownerId: currentUser.id // Ensures ownership
    }
  }
});

if (!document) {
  throw new ForbiddenException('Document not found or access denied');
}
```

### Rule 2: Document Access Grants
**Principle**: Viewers can only access documents they have been explicitly granted access to.

**Implementation**:
- `access_grants` table tracks which users have access to which documents.
- Every viewer request to view a document must validate the grant.
- Grants can have expiration dates (null = lifetime access).

**Example**:
```typescript
const grant = await prisma.accessGrant.findFirst({
  where: {
    userId: currentUser.id,
    documentId: documentId,
    isActive: true,
    OR: [
      { expiresAt: null }, // Lifetime
      { expiresAt: { gt: new Date() } } // Not expired
    ]
  }
});

if (!grant) {
  throw new ForbiddenException('You do not have access to this document');
}
```

### Rule 3: Concurrent Session Limits (DRM)
**Principle**: Viewers cannot exceed the maximum number of concurrent sessions per document.

**Implementation**:
- `sessions` table tracks active viewing sessions.
- On session initialization, count active sessions for user + document.
- If count >= `protection_config.max_concurrent_sessions`, reject request.
- Frontend sends heartbeat every 60 seconds to keep session alive.
- Sessions inactive for 5 minutes are automatically terminated.

**Example**:
```typescript
const activeSessions = await prisma.session.count({
  where: {
    userId: currentUser.id,
    documentId: documentId,
    isActive: true,
    lastActivity: { gt: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 min
  }
});

const maxSessions = document.protectionConfig.max_concurrent_sessions || 2;

if (activeSessions >= maxSessions) {
  throw new ForbiddenException(
    `You have reached the maximum number of active devices (${maxSessions})`
  );
}
```

---

## 🎯 Edge Cases & Special Scenarios

### Scenario 1: Creator Becomes Viewer
**Situation**: Creator A purchases a document from Creator B.

**Solution**:
- Creator A's role remains `creator` (they still own their workspace).
- An `access_grant` is created for Creator A to view Creator B's document.
- Creator A can view the document as a viewer, but cannot modify it.
- Creator A's own documents remain accessible with full creator permissions.

**Implementation**:
- Role is not mutually exclusive with access grants.
- `DocumentAccessGuard` checks both ownership (creator) and grants (viewer).

### Scenario 2: Workspace Transfer
**Situation**: Creator A wants to transfer ownership of a workspace to Creator B.

**Solution** (Phase 3 feature):
- Admin can reassign `workspace.owner_id` to another user.
- All documents, analytics, and access grants remain intact.
- Original owner loses access (unless explicitly granted).
- Audit log records the transfer.

### Scenario 3: Viewer Becomes Creator
**Situation**: Viewer A decides to start selling their own content.

**Solution**:
- Viewer A upgrades their account to `creator` role.
- A new workspace is created for Viewer A (now Creator A).
- Existing access grants (as viewer) remain intact.
- Creator A can now upload and sell documents.

**Implementation**:
- Role change is a simple update to `users.role`.
- No data migration required (access grants are separate from role).

### Scenario 4: Document Deletion with Active Viewers
**Situation**: Creator deletes a document that viewers are currently reading.

**Solution**:
- Document is soft-deleted (marked as `deleted_at`, not removed from DB).
- Active sessions are terminated with message: "Document no longer available."
- Viewers lose access immediately.
- Document remains in DB for 30 days (recovery period).
- After 30 days, hard delete removes document and all related data.

### Scenario 5: Admin Impersonation
**Situation**: Admin needs to troubleshoot a creator's issue by "impersonating" them.

**Solution** (Phase 3 feature):
- Admin can generate a temporary "impersonation token" for a specific workspace.
- Token has `role: admin` but `workspace_id: target_workspace`.
- Audit log records impersonation (admin ID, target workspace, duration).
- Impersonation expires after 1 hour (configurable).
- Admin cannot modify user passwords or OAuth tokens during impersonation.

---

## 🛡️ Security Considerations

### Principle of Least Privilege
- Users are granted only the minimum permissions required for their role.
- Admins have broad access but cannot perform destructive actions without audit trails.
- Creators have full control over their workspaces but cannot access others'.
- Viewers have read-only access to granted documents only.

### No Implicit Trust
- Every API endpoint validates permissions, even if middleware already checked.
- Resource ownership is verified at the database query level.
- Session validity is checked on every viewer request (heartbeat).

### Audit Trail
- All permission changes are logged (role changes, access grants, session terminations).
- Admin actions are logged with admin ID, target resource, and timestamp.
- Logs are immutable and retained for 1 year (configurable).

### Rate Limiting by Role
- **Admin**: 1000 requests/min (higher limit for support operations).
- **Creator**: 100 requests/min (standard limit).
- **Viewer**: 50 requests/min (lower limit to prevent abuse).
- **AI Queries**: 10 queries/min per user (all roles).

---

## 🧪 Testing Requirements

### Unit Tests
- Test each role against all actions in the permission matrix.
- Test workspace isolation (Creator A cannot access Creator B's workspace).
- Test document access grants (viewer can/cannot access based on grant).
- Test concurrent session limits (3rd device is rejected).
- Test role transitions (viewer → creator, creator → viewer).

### Integration Tests
- Admin can access all resources.
- Creator can only access own workspace resources.
- Viewer can only access granted documents.
- Expired access grants are rejected.
- Concurrent session limit is enforced across devices.
- Soft-deleted documents are inaccessible.

### Security Tests
- Attempt IDOR (Insecure Direct Object Reference) attacks:
  - Change document ID in URL to access another creator's document.
  - Change workspace ID to access another workspace.
- Attempt privilege escalation:
  - Viewer tries to upload document.
  - Creator tries to access platform-wide analytics.
- Attempt session hijacking:
  - Use another user's session ID.
  - Reuse expired session token.
- Attempt DRM bypass:
  - Open document on 3rd device (should be rejected).
  - Disable heartbeat (session should terminate after 5 min).

---

## 📌 Key Takeaways for Implementation (Freebuff)

1. **Role is stored in JWT**: Quick access without DB query, but must be validated on critical operations.
2. **Workspace ownership is mandatory**: Every workspace-scoped query must validate `owner_id`.
3. **Access grants are explicit**: Viewers cannot access documents without a grant in `access_grants` table.
4. **Sessions are tracked**: DRM enforcement requires active session validation on every viewer request.
5. **Admins have broad access**: But all admin actions are logged for audit.
6. **Soft deletes are preferred**: 30-day recovery period for documents and workspaces.
7. **No implicit trust**: Always validate permissions at the service level, not just middleware.

---

## 🔗 Related Documents

- [Authentication](./Authentication.md) - JWT structure, token management, OAuth flows.
- [Authorization](./Authorization.md) - Middleware, guards, ownership validation patterns.
- [Security Requirements](./Security_Requirements.md) - DRM implementation, watermarking, session management.
- [Database Design](../03_Architecture_and_Design/Database_Design.md) - Schema for `users`, `workspaces`, `access_grants`, `sessions`.
- [API Contracts](../03_Architecture_and_Design/API_Contracts.md) - Endpoint definitions, error codes, rate limiting.
```