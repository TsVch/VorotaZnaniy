/**
 * API Interceptor — 401 handling with concurrent refresh guard.
 *
 * When multiple API requests receive 401 simultaneously, only ONE
 * refresh call is made. All others wait for that single promise to
 * resolve, then retry with the new token.
 *
 * On refresh failure: clears auth data and redirects to /auth/login.
 */

import { authApi } from '@/lib/api/client';
import { getAuthToken, setAuthToken } from '@/lib/api/client';
import { getRefreshToken, clearAuthData } from '@/lib/auth';

// ── Refresh Queue ──────────────────────────────────────────────────────────

/**
 * Holds the in-flight refresh promise. When non-null, all subsequent
 * 401 requests join this same promise instead of starting a new refresh.
 */
let refreshPromise: Promise<string> | null = null;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the current access token, attempting a refresh if needed.
 *
 * This is the main entry point for the interceptor. Call it from the
 * request() function when a 401 is received.
 *
 * @returns A fresh access token
 * @throws If refresh fails (auth data cleared, redirect to login)
 */
export async function getFreshToken(): Promise<string> {
  // ── Fast path: token still valid (not expired) ────────────────────────
  const currentToken = getAuthToken();
  if (currentToken && !isTokenExpired(currentToken)) {
    return currentToken;
  }

  // ── Refresh path ──────────────────────────────────────────────────────
  // Join the existing refresh promise or start a new one
  if (!refreshPromise) {
    refreshPromise = startRefresh();
  }

  try {
    const freshToken = await refreshPromise;
    return freshToken;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Reset the refresh queue (e.g., after explicit logout).
 */
export function resetRefreshQueue(): void {
  refreshPromise = null;
}

// ── Internal ───────────────────────────────────────────────────────────────

/**
 * Check whether a JWT access token is expired based on its `exp` claim.
 * Returns false for malformed tokens or tokens without `exp` so the fast
 * path keeps working; an expired token forces a real refresh instead.
 */
function isTokenExpired(token: string): boolean {
  try {
    // JWT segments are base64url (uses '-'/'_' instead of '+'/'/', no
    // padding). Normalize to standard base64 before atob() — otherwise
    // atob() throws for most real tokens and expiry checks silently fail.
    const b64 = (token.split('.')[1] ?? '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    return (
      typeof payload?.exp === 'number' && payload.exp * 1000 <= Date.now()
    );
  } catch {
    return false;
  }
}

async function startRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    forceLogout();
    throw new Error('No refresh token available');
  }

  try {
    const { accessToken } = await authApi.refresh(refreshToken);
    setAuthToken(accessToken);
    return accessToken;
  } catch (error) {
    forceLogout();
    throw error;
  }
}

/**
 * Force logout — clear all auth data and redirect to login.
 *
 * Uses window.location.href for a hard redirect that resets all
 * React/Next.js state.
 */
function forceLogout(): void {
  clearAuthData();
  resetRefreshQueue();

  // Only redirect if we're on the client and not already on auth page
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/auth/')
  ) {
    window.location.href = '/auth/login';
  }
}
