/**
 * KnowledgeVault API client — typed wrapper around fetch.
 *
 * All requests automatically include the JWT access token.
 * Integrates global error interceptors for 401, 403, 500 handling.
 * Presigned URLs are NEVER cached in localStorage — they are
 * requested fresh each time (DRM security requirement).
 */

import { mapErrorToAction, getFriendlyErrorMessage } from './interceptors';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

let authToken: string | null = null;

// Hydrate the access token from localStorage so API requests carry the
// Authorization header immediately after a page reload (fixes 401 on
// /documents right after login). Guarded for SSR / prerendering.
if (typeof window !== 'undefined') {
  try {
    authToken = localStorage.getItem('kv_access_token');
  } catch {
    authToken = null;
  }
}

/**
 * Sets the JWT access token for subsequent API requests.
 */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Returns the currently stored auth token.
 */
export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Clears all auth data (token, refresh token, user data, cookie)
 * and triggers redirect to login with a session-expired reason.
 * Called when session is fully expired (refresh fails).
 */
export function clearAuthAndRedirect(): void {
  setAuthToken(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kv_access_token');
    localStorage.removeItem('kv_refresh_token');
    localStorage.removeItem('kv_user');
    document.cookie = 'kv_auth=; path=/; max-age=0; SameSite=Lax';
    window.location.href = '/auth/login?reason=session_expired';
  }
}

/**
 * Generic request helper with JWT auth, global error handling,
 * auto-refresh, and interceptor integration.
 *
 * On 401: attempts a token refresh via the interceptor, then retries
 * the original request exactly once with the new token.
 * On 403/500: maps to appropriate actions via mapErrorToAction.
 */
async function request<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return executeWithRetry<T>(method, path, body);
}

/**
 * Execute a request with one automatic retry on 401.
 * Integrates global error interceptors.
 */
async function executeWithRetry<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  isRetry = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    const action = mapErrorToAction(response.status, errorBody);

    switch (action.type) {
      case 'REFRESH_TOKEN':
        // 401: Auto-refresh (only once)
        if (!isRetry) {
          try {
            const { getFreshToken } = await import('./interceptor');
            await getFreshToken();
            return executeWithRetry<T>(method, path, body, true);
          } catch {
            // Refresh failed — full logout
            clearAuthAndRedirect();
          }
        }
        // If retry already attempted, fall through to throw
        break;

      case 'REDIRECT':
        // 403 / 404: Navigate away. The throw below is a fallback in
        // case navigation is prevented (e.g. beforeunload).
        if (typeof window !== 'undefined') {
          window.location.href = action.to;
        }
        break;

      case 'TOAST':
        // 500 / 502 / 503: Throw with the friendly message so the UI
        // layer (component or ErrorBoundary) can show a toast.
        throw new ApiError(response.status, action.message);

      case 'LOGOUT':
        clearAuthAndRedirect();
        break;

      case 'IGNORE':
      default:
        // 4xx/5xx: Generic fallback with friendly message
        throw new ApiError(
          response.status,
          getFriendlyErrorMessage(response.status, errorBody),
        );
    }

    // ── Catch-all fallback ─────────────────────────────────────────────
    // If the action didn't throw or redirect (e.g. REDIRECT during SSR,
    // or REFRESH_TOKEN when isRetry was already true), produce a
    // meaningful ApiError instead of trying to JSON-parse the error body.
    throw new ApiError(
      response.status,
      getFriendlyErrorMessage(response.status, errorBody),
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Custom error class for API errors with HTTP status code.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/**
 * Response type for POST /v1/viewer/sessions
 */
export interface CreateSessionResponse {
  session_id: string;
  document: {
    id: string;
    title: string;
    page_count: number | null;
    protection_config: Record<string, unknown>;
  };
  watermark_data: {
    userEmail: string;
    sessionIdShort: string;
    timestamp: string;
  };
}

/**
 * Response type for GET /v1/viewer/sessions/:sessionId/pages/:pageNumber
 */
export interface PageUrlResponse {
  url: string;
  expires_in: number;
}

/**
 * Viewer API methods
 */
/**
 * Response type for POST /v1/documents/:id/qa
 */
export interface QaSourceItem {
  chunkIndex: number;
  text: string;
}

export interface QaResponse {
  answer: string;
  sources: QaSourceItem[];
}

// ── Auth response types ──────────────────────────────────────────────────

export interface AuthUserResponse {
  id: string;
  email: string;
  role: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}

export interface RefreshResponse {
  accessToken: string;
}

// ── Auth API methods ───────────────────────────────────────────────────────

export const authApi = {
  register(email: string, password: string): Promise<TokenResponse> {
    return request<TokenResponse>('POST', '/auth/register', { email, password });
  },

  login(email: string, password: string): Promise<TokenResponse> {
    return request<TokenResponse>('POST', '/auth/login', { email, password });
  },

  requestMagicLink(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('POST', '/auth/magic-link/request', { email });
  },

  verifyMagicLink(token: string): Promise<TokenResponse> {
    return request<TokenResponse>('POST', '/auth/magic-link/verify', { token });
  },

  refresh(refreshToken: string): Promise<RefreshResponse> {
    return fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    }).then(async (res) => {
      if (!res.ok) {
        throw new ApiError(res.status, await res.text().catch(() => 'Refresh failed'));
      }
      return res.json() as Promise<RefreshResponse>;
    });
  },
};

