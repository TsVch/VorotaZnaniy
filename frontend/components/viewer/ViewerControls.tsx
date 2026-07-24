'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ViewerControlsProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages in the document */
  totalPages: number;
  /** Called when user navigates to a different page */
  onPageChange: (page: number) => void;
  /** Current zoom level (1 = 100%, 1.5 = 150%) */
  zoomLevel: number;
  /** Called when user changes zoom level */
  onZoomChange: (zoom: number) => void;
  /** Whether text selection is allowed (from protectionConfig) */
  allowTextSelection: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────

const ZOOM_LEVELS = [
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
] as const;

// ── Component ─────────────────────────────────────────────────────────────

/**
 * ViewerControls — Navigation, zoom, and DRM status for the Secure Viewer.
 *
 * Provides:
 * - Previous / Next page buttons (disabled at document boundaries)
 * - Pre-set zoom levels (75% / 100% / 125% / 150%)
 * - DRM protection status indicator when text selection is blocked
 *
 * @example
 * ```tsx
 * <ViewerControls
 *   currentPage={1}
 *   totalPages={10}
 *   onPageChange={(p) => console.log(p)}
 *   zoomLevel={1}
 *   onZoomChange={(z) => console.log(z)}
 *   allowTextSelection={false}
 * />
 * ```
 */
export default function ViewerControls({
  currentPage,
  totalPages,
  onPageChange,
  zoomLevel,
  onZoomChange,
  allowTextSelection,
}: ViewerControlsProps) {
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      aria-label="Page navigation"
    >
      {/* ── Page Navigation ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isFirstPage}
          aria-label="Previous page"
        >
          <svg
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Previous
        </Button>

        <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
          Page{'\u00A0'}
          <span className="font-medium text-foreground">{currentPage}</span>
          {'\u00A0/\u00A0'}
          <span className="text-muted-foreground">{totalPages}</span>
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isLastPage}
          aria-label="Next page"
        >
          Next
          <svg
            className="h-4 w-4 ml-1"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </Button>
      </div>

      {/* ── Zoom Controls ────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Zoom level"
      >
        <span className="text-xs text-muted-foreground mr-1">Zoom</span>
        {ZOOM_LEVELS.map(({ label, value }) => (
          <Button
            key={value}
            variant={zoomLevel === value ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onZoomChange(value)}
            className="text-xs min-w-[48px]"
            aria-pressed={zoomLevel === value}
            aria-label={`Zoom ${label}`}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* ── DRM Status Indicator ─────────────────────────────────────── */}
      {!allowTextSelection && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          Protected
        </div>
      )}
    </nav>
  );
}
