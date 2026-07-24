import Link from 'next/link';
import type { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * Layout for the dashboard section with a top navigation bar.
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Top navigation bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-tight"
          >
            KnowledgeVault
          </Link>
          <nav className="flex items-center gap-4" aria-label="Dashboard">
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Documents
            </Link>
            <Link
              href="/workspace/settings"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Workspace Settings
            </Link>
            <Link
              href="/workspace/upgrade"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Upgrade
            </Link>
            <Link
              href="/workspace/subscription"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Subscription
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
