'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  documentsApi,
  type DocumentListItem,
  type DocStatus,
} from '@/lib/api/client';
import DocumentsFilters from '@/components/dashboard/documents-filters';
import DocumentsTable from '@/components/dashboard/documents-table';
import { Button } from '@/components/ui/button';

interface DashboardState {
  documents: DocumentListItem[];
  total: number;
  page: number;
  limit: number;
  search: string;
  statusFilter: DocStatus | 'ALL';
  loading: boolean;
  error: string | null;
}

/**
 * Dashboard page — lists the user's documents with search, filtering,
 * and pagination.
 */
export default function DashboardPage() {
  const router = useRouter();

  const [state, setState] = useState<DashboardState>({
    documents: [],
    total: 0,
    page: 1,
    limit: 10,
    search: '',
    statusFilter: 'ALL',
    loading: true,
    error: null,
  });

  // ── Fetch documents ──────────────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const params: Record<string, unknown> = {
        page: state.page,
        limit: state.limit,
      };
      if (state.search) params.search = state.search;
      if (state.statusFilter !== 'ALL') params.status = state.statusFilter;

      const response = await documentsApi.getDocuments({
        page: state.page,
        limit: state.limit,
        search: state.search || undefined,
        status: state.statusFilter !== 'ALL' ? state.statusFilter : undefined,
      });

      setState((prev) => ({
        ...prev,
        documents: response.documents,
        total: response.total,
        loading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          err instanceof Error ? err.message : 'Failed to load documents',
      }));
    }
  }, [state.page, state.limit, state.search, state.statusFilter]);

  // Fetch on mount and when filters/pagination change
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSearchChange = useCallback((search: string) => {
    setState((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const handleStatusFilterChange = useCallback(
    (statusFilter: DocStatus | 'ALL') => {
      setState((prev) => ({ ...prev, statusFilter, page: 1 }));
    },
    [],
  );

  const handlePageChange = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      search: '',
      statusFilter: 'ALL',
      page: 1,
    }));
  }, []);

  const hasActiveFilters =
    state.search !== '' || state.statusFilter !== 'ALL';

  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            My Documents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and monitor your uploaded documents.
          </p>
        </div>
        <Button
          variant="default"
          onClick={() => router.push('/upload')}
          aria-label="Upload new document"
        >
          Upload New Document
        </Button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <DocumentsFilters
        search={state.search}
        onSearchChange={handleSearchChange}
        statusFilter={state.statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* ── Error state ──────────────────────────────────────────────── */}
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          <p className="font-medium">Failed to load documents</p>
          <p className="mt-1">{state.error}</p>
          <button
            onClick={fetchDocuments}
            className="mt-2 text-sm font-medium underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────── */}
      {!state.error && (
        <DocumentsTable
          documents={state.documents}
          total={state.total}
          page={state.page}
          limit={state.limit}
          onPageChange={handlePageChange}
          loading={state.loading}
        />
      )}
    </div>
  );
}
