'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api/client';
import { saveAuthData } from '@/lib/auth';

export default function VerifyMagicLinkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('Missing verification token.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await authApi.verifyMagicLink(token);

        if (cancelled) return;

        saveAuthData(
          result.accessToken,
          result.refreshToken,
          result.user,
        );

        router.replace('/dashboard');
      } catch (err) {
        if (cancelled) return;

        if (err instanceof Error) {
          setError(err.message || 'This link is invalid or has expired.');
        } else {
          setError('This link is invalid or has expired.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        {error ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <svg
                className="h-6 w-6 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold">Link invalid</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <a
              href="/auth/magic-link"
              className="inline-flex items-center justify-center rounded-lg h-10 px-4 py-2 text-sm font-medium border border-input hover:bg-accent transition-colors"
            >
              Request a new link
            </a>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <p className="text-sm text-muted-foreground">
              Verifying your link...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
