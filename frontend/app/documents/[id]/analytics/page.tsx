'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { documentsApi, type DocumentAnalytics } from '@/lib/api/client';
import DocumentAnalyticsView from '@/components/documents/document-analytics';

interface AnalyticsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Analytics page for a single document.
 * Shows aggregated metrics and recent activity.
 */
export default function DocumentAnalyticsPage({
  params,
}: AnalyticsPageProps) {
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<DocumentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Resolve params ─────────────────────────────────────────────────────────
  useEffect(() => {
    params.then(({ id: resolvedId }) => setId(resolvedId));
  }, [params]);

  // ── Fetch analytics ────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const result = await documentsApi.getAnalytics(id);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load analytics',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <DocumentAnalyticsView data={null} loading={true} />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          &larr; Back to Dashboard
        </Link>
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20"
        >
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
          <button
            onClick={fetchAnalytics}
            className="mt-3 text-sm font-medium text-red-600 underline underline-offset-2 hover:no-underline dark:text-red-400"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6">
      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View engagement metrics and recent activity for your document.
        </p>
      </div>

      {/* ── Analytics content ───────────────────────────────────────────── */}
      <DocumentAnalyticsView data={data} loading={false} />
    </div>
  );
}
