'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DocStatus } from '@/lib/api/client';

export interface DocumentsFiltersProps {
  /** Current search query */
  search: string;
  /** Called when search text changes (debounced) */
  onSearchChange: (value: string) => void;
  /** Current status filter */
  statusFilter: DocStatus | 'ALL';
  /** Called when status filter changes */
  onStatusFilterChange: (value: DocStatus | 'ALL') => void;
  /** Whether there are active filters to clear */
  hasActiveFilters: boolean;
  /** Called to clear all filters */
  onClearFilters: () => void;
}

const STATUS_OPTIONS: { value: DocStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'READY', label: 'Ready' },
  { value: 'ERROR', label: 'Error' },
];

/**
 * Filters bar with debounced search input and status dropdown.
 */
export default function DocumentsFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  hasActiveFilters,
  onClearFilters,
}: DocumentsFiltersProps) {
  // Local input value for instant feedback; parent gets debounced value
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external search changes (e.g., on clear) back to local state
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSearch(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 300);
    },
    [onSearchChange],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {/* ── Search input ───────────────────────────────────────────── */}
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="search"
            value={localSearch}
            onChange={handleSearchInput}
            placeholder="Search documents..."
            aria-label="Search documents by title"
            className="block w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>

        {/* ── Status filter ──────────────────────────────────────────── */}
        <select
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(e.target.value as DocStatus | 'ALL')
          }
          aria-label="Filter by document status"
          className="block rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Clear filters ───────────────────────────────────────────── */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          aria-label="Clear all filters"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
