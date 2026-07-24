'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { usePagePreloader } from './hooks/usePagePreloader';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import WatermarkOverlay, {
  type WatermarkOverlayProps,
} from './WatermarkOverlay';
import ViewerControls from './ViewerControls';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CanvasViewerProps {
  /** Active viewing session UUID */
  sessionId: string;
  /** Document UUID */
  documentId: string;
  /** Current page number (controlled from parent) */
  currentPage: number;
  /** Total number of pages in the document */
  totalPages?: number;
  /** Current zoom level (controlled from parent) */
  zoomLevel: number;
  /** Whether text selection is allowed (from protectionConfig) */
  allowTextSelection?: boolean;
  /** Watermark data returned from session creation */
  watermarkData?: WatermarkOverlayProps;
  /** Called when the user navigates to a different page */
  onPageChange: (page: number) => void;
  /** Called when the user changes zoom level */
  onZoomChange: (zoom: number) => void;
  /** Called when a 403 SESSION_TERMINATED error is detected */
  onSessionTerminated?: () => void;
}

const INTERSECTION_THRESHOLD = 0.1;

/**
 * CanvasViewer — Enhanced document viewer with progressive tile loading.
 *
 * Fully controlled component: the parent owns currentPage and zoomLevel state.
 * Features skeleton loaders for tiles, pre-fetching, and DRM protections.
 */
export default function CanvasViewer({
  sessionId,
  documentId: _documentId,
  currentPage,
  totalPages = 1,
  zoomLevel,
  allowTextSelection = false,
  watermarkData,
  onPageChange,
  onZoomChange,
  onSessionTerminated,
}: CanvasViewerProps) {
  // ── Refs ───────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // ── Hooks ──────────────────────────────────────────────────────────────
  const preloadedPages = usePagePreloader(sessionId, currentPage);
  const currentPreload = preloadedPages[currentPage];

  const { canvasState, errorMessage, retry } = useCanvasRenderer(
    canvasRef,
    currentPreload?.image ?? null,
    currentPage,
  );

  // ── Detect SESSION_TERMINATED errors ──────────────────────────────────
  useEffect(() => {
    const isTerminated =
      currentPreload?.error !== null &&
      /session|forbidden|unauthorized|terminated|403/i.test(
        currentPreload?.error ?? '',
      );

    if (isTerminated && onSessionTerminated) {
      onSessionTerminated();
    }
  }, [currentPreload?.error, onSessionTerminated]);

  // ── IntersectionObserver for progressive loading ───────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const nextPage = currentPage + 1;
            if (nextPage <= totalPages) {
              onPageChange(nextPage);
            }
          }
        }
      },
      {
        root: containerRef.current,
        threshold: INTERSECTION_THRESHOLD,
      },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [currentPage, totalPages, onPageChange]);

  // ── Clamped page change ────────────────────────────────────────────────
  const handlePageChange = useCallback(
    (page: number) => {
      const clampedPage = Math.max(1, Math.min(page, totalPages));
      onPageChange(clampedPage);
    },
    [totalPages, onPageChange],
  );

  // ── DRM: Block context menu ────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ── DRM: Block hotkeys ─────────────────────────────────────────────────
  const BLOCKED_HOTKEYS: Record<string, string> = {
    s: 'Save (Ctrl+S)',
    p: 'Print (Ctrl+P)',
    u: 'View Source (Ctrl+U)',
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        Object.keys(BLOCKED_HOTKEYS).includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [],
  );

  // ── Focus canvas on mount/page change ──────────────────────────────────
  useEffect(() => {
    canvasRef.current?.focus();
  }, [currentPage]);

  // ── Determine UI state ─────────────────────────────────────────────────
  const isSessionError =
    currentPreload?.error !== null &&
    /session|forbidden|unauthorized|expired|terminated/i.test(
      currentPreload?.error ?? '',
    );

  const showError = canvasState === 'error' || currentPreload?.error !== null;
  const showLoading =
    (canvasState === 'loading' || currentPreload?.isLoading) && !showError;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col w-full h-full overflow-hidden',
        allowTextSelection ? 'select-text' : 'select-none',
      )}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="application"
      aria-label="Document viewer"
    >
      {/* ── Canvas Container ──────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-auto" ref={pageContainerRef}>
        <div className="flex flex-col items-center min-h-full">
          {/* Current page — canvas with zoom transform */}
          <div className="relative flex-shrink-0 w-full max-w-4xl" style={{ minHeight: '70vh' }}>
            {showLoading ? (
              /* Skeleton loader for tiles not yet loaded */
              <div className="w-full h-[70vh] flex flex-col gap-2 p-4">
                <Skeleton className="w-full h-4/5 rounded-md" />
                <div className="flex gap-2">
                  <Skeleton className="h-3 w-3/4 rounded" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ) : (
              <div
                className="flex items-center justify-center w-full h-full transition-transform duration-200"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center top',
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="block max-w-full max-h-[85vh] outline-none cursor-default"
                  onContextMenu={handleContextMenu}
                  draggable={false}
                  tabIndex={0}
                  role="img"
                  aria-label={`Page ${currentPage}`}
                />
              </div>
            )}
          </div>

          {/* Sentinel for IntersectionObserver + loading indicator */}
          <div
            ref={sentinelRef}
            className="w-full py-6 flex items-center justify-center"
            data-testid="loading-sentinel"
          >
            {showLoading && (
              <div className="flex flex-col items-center gap-3 w-full max-w-sm px-4">
                <Skeleton className="w-full h-32 rounded-md" />
                <Skeleton className="w-3/4 h-3 rounded" />
              </div>
            )}
            {!showLoading && !showError && (
              <div className="w-full max-w-sm px-4">
                <Skeleton className="w-full h-32 rounded-md opacity-30" />
              </div>
            )}
          </div>
        </div>

        {/* ── Watermark Overlay ────────────────────────────────────────── */}
        {watermarkData && (
          <WatermarkOverlay
            userEmail={watermarkData.userEmail}
            sessionIdShort={watermarkData.sessionIdShort}
            timestamp={watermarkData.timestamp}
          />
        )}

        {/* ── Error Overlay ───────────────────────────────────────────── */}
        {showError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
              {isSessionError ? (
                <>
                  <h3 className="font-semibold text-foreground">
                    Session Expired
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your viewing session has expired or was terminated from another device.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Refresh Page
                  </button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-foreground">
                    Failed to Load Page
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {errorMessage || currentPreload?.error || 'An unexpected error occurred.'}
                  </p>
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Viewer Controls ────────────────────────────────────────────── */}
      <ViewerControls
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        zoomLevel={zoomLevel}
        onZoomChange={onZoomChange}
        allowTextSelection={allowTextSelection}
      />
    </div>
  );
}
