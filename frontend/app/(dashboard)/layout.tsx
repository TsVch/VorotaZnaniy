'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ToastProvider } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { clearAuthData } from '@/lib/auth';
import { resetRefreshQueue } from '@/lib/api/interceptor';
import { cn } from '@/lib/utils';

/**
 * Dashboard layout — provides the navigation sidebar and wraps content in
 * global ErrorBoundary and ToastProvider for consistent error handling.
 *
 * ErrorBoundary catches render errors in the dashboard area.
 * ToastProvider allows any child component to show toast notifications.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    resetRefreshQueue();
    clearAuthData();
    router.push('/auth/login');
  };

  // Hide sidebar for viewer page
  const isViewer = pathname?.startsWith('/viewer');

  if (isViewer) {
    return (
      <ToastProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </ToastProvider>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastProvider>
        {/* Top navigation bar */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-semibold text-lg"
            >
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                />
              </svg>
              KnowledgeVault
            </Link>

            <nav className="flex items-center gap-1" aria-label="Dashboard navigation">
              <NavLink href="/dashboard" isActive={pathname === '/dashboard'}>
                Documents
              </NavLink>
              <NavLink
                href="/workspace/settings"
                isActive={pathname.startsWith('/workspace/settings')}
              >
                Settings
              </NavLink>
              <NavLink
                href="/workspace/upgrade"
                isActive={pathname.startsWith('/workspace/upgrade') || pathname.startsWith('/workspace/subscription')}
              >
                Subscription
              </NavLink>

              <span
                className="mx-1 h-5 w-px bg-border"
                aria-hidden="true"
              />

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Sign out"
              >
                Sign Out
              </button>
            </nav>
          </div>
        </header>

        {/* Main content area with ErrorBoundary */}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </ToastProvider>
    </div>
  );
}

// ── Navigation link component ──────────────────────────────────────────────

function NavLink({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}
