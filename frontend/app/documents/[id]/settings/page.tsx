'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { documentsApi, type DocumentDetail, type ProtectionConfig } from '@/lib/api/client';
import DocumentSettingsForm from '@/components/documents/document-settings-form';
import DocumentStatusBadge from '@/components/dashboard/document-status-badge';
import { formatFileSize } from '@/lib/upload';
import type { DocStatus } from '@/lib/api/client';

interface DocumentSettingsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Document settings page — allows editing title, description, and DRM config.
 */
export default function DocumentSettingsPage({
  params,
}: DocumentSettingsPageProps) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Resolve params ─────────────────────────────────────────────────────────
  useEffect(() => {
    params.then(({ id: resolvedId }) => setId(resolvedId));
  }, [params]);

  // ── Fetch document ─────────────────────────────────────────────────────────
  const fetchDocument = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const data = await documentsApi.getDocument(id);
      setDoc(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load document',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // ── Save handler ───────────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (data: {
      title: string;
      description: string;
      protectionConfig: Partial<ProtectionConfig>;
    }) => {
      if (!id) return;
      setSaving(true);

      try {
        const updatePayload: Record<string, unknown> = {
          title: data.title,
        };

        if (data.description !== undefined) {
          updatePayload.description = data.description;
        }

        if (Object.keys(data.protectionConfig).length > 0) {
          updatePayload.protection_config = data.protectionConfig;
        }

        await documentsApi.updateDocument(id, updatePayload as never);

        // Re-fetch to get fresh data
        await fetchDocument();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to save settings. Please try again.',
        );
      } finally {
        setSaving(false);
      }
    },
    [id, fetchDocument],
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-6">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="space-y-4">
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-24 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  // ── Error / Not found state ────────────────────────────────────────────────
  if (error || !doc) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-6">
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
            {error || 'Document not found'}
          </p>
          <button
            onClick={fetchDocument}
            className="mt-3 text-sm font-medium text-red-600 underline underline-offset-2 hover:no-underline dark:text-red-400"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const pConfig = doc.protectionConfig as ProtectionConfig;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12 sm:px-6">
      {/* ── Back link ──────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Document Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage metadata and DRM protection settings.
        </p>
      </div>

      {/* ── Navigation tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b border-border pb-0">
        <span className="border-b-2 border-primary pb-2 text-sm font-medium text-foreground">
          Settings
        </span>
        <Link
          href={`/documents/${id}/analytics`}
          className="border-b-2 border-transparent pb-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Analytics
        </Link>
      </div>

      {/* ── Document info card ──────────────────────────────────────────── */}
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Status
          </span>
          <DocumentStatusBadge status={doc.status as DocStatus} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            File size
          </span>
          <span className="text-sm">{formatFileSize(doc.fileSize)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pages
          </span>
          <span className="text-sm">{doc.pageCount ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            File name
          </span>
          <span className="text-sm text-muted-foreground">{doc.fileName}</span>
        </div>
      </div>

      {/* ── Settings form ──────────────────────────────────────────────── */}
      <DocumentSettingsForm
        key={`${doc.id}-${doc.updatedAt}`}
        title={doc.title}
        description={doc.description}
        protectionConfig={pConfig}
        saving={saving}
        onSave={handleSave}
        onCancel={() => router.push('/dashboard')}
      />
    </div>
  );
}
