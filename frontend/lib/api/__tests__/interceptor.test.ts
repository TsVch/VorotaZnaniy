import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock authApi.refresh ──────────────────────────────────────────────────

const mockRefresh = vi.fn();
vi.mock('@/lib/api/client', () => ({
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(() => null), // start without a token
  authApi: {
    refresh: (...args: unknown[]) => mockRefresh(...args),
  },
}));

// ── Mock auth.ts helpers ──────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  getRefreshToken: vi.fn(),
  clearAuthData: vi.fn(),
}));

import { getFreshToken, resetRefreshQueue } from '../interceptor';
import { getAuthToken } from '@/lib/api/client';
import { getRefreshToken, clearAuthData } from '@/lib/auth';

// ── Test helpers ───────────────────────────────────────────────────────────

/**
 * Encode a string as base64url (the format real JWT segments use:
 * '-'/'_' instead of '+'/'/', no '=' padding).
 */
function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a realistic base64url JWT (header.payload.signature) with `exp`. */
function makeJwt(exp: number): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ sub: 'user-1', exp }));
  return `${header}.${payload}.signature`;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('getFreshToken (interceptor)', () => {
  beforeEach(() => {
    vi.resetAllMocks(); // resets implementations AND call history
    resetRefreshQueue();

    // Restore default mock implementations after resetAllMocks
    (getAuthToken as Mock).mockReturnValue(null);
    (getRefreshToken as Mock).mockReturnValue(null);
  });

  // ── AC-2: Seamless refresh ──────────────────────────────────────────────

  it('AC-2: should call refresh and return new token', async () => {
    const NEW_TOKEN = 'new-access-token-456';
    (getRefreshToken as Mock).mockReturnValue('valid-refresh-token');
    mockRefresh.mockResolvedValue({ accessToken: NEW_TOKEN });

    const { setAuthToken } = await import('@/lib/api/client');
    const token = await getFreshToken();

    expect(token).toBe(NEW_TOKEN);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith('valid-refresh-token');
    expect(setAuthToken).toHaveBeenCalledWith(NEW_TOKEN);
  });

  it('AC-2: should return existing token directly (fast path)', async () => {
    const EXISTING_TOKEN = 'existing-token';
    (getAuthToken as Mock).mockReturnValue(EXISTING_TOKEN);

    const token = await getFreshToken();

    expect(token).toBe(EXISTING_TOKEN);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('AC-2: should skip expired in-memory token and refresh instead', async () => {
    const EXPIRED_TOKEN = makeJwt(Math.floor(Date.now() / 1000) - 60);
    const NEW_TOKEN = 'fresh-token-after-expiry';
    (getAuthToken as Mock).mockReturnValue(EXPIRED_TOKEN);
    (getRefreshToken as Mock).mockReturnValue('valid-refresh-token');
    mockRefresh.mockResolvedValue({ accessToken: NEW_TOKEN });

    const token = await getFreshToken();

    expect(token).toBe(NEW_TOKEN);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith('valid-refresh-token');
  });

  it('AC-2: should use fast path for a still-valid token', async () => {
    const VALID_TOKEN = makeJwt(Math.floor(Date.now() / 1000) + 3600);
    (getAuthToken as Mock).mockReturnValue(VALID_TOKEN);

    const token = await getFreshToken();

    expect(token).toBe(VALID_TOKEN);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // ── AC-3: Concurrent requests — single refresh call ─────────────────────

  it('AC-3: should call refresh only once for concurrent 401s', async () => {
    const NEW_TOKEN = 'concurrent-token';
    (getRefreshToken as Mock).mockReturnValue('valid-refresh-token');

    // Refresh resolves slowly so we can start multiple requests
    let resolveRefresh!: (value: { accessToken: string }) => void;
    mockRefresh.mockImplementation(
      () =>
        new Promise<{ accessToken: string }>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    // Start 3 concurrent refresh attempts
    const promise1 = getFreshToken();
    const promise2 = getFreshToken();
    const promise3 = getFreshToken();

    // All 3 should be waiting on the SAME promise
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Resolve the refresh
    resolveRefresh({ accessToken: NEW_TOKEN });

    const [token1, token2, token3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ]);

    expect(token1).toBe(NEW_TOKEN);
    expect(token2).toBe(NEW_TOKEN);
    expect(token3).toBe(NEW_TOKEN);
    // Still only 1 refresh call
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  // ── AC-4: Failed refresh → force logout ────────────────────────────────

  it('AC-4: should clear auth data on refresh failure', async () => {
    (getRefreshToken as Mock).mockReturnValue('expired-refresh-token');
    mockRefresh.mockRejectedValue(new Error('Refresh token expired'));

    // Reset getAuthToken to null so we don't hit the fast path
    (getAuthToken as Mock).mockReturnValue(null);

    // Mock window.location.href
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
    });

    await getFreshToken().catch(() => {
      // Expected to throw after forceLogout
    });

    expect(clearAuthData).toHaveBeenCalled();
  });

  it('AC-4: should throw when no refresh token exists', async () => {
    // Ensure fast path is NOT hit — getAuthToken must return null
    (getAuthToken as Mock).mockReturnValue(null);
    (getRefreshToken as Mock).mockReturnValue(null);

    await expect(getFreshToken()).rejects.toThrow(
      'No refresh token available',
    );
    expect(clearAuthData).toHaveBeenCalled();
  });

  // ── Queue reset ─────────────────────────────────────────────────────────

  it('should start a new refresh after queue is reset', async () => {
    (getRefreshToken as Mock).mockReturnValue('token-1');
    mockRefresh.mockResolvedValue({ accessToken: 'token-a' });

    await getFreshToken().catch(() => {});
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Reset queue and do another refresh
    resetRefreshQueue();
    (getRefreshToken as Mock).mockReturnValue('token-2');
    mockRefresh.mockResolvedValue({ accessToken: 'token-b' });

    await getFreshToken().catch(() => {});
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });
});
