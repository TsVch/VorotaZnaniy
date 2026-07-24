'use client';

/**
 * Next.js global error page.
 *
 * Shown when an unhandled error occurs during server-side rendering,
 * static generation, or client-side rendering (outside of ErrorBoundary).
 *
 * Includes a "Try again" button that calls reset() to attempt re-render
 * without a full page reload.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="flex flex-col items-center gap-6 max-w-md text-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <svg
                className="h-8 w-8 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Critical Error
            </h1>
            <p className="text-sm text-muted-foreground">
              Something went wrong. Please try again or return to the dashboard.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-muted-foreground font-mono bg-muted p-3 rounded-md max-w-full overflow-auto">
                {error.message}
                {error.digest && <span className="block mt-1">Digest: {error.digest}</span>}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Try again
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