export const viewerApi = {
  createSession(documentId: string): Promise<CreateSessionResponse> {
    return request<CreateSessionResponse>('POST', '/viewer/sessions', { documentId });
  },

  heartbeat(
    sessionId: string,
  ): Promise<{ valid: boolean; nextHeartbeatIn?: number; reason?: string }> {
    return request('POST', `/viewer/sessions/${sessionId}/heartbeat`);
  },

  getPageUrl(
    sessionId: string,
    pageNumber: number,
  ): Promise<PageUrlResponse> {
    return request<PageUrlResponse>('GET', `/viewer/sessions/${sessionId}/pages/${pageNumber}`);
  },

  askQuestion(documentId: string, question: string): Promise<QaResponse> {
    return request<QaResponse>('POST', `/documents/${documentId}/qa`, { question });
  },
};

// ── Document types ─────────────────────────────────────────────────────────

export type DocStatus = 'PROCESSING' | 'READY' | 'ERROR';

export interface DocumentListItem {
  id: string;
  title: string;
  status: DocStatus;
  fileSize: number;
  pageCount: number | null;
  createdAt: string;
}

export interface DocumentListResponse {
  documents: DocumentListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface GetDocumentsParams {
  status?: DocStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ── Upload types ────────────────────────────────────────────────────────────

export interface ProtectionConfig {
  watermark_enabled: boolean;
  watermark_text?: string;
  max_concurrent_sessions: number;
  allow_text_selection: boolean;
  allow_download?: boolean;
}

export interface UploadInitRequest {
  title: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  protection_config: ProtectionConfig;
}

export interface UploadInitResponse {
  document_id: string;
  upload_url: string;
  expires_in: number;
}

export interface UploadCompleteResponse {
  document_id: string;
  status: string;
  message: string;
}

export interface DocumentDetail {
  id: string;
  title: string;
  description: string | null;
  status: DocStatus;
  fileSize: number;
  pageCount: number | null;
  fileType: string;
  fileName: string;
  protectionConfig: ProtectionConfig;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  description?: string;
  protection_config?: Partial<ProtectionConfig>;
}

export interface UpdateDocumentResponse {
  id: string;
  title: string;
  description: string | null;
  status: string;
  fileSize: number;
  protectionConfig: Record<string, unknown>;
  updatedAt: string;
}

// ── Analytics types ───────────────────────────────────────────────────────────

export interface RecentSessionItem {
  id: string;
  createdAt: string;
  isActive: boolean;
}

export interface DocumentAnalytics {
  totalViews: number;
  uniqueViewers: number;
  aiQueries: number;
  recentSessions: RecentSessionItem[];
}

// ── Document API methods ────────────────────────────────────────────────────

export const documentsApi = {
  getDocuments(params: GetDocumentsParams = {}): Promise<DocumentListResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return request<DocumentListResponse>('GET', `/documents${qs ? `?${qs}` : ''}`);
  },

  uploadInit(data: UploadInitRequest): Promise<UploadInitResponse> {
    return request<UploadInitResponse>('POST', '/documents/upload-init', data as unknown as Record<string, unknown>);
  },

  uploadComplete(documentId: string): Promise<UploadCompleteResponse> {
    return request<UploadCompleteResponse>('POST', `/documents/${documentId}/upload-complete`);
  },

  getDocument(documentId: string): Promise<DocumentDetail> {
    return request<DocumentDetail>('GET', `/documents/${documentId}`);
  },

  updateDocument(
    documentId: string,
    data: UpdateDocumentRequest,
  ): Promise<UpdateDocumentResponse> {
    return request<UpdateDocumentResponse>(
      'PATCH',
      `/documents/${documentId}`,
      data as unknown as Record<string, unknown>,
    );
  },

  getAnalytics(documentId: string): Promise<DocumentAnalytics> {
    return request<DocumentAnalytics>('GET', `/documents/${documentId}/analytics`);
  },
};

// ── Workspace types ──────────────────────────────────────────────────────────

export interface WorkspaceOwner {
  email: string;
  name: string | null;
}

export interface WorkspaceDetails {
  id: string;
  name: string;
  slug: string;
  owner: WorkspaceOwner;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Workspace API methods ─────────────────────────────────────────────────────

export const workspacesApi = {
  getMyWorkspace(): Promise<WorkspaceDetails> {
    return request<WorkspaceDetails>('GET', '/workspaces/me');
  },

  getDetails(workspaceId: string): Promise<WorkspaceDetails> {
    return request<WorkspaceDetails>('GET', `/workspaces/${workspaceId}`);
  },

  update(workspaceId: string, data: { name: string }): Promise<WorkspaceDetails> {
    return request<WorkspaceDetails>('PATCH', `/workspaces/${workspaceId}`, data as unknown as Record<string, unknown>);
  },
};

// ── Billing types ────────────────────────────────────────────────────────────

export interface BillingSubscriptionStatus {
  status: 'FREE' | 'ACTIVE' | 'CANCELLED' | 'PAST_DUE';
  plan: string;
  expiresAt?: string;
  activeProvider?: string;
  isActive: boolean;
  daysRemaining?: number;
  proPlanPrice: number;
  proPlanCurrency: string;
}

export interface CreatePaymentResponse {
  confirmationUrl: string;
  providerTransactionId: string;
}

// ── Billing API methods ───────────────────────────────────────────────────────

export const billingApi = {
  createPayment(data: {
    workspaceId: string;
    amount: number;
    description: string;
    returnUrl: string;
  }): Promise<CreatePaymentResponse> {
    return request<CreatePaymentResponse>('POST', '/billing/create-payment', data as unknown as Record<string, unknown>);
  },

  getSubscriptionStatus(workspaceId: string): Promise<BillingSubscriptionStatus> {
    return request<BillingSubscriptionStatus>('GET', `/billing/subscription/${workspaceId}`);
  },

  cancelSubscription(workspaceId: string): Promise<{ message: string }> {
    return request<{ message: string }>('POST', '/billing/cancel-subscription', { workspaceId } as Record<string, unknown>);
  },

  getSubscriptionHistory(
    workspaceId: string,
  ): Promise<{
    payments: Array<{
      providerTransactionId: string;
      eventType: string;
      amount: string;
      currency: string;
      isRecurring: boolean;
      processedAt: string;
    }>;
    total: number;
    subscriptionStatus: string;
    nextBillingDate?: string;
    paymentMethod?: { type: string; last4?: string };
  }> {
    return request('GET', `/billing/subscription-history/${workspaceId}`);
  },
};
