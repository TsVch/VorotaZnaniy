'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import DocumentStatusBadge from './document-status-badge';
import type { DocumentListItem } from '@/lib/api/client';

export interface DocumentsTableProps {
  /** List of documents to display */
  documents: DocumentListItem[];
  /** Total number of documents (for pagination) */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Called when page changes */
  onPageChange: (page: number) => void;
  /** Whether data is currently loading */
  loading?: boolean;
}

/**
 * Formats a file size in bytes into a human-readable string.
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Formats an ISO date string into a locale-friendly format.
 */
function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
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
 * Table showing a paginated list of documents with status, metadata, and actions.
 */
export default function DocumentsTable({
  documents,
  total,
  page,
  limit,
  onPageChange,
  loading = false,
}: DocumentsTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="space-y-4">
      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full divide-y divide-border" role="table">
          <thead>
            <tr className="divide-x divide-border">
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Title
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Status
              </th>
              <th
                scope="col"
                className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell"
              >
                Size
              </th>
              <th
                scope="col"
                className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell"
              >
                Created
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              // ── Loading skeleton ────────────────────────────────────────
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-5 w-20 rounded-full bg-muted" />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="h-4 w-16 rounded bg-muted" />
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="h-4 w-28 rounded bg-muted" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="ml-auto h-8 w-20 rounded bg-muted" />
                  </td>
                </tr>
              ))
            ) : documents.length === 0 ? (
              // ── Empty state ─────────────────────────────────────────────
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No documents found.
                </td>
              </tr>
            ) : (
              // ── Data rows ───────────────────────────────────────────────
              documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  <td className="max-w-[200px] truncate px-4 py-3 text-sm font-medium">
                    <Link
                      href={`/documents/${doc.id}/settings`}
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatusBadge status={doc.status} />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-muted-foreground md:table-cell">
                    {formatDate(doc.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/documents/${doc.id}/settings`}
                      className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Settings
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {startItem}–{endItem} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
