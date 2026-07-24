Отлично. Приступаю к **Разделу 04: Security and Access**. Это критически важный раздел для нашей DRM-платформы, так как безопасность контента и управление доступом являются ядром продукта.

Выдаю первый файл: `Authentication.md`.

```markdown
# Authentication

> **This document defines the authentication mechanisms, token management, and security protocols for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [System Architecture](./System_Architecture.md)
> - [Backend Architecture](./Backend_Architecture.md)
> - [API Contracts](./API_Contracts.md)
> - [Authorization](./Authorization.md)
> - [Security Requirements](./Security_Requirements.md)
> - [Database Design](./Database_Design.md)

---

## 🎯 Architectural Decision Summary

| Aspect | Decision | Rationale | ADR Reference |
| :--- | :--- | :--- | :--- |
| Auth Method | JWT (Access + Refresh tokens) | Stateless, scalable, works across services | ADR-014 |
| Token Storage | HttpOnly cookies (refresh) + memory (access) | Prevents XSS, secure by default | ADR-015 |
| OAuth Providers | Google, GitHub | Most common for creators/developers | ADR-016 |
| Magic Links | Email-based passwordless login | Frictionless buyer experience | ADR-017 |
| Password Hashing | bcrypt (cost factor 12) | Industry standard, resistant to brute force | ADR-018 |
| Token Expiry | Access: 15min, Refresh: 7 days | Balance security and UX | ADR-019 |

---

## 🔐 Authentication Methods

### 1. Email + Password (Creators & Admins)

**Flow:**
1. User submits email + password to `POST /v1/auth/login`.
2. Backend validates credentials against `users.password_hash` (bcrypt).
3. On success, generates:
   - **Access Token**: Short-lived JWT (15 minutes), contains user ID, email, role, workspace_id.
   - **Refresh Token**: Long-lived JWT (7 days), stored in HttpOnly cookie.
4. Returns access token in response body, refresh token in HttpOnly cookie.

**Security Measures:**
- Password must be hashed with bcrypt (cost factor 12, auto-generated salt).
- Rate limiting: 5 failed attempts per IP per 15 minutes.
- Account lockout: After 10 failed attempts, require email verification to unlock.

---

### 2. OAuth 2.0 (Google, GitHub)

**Flow:**
1. User clicks "Sign in with Google/GitHub" on frontend.
2. Frontend redirects to OAuth provider's authorization URL.
3. User grants permission, provider redirects back to `/v1/auth/oauth/callback`.
4. Backend exchanges authorization code for access token from provider.
5. Backend fetches user profile (email, name, avatar) from provider API.
6. Backend checks if user exists in `users` table:
   - **If exists**: Link OAuth account (update `users.oauth_provider`, `users.oauth_id`).
   - **If not exists**: Create new user account (set `users.password_hash = NULL`).
7. Generate JWT tokens (same as email/password flow).

**Security Measures:**
- Validate OAuth state parameter to prevent CSRF attacks.
- Verify email is verified by OAuth provider before creating account.
- Store OAuth tokens securely (encrypted at rest if persisted).

---

### 3. Magic Link (Buyers - Passwordless)

**Flow:**
1. Buyer clicks "Access your purchase" link in email (sent after Stripe checkout).
2. Link contains a short-lived, single-use token: `/v1/auth/magic-link?token=...`.
3. Backend validates token:
   - Check if token exists in Redis (key: `magic_link:{token}`).
   - Check if token is not expired (TTL: 15 minutes).
   - Check if token is not already used.
4. On success:
   - Delete token from Redis (prevent reuse).
   - Create or retrieve user account (by email).
   - Generate JWT tokens.
   - Redirect to `/viewer/library` with tokens set.

**Security Measures:**
- Token is cryptographically random (32 bytes, base64 encoded).
- Single-use only (deleted after first validation).
- Short TTL (15 minutes).
- Rate limiting: Max 3 magic link requests per email per hour.

---

## 🎫 JWT Token Strategy

### Access Token Structure

```json
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "role": "creator",
  "workspace_id": "workspace_uuid",
  "iat": 1690000000,
  "exp": 1690000900
}
```

**Claims:**
- `sub`: User ID (UUID).
- `email`: User email (for quick access without DB query).
- `role`: User role (`admin`, `creator`, `viewer`).
- `workspace_id`: Current active workspace (for creators).
- `iat`: Issued at (timestamp).
- `exp`: Expiration time (15 minutes from issuance).

**Signing:**
- Algorithm: `HS256` (HMAC with SHA-256).
- Secret: 256-bit random key, stored in environment variable (`JWT_SECRET`).
- **Future**: Migrate to `RS256` (RSA) for microservices architecture.

### Refresh Token Structure

```json
{
  "sub": "user_uuid",
  "token_type": "refresh",
  "iat": 1690000000,
  "exp": 1690604800
}
```

**Claims:**
- `sub`: User ID (UUID).
- `token_type`: Always `"refresh"` (to distinguish from access tokens).
- `iat`: Issued at.
- `exp`: Expiration time (7 days from issuance).

**Storage:**
- Refresh tokens are stored in **HttpOnly, Secure, SameSite=Strict** cookies.
- Cookie name: `refresh_token`.
- Cookie path: `/v1/auth/refresh` (scoped to refresh endpoint only).

**Rotation:**
- On each refresh, a new refresh token is issued, and the old one is invalidated.
- Refresh tokens are stored in Redis (key: `refresh_token:{token_hash}`, TTL: 7 days).
- If a revoked refresh token is reused, all active sessions for that user are terminated (security measure).

---

## 🔒 Token Storage Strategy

### Frontend (Next.js)

**Access Token:**
- Stored in **memory** (React state or Zustand store).
- **Never** stored in `localStorage` or `sessionStorage` (XSS risk).
- Lost on page refresh (requires re-authentication or silent refresh via refresh token).

**Refresh Token:**
- Stored in **HttpOnly cookie** (set by backend).
- Inaccessible to JavaScript (prevents XSS theft).
- Automatically sent with requests to `/v1/auth/refresh`.

**Silent Refresh Flow:**
1. On app load, check if access token exists in memory.
2. If not, call `POST /v1/auth/refresh` (refresh token cookie is sent automatically).
3. If refresh succeeds, store new access token in memory.
4. If refresh fails (401), redirect to `/login`.

---

## 🛡️ Security Considerations

### Password Security
- **Minimum Length**: 8 characters.
- **Complexity**: At least 1 uppercase, 1 lowercase, 1 number, 1 special character (enforced via Zod schema).
- **Hashing**: bcrypt with cost factor 12 (takes ~250ms per hash, resistant to GPU attacks).
- **No Plaintext Logging**: Passwords are never logged, even in error messages.

### Token Security
- **Short-Lived Access Tokens**: 15-minute expiry minimizes damage if token is leaked.
- **HttpOnly Cookies**: Refresh tokens cannot be stolen via XSS.
- **Secure Flag**: Cookies are only sent over HTTPS.
- **SameSite=Strict**: Prevents CSRF attacks.
- **Token Rotation**: Refresh tokens are rotated on each use.

### Brute Force Protection
- **Rate Limiting**: 
  - `/auth/login`: 5 attempts per IP per 15 minutes.
  - `/auth/register`: 3 attempts per IP per hour.
- **Account Lockout**: After 10 failed login attempts, account is locked for 30 minutes (or requires email verification to unlock).
- **CAPTCHA**: Integrate reCAPTCHA v3 on login/register forms after 3 failed attempts.

### OAuth Security
- **State Parameter**: Always validate OAuth state parameter to prevent CSRF.
- **Email Verification**: Only accept OAuth accounts with verified emails.
- **Scope**: Request minimal scopes (e.g., `openid`, `email`, `profile`).

---

## 🔄 Session Management

### Concurrent Session Limits (DRM)

For document viewers, we enforce concurrent session limits (e.g., max 2 devices per buyer).

**Flow:**
1. Buyer opens document → `POST /v1/viewer/sessions`.
2. Backend checks active sessions for this user + document:
   - Count active sessions in `sessions` table (where `is_active = true`).
   - If count >= `protection_config.max_concurrent_sessions`, reject request with `403 CONCURRENT_SESSION_LIMIT`.
3. If under limit, create new session:
   - Insert into `sessions` table with `device_fingerprint`, `ip_address`, `user_agent`.
   - Return `session_id` to frontend.
4. Frontend sends heartbeat every 60 seconds → `POST /v1/viewer/sessions/:sessionId/heartbeat`.
5. Backend updates `last_activity` timestamp.
6. If no heartbeat for 5 minutes, mark session as inactive (`is_active = false`).

**Device Fingerprinting:**
- Generate fingerprint from: `user_agent` + `screen_resolution` + `timezone` + `language`.
- Hash with SHA-256, store first 16 chars in `sessions.device_fingerprint`.
- Used to detect suspicious activity (e.g., same account from different continents).

---

## 📋 Implementation Guidelines (for Freebuff)

### Backend (NestJS)

1. **Auth Module Structure:**
   ```text
   src/auth/
   ├── auth.controller.ts       # /auth/login, /auth/register, /auth/refresh
   ├── auth.service.ts          # Token generation, validation, password hashing
   ├── auth.module.ts
   ├── strategies/
   │   ├── jwt.strategy.ts      # Passport JWT strategy
   │   └── oauth.strategy.ts    # Passport Google/GitHub strategy
   ├── guards/
   │   ├── jwt-auth.guard.ts    # Protects routes requiring authentication
   │   └── roles.guard.ts       # Checks user role (admin, creator, viewer)
   └── dto/
       ├── login.dto.ts
       ├── register.dto.ts
       └── oauth-callback.dto.ts
   ```

2. **JWT Service:**
   ```typescript
   // auth.service.ts
   async generateTokens(user: User, workspaceId?: string) {
     const payload = {
       sub: user.id,
       email: user.email,
       role: user.role,
       workspace_id: workspaceId,
     };

     const accessToken = this.jwtService.sign(payload, {
       expiresIn: '15m',
       secret: process.env.JWT_SECRET,
     });

     const refreshToken = this.jwtService.sign(
       { sub: user.id, token_type: 'refresh' },
       { expiresIn: '7d', secret: process.env.JWT_REFRESH_SECRET }
     );

     // Store refresh token in Redis
     await this.redis.set(
       `refresh_token:${this.hashToken(refreshToken)}`,
       user.id,
       'EX',
       7 * 24 * 60 * 60 // 7 days
     );

     return { accessToken, refreshToken };
   }
   ```

3. **Password Hashing:**
   ```typescript
   async hashPassword(password: string): Promise<string> {
     const salt = await bcrypt.genSalt(12);
     return bcrypt.hash(password, salt);
   }

   async validatePassword(password: string, hash: string): Promise<boolean> {
     return bcrypt.compare(password, hash);
   }
   ```

### Frontend (Next.js)

1. **Auth Context:**
   ```typescript
   // lib/auth/AuthProvider.tsx
   const AuthContext = createContext<AuthContextType | null>(null);

   export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
     const [user, setUser] = useState<User | null>(null);
     const [accessToken, setAccessToken] = useState<string | null>(null);

     // Silent refresh on app load
     useEffect(() => {
       const refresh = async () => {
         try {
           const response = await fetch('/v1/auth/refresh', {
             method: 'POST',
             credentials: 'include', // Send refresh token cookie
           });
           if (response.ok) {
             const data = await response.json();
             setAccessToken(data.access_token);
             setUser(data.user);
           }
         } catch (error) {
           console.error('Refresh failed:', error);
         }
       };

       refresh();
     }, []);

     return (
       <AuthContext.Provider value={{ user, accessToken, setAccessToken }}>
         {children}
       </AuthContext.Provider>
     );
   };
   ```

2. **API Client with Auto-Refresh:**
   ```typescript
   // lib/api/client.ts
   const apiClient = async (endpoint: string, options: RequestInit = {}) => {
     const { accessToken, setAccessToken } = useAuth();

     const response = await fetch(`${API_URL}${endpoint}`, {
       ...options,
       headers: {
         ...options.headers,
         Authorization: `Bearer ${accessToken}`,
       },
     });

     if (response.status === 401) {
       // Try silent refresh
       const refreshResponse = await fetch('/v1/auth/refresh', {
         method: 'POST',
         credentials: 'include',
       });

       if (refreshResponse.ok) {
         const data = await refreshResponse.json();
         setAccessToken(data.access_token);

         // Retry original request
         return fetch(`${API_URL}${endpoint}`, {
           ...options,
           headers: {
             ...options.headers,
             Authorization: `Bearer ${data.access_token}`,
           },
         });
       } else {
         // Refresh failed, redirect to login
         window.location.href = '/login';
       }
     }

     return response;
   };
   ```

---

## 📌 Key Takeaways

1. **Access tokens are short-lived** (15 min) and stored in memory (not localStorage).
2. **Refresh tokens are long-lived** (7 days) and stored in HttpOnly cookies.
3. **Magic links are single-use** and expire after 15 minutes.
4. **Concurrent session limits** are enforced via `sessions` table and heartbeats.
5. **OAuth state parameter** must always be validated to prevent CSRF.
6. **Password hashing** uses bcrypt with cost factor 12.
7. **Token rotation** is mandatory for refresh tokens.

---

## 🧪 Testing Requirements

- **Unit Tests**: 
  - Password hashing and validation.
  - JWT token generation and validation.
  - Magic link token creation and validation.
- **Integration Tests**: 
  - Login flow (email/password, OAuth, magic link).
  - Token refresh flow.
  - Concurrent session limit enforcement.
- **Security Tests**: 
  - Brute force protection (rate limiting, account lockout).
  - XSS prevention (HttpOnly cookies, no localStorage for tokens).
  - CSRF prevention (SameSite=Strict, OAuth state validation).

See [Testing Strategy](../06_Quality_and_Standards/Testing_Strategy.md) for details.
```