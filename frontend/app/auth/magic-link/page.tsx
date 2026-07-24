'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { authApi } from '@/lib/api/client';

export default function MagicLinkPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!email.trim()) {
        setError('Please enter your email address');
        return;
      }

      setIsLoading(true);
      try {
        await authApi.requestMagicLink(email.trim());
        setIsSent(true);
      } catch {
        // Always show the same message (anti-enumeration)
        setIsSent(true);
      } finally {
        setIsLoading(false);
      }
    },
    [email],
  );

  if (isSent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            If an account with this email exists, we&apos;ve sent a magic link.
            Please check your inbox (and spam folder).
            <br />
            The link expires in 15 minutes.
          </p>
          <button
            onClick={() => {
              setIsSent(false);
              setEmail('');
            }}
            className={cn(
              'inline-flex items-center justify-center rounded-lg h-10 px-4 py-2',
              'text-sm font-medium',
              'border border-input hover:bg-accent transition-colors',
            )}
          >
            Send another link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Sign in with Magic Link</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email address and we&apos;ll send you a login link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="magic-link-email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="magic-link-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              className={cn(
                'flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:border-input',
                'disabled:opacity-50',
              )}
              disabled={isLoading}
              aria-label="Email address"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              'inline-flex w-full items-center justify-center rounded-lg h-10 px-4 py-2',
              'text-sm font-medium text-primary-foreground',
              'bg-primary hover:bg-primary/90 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Sending...
              </span>
            ) : (
              'Send Magic Link'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <a
            href="/auth/login"
            className="font-medium text-primary hover:underline"
          >
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
