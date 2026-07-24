/**
 * Global API error interceptors.
 *
 * Handles common HTTP error codes by mapping them to user-friendly actions:
 * - 401 Unauthorized → attempt token refresh, redirect to /login on failure
 * - 403 Forbidden → redirect to /dashboard
 * - 404 Not Found → redirect to /dashboard
 * - 500 / 502 / 503 → show toast notification
 *
 * Must be initialized after app mount (requires Router and Toast context).
 * Uses lazy imports to avoid circular dependencies.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type ErrorAction =
  | { type: 'REFRESH_TOKEN' }
  | { type: 'LOGOUT' }
  | { type: 'REDIRECT'; to: string }
  | { type: 'TOAST'; message: string; variant: 'warning' | 'destructive' }
  | { type: 'IGNORE' };

// ── Error-to-action mapping ────────────────────────────────────────────────

/**
 * Maps an HTTP status code and optional error body to a user-facing action.
 * These actions are interpreted by the caller (e.g., page.tsx or API client).
 */
export function mapErrorToAction(
  status: number,
  _body?: string,
): ErrorAction {
  switch (status) {
    case 401:
      return { type: 'REFRESH_TOKEN' };
    case 403:
      return { type: 'REDIRECT', to: '/dashboard' };
    case 404:
      return { type: 'REDIRECT', to: '/dashboard' };
    case 429:
      return {
        type: 'TOAST',
        message: 'Too many requests. Please wait before trying again.',
        variant: 'warning',
      };
    case 500:
    case 502:
    case 503:
      return {
        type: 'TOAST',
        message: 'Server error. Please try again later.',
        variant: 'destructive',
      };
    default:
      return { type: 'IGNORE' };
  }
}

/**
 * Get a user-friendly error message for a given status code.
 * Used when showing error details to the user (in toasts, error pages).
 */
export function getFriendlyErrorMessage(status: number, body?: string): string {
  if (body && body.length < 200) {
    // Use server-provided message if it's short enough
    return body;
  }

  const messages: Record<number, string> = {
    400: 'Invalid request. Please check your input.',
    401: 'Session expired. Please log in again.',
    403: 'Access denied. You do not have permission for this action.',
    404: 'Resource not found.',
    409: 'Conflict. The resource may already exist.',
    429: 'Too many requests. Please wait before trying again.',
    500: 'Server error. Please try again later.',
    502: 'Server temporarily unavailable. Please try again later.',
    503: 'Service temporarily unavailable. Please try again later.',
  };

  return messages[status] || `An unexpected error occurred (${status}).`;
}
