'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAuthData } from '@/lib/auth';

/**
 * OAuth Callback Page.
 *
 * Receives tokens via URL hash `#accessToken=...&refreshToken=...`
 * after successful OAuth login (Google / GitHub).
 *
 * Parses the hash, saves auth data, and redirects to /dashboard.
 * If tokens are missing or malformed, redirects to /auth/login.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Parse URL hash — e.g. #accessToken=xxx&refreshToken=yyy
    const hash = window.location.hash.slice(1); // remove leading '#'
    const params = new URLSearchParams(hash);

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      setError('Invalid OAuth response — missing tokens');
      // Redirect to login after a short delay
      setTimeout(() => {
        router.replace('/auth/login');
      }, 2000);
      return;
    }

    // Save tokens (user data will be fetched on dashboard load)
    // We don't have user info from the hash, so we set a minimal stub.
    // The dashboard / protected components will fetch the actual user profile.
    saveAuthData(accessToken, refreshToken, {
      id: '',
      email: '',
      role: 'VIEWER',
    });

    // Redirect to dashboard
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive mb-4">
              {error}
            </div>
            <p className="text-sm text-muted-foreground">
              Redirecting to login...
            </p>
          </>
        ) : (
          <>
            <div className="mb-4 flex justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <p className="text-sm text-muted-foreground">
              Completing sign in...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
