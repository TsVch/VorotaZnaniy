/**
 * Next.js Middleware — Auth route protection.
 *
 * Guards private routes (/dashboard, /viewer) and redirects
 * unauthenticated users to /auth/login.
 *
 * Redirects authenticated users away from /auth pages.
 *
 * Reads the `kv_auth` cookie set by auth.ts saveAuthData().
 * Middleware runs on the Edge — no localStorage or fetch available.
 */

import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'kv_auth';

// ── Route classification ───────────────────────────────────────────────────

function isPrivateRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/viewer') ||
    pathname.startsWith('/documents')
  );
}

function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith('/auth/');
}

// ── Middleware ─────────────────────────────────────────────────────────────

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.has(AUTH_COOKIE_NAME);

  // ── Private routes: redirect to login if not authenticated ────────────
  if (isPrivateRoute(pathname) && !isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Auth routes (login/register): redirect to dashboard if already authenticated ──
  if (isAuthRoute(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// ── Matcher ────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    // Private routes
    '/dashboard/:path*',
    '/viewer/:path*',
    '/documents/:path*',
    // Auth routes (redirect logged-in users away)
    '/auth/:path*',
  ],
};
