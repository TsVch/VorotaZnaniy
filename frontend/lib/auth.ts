/**
 * Frontend authentication helpers — token storage and retrieval.
 *
 * Access token: persisted to localStorage (`kv_access_token`) and held in
 * memory (via setAuthToken in client.ts) for immediate use after login.
 * Refresh token: stored in localStorage for persistence across reloads.
 *
 * For MVP, both tokens live in localStorage so a page reload does not lose
 * the session (client.ts hydrates the in-memory token at module load).
 *
 * A lightweight auth cookie is also set (document.cookie) so that the
 * Next.js Middleware can determine auth status at the Edge without
 * accessing localStorage.
 */

import { setAuthToken } from '@/lib/api/client';

const ACCESS_TOKEN_KEY = 'kv_access_token';
const REFRESH_TOKEN_KEY = 'kv_refresh_token';
const USER_DATA_KEY = 'kv_user';
const AUTH_COOKIE_NAME = 'kv_auth';

// ── User data ─────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  email: string;
  role: string;
}

// ── Cookie helpers (for middleware) ────────────────────────────────────────

function setAuthCookie(value: string): void {
  if (typeof document === 'undefined') return;
  // Non-httpOnly so the middleware can read it; max-age 7 days to match
  // the refresh token expiry.
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=604800; SameSite=Lax`;
}

function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

// ── Token helpers ─────────────────────────────────────────────────────────

/**
 * Save authentication data after successful login or registration.
 */
export function saveAuthData(
  accessToken: string,
  refreshToken: string,
  user: StoredUser,
): void {
  setAuthToken(accessToken);
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  setAuthCookie('1'); // middleware checks for cookie presence (value is irrelevant)
}

/**
 * Clear all stored authentication data (logout).
 */
export function clearAuthData(): void {
  setAuthToken(null);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  clearAuthCookie();
}

/**
 * Get the stored refresh token.
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Get the stored user data.
 */
export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

/**
 * Check if the user is authenticated (has a refresh token).
 */
export function isAuthenticated(): boolean {
  return getRefreshToken() !== null;
}
