'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePagePreloader } from './hooks/usePagePreloader';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import WatermarkOverlay, {
  type WatermarkOverlayProps,
} from './WatermarkOverlay';
import ViewerControls from './ViewerControls';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CanvasRendererProps {
  /** Active viewing session UUID */
  sessionId: string;
  /** Document UUID (for page count etc.) */
  documentId: string;
  /** Page to start on (defaults to 1) */
  initialPage?: number;
  /** Total number of pages in the document */
  totalPages?: number;
  /** Whether text selection is allowed (from protectionConfig) */
  allowTextSelection?: boolean;
  /** Watermark data returned from session creation (TASK-003.1) */
  watermarkData?: WatermarkOverlayProps;
  /** Callback fired when the user navigates to a different page */
  onPageChange?: (page: number) => void;
}

// ── Hotkeys to block (DRM requirement) ───────────────────────────────────
const BLOCKED_HOTKEYS: Record<string, string> = {
  s: 'Save (Ctrl+S)',
  p: 'Print (Ctrl+P)',
  u: 'View Source (Ctrl+U)',
};

/**
 * CanvasRenderer — Core DRM-protected document viewer component.
 *
 * Renders document pages on an HTML5 <canvas> element using short-lived
 * presigned URLs. Implements multiple DRM protections:
 *  - No <img>, <iframe>, or <object> tags — only <canvas>
 *  - Context menu disabled (prevents "Save image as")
 *  - Hotkeys disabled (Ctrl+S, Ctrl+P, Ctrl+U)
 *  - Drag-and-drop disabled
 *  - Text selection disabled (user-select: none in CSS)
 *  - Presigned URLs never stored in localStorage
 *
 * @example
 * ```tsx
 * <CanvasRenderer sessionId="..." documentId="..." initialPage={1} />
 * ```
 */
export default function CanvasRenderer({
  sessionId,
  documentId: _documentId,
  initialPage = 1,
  totalPages = 1,
  allowTextSelection = false,
  watermarkData,
  onPageChange,
}: CanvasRendererProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [zoomLevel, setZoomLevel] = useState(1);

  // ── Refs ───────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Hooks ──────────────────────────────────────────────────────────────
  const preloadedPages = usePagePreloader(sessionId, currentPage);
  const currentPreload = preloadedPages[currentPage];

  const { canvasState, errorMessage, retry } = useCanvasRenderer(
    canvasRef,
    currentPreload?.image ?? null,
    currentPage,
  );

  // ── Navigation ─────────────────────────────────────────────────────────
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      onPageChange?.(page);
    },
    [onPageChange],
  );

  // ── DRM: Block context menu (prevents "Save image as") ─────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ── DRM: Block hotkeys (Ctrl+S, Ctrl+P, Ctrl+U) ────────────────────────
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

  // ── Focus canvas on mount for keyboard events ───────────────────────────
  useEffect(() => {
    canvasRef.current?.focus();
  }, []);

  // ── Autofocus canvas on page change ────────────────────────────────────
  useEffect(() => {
    canvasRef.current?.focus();
  }, [currentPage]);

  // ── Determine error UI state ────────────────────────────────────────────
  const isSessionError =
    currentPreload?.error !== null &&
    /session|forbidden|unauthorized|expired/i.test(
      currentPreload?.error ?? '',
    );

  const showError = canvasState === 'error' || currentPreload?.error !== null;
  const showLoading =
    (canvasState === 'loading' || currentPreload?.isLoading) &&
    !showError;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex flex-col w-full h-full bg-black/5 dark:bg-white/5',
        allowTextSelection ? 'select-text' : 'select-none',
      )}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="application"
      aria-label="Document viewer"
    >
      {/* ── Canvas Container ──────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex items-center justify-center w-full h-full"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          <canvas
            ref={canvasRef}
            className="block w-full h-full outline-none cursor-default"
            onContextMenu={handleContextMenu}
            draggable={false}
            tabIndex={0}
            role="img"
            aria-label={`Page ${currentPage}`}
          />

          {/* ── DRM Watermark Overlay ────────────────────────────────── */}
          {watermarkData && (
            <WatermarkOverlay
              userEmail={watermarkData.userEmail}
              sessionIdShort={watermarkData.sessionIdShort}
              timestamp={watermarkData.timestamp}
            />
          )}
        </div>

        {/* ── Loading Overlay ─────────────────────────────────────────── */}
        {showLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-200">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Loading page {currentPage}...
              </p>
            </div>
          </div>
        )}

        {/* ── Error Overlay ───────────────────────────────────────────── */}
        {showError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm transition-opacity duration-200">
            <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
              {isSessionError ? (
                <>
                  <div className="rounded-full bg-destructive/10 p-3">
                    <svg
                      className="h-6 w-6 text-destructive"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground">
                    Session Expired
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your viewing session has expired. Please refresh the page
                    to continue reading.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    Refresh Page
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-destructive/10 p-3">
                    <svg
                      className="h-6 w-6 text-destructive"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground">
                    Failed to Load Page
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {errorMessage ||
                      currentPreload?.error ||
                      'An unexpected error occurred while loading this page.'}
                  </p>
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Viewer Controls (Navigation, Zoom, DRM) ───────────────────── */}
      <ViewerControls
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        allowTextSelection={allowTextSelection}
      />
    </div>
  );
}
