'use client';

import type { DocumentAnalytics } from '@/lib/api/client';

export interface DocumentAnalyticsProps {
  /** Analytics data from the backend */
  data: DocumentAnalytics | null;
  /** Whether data is currently loading */
  loading: boolean;
}

/**
 * Formats a date string into a locale-friendly short format.
 */
function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Displays document analytics: metric cards (views, AI queries, viewers)
 * and a list of recent viewing sessions.
 */
export default function DocumentAnalyticsView({
  data,
  loading,
}: DocumentAnalyticsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skel-${i}`} className="animate-pulse rounded-xl border border-border bg-card p-6">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-2 h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isEmpty = data.totalViews === 0 && data.aiQueries === 0;

  return (
    <div className="space-y-8">
      {/* ── Metric cards ──────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Views"
          value={data.totalViews}
          icon={
            <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          }
        />
        <MetricCard
          label="Unique Viewers"
          value={data.uniqueViewers}
          icon={
            <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          }
        />
        <MetricCard
          label="AI Queries"
          value={data.aiQueries}
          icon={
            <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
          }
        />
      </div>

      {/* ── Recent Activity ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Recent Activity</h2>

        {data.recentSessions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {isEmpty
              ? 'No analytics data yet. Data will appear once viewers start accessing your document.'
              : 'No recent sessions to display.'}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {data.recentSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block size-2 rounded-full ${
                      session.isActive
                        ? 'bg-emerald-500'
                        : 'bg-muted-foreground/30'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">
                    {session.isActive ? 'Active session' : 'Session ended'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(session.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Metric card sub-component ──────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
