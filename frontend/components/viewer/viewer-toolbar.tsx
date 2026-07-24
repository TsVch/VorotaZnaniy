'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface ViewerToolbarProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  isAiSidebarOpen: boolean;
  onAiSidebarToggle: () => void;
  documentTitle?: string;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/**
 * ViewerToolbar — Desktop top bar + Mobile bottom bar.
 *
 * **Desktop (>= 768px):** sticky top bar with full controls (Exit, page nav,
 * zoom, AI toggle, fullscreen). Document title shown on larger screens.
 *
 * **Mobile (< 768px):** sticky bottom bar with compact controls — only icons,
 * page number shown, zoom grouped into a toggleable popover.
 * No horizontal scroll. Touch-friendly tap targets (min 44px).
 */
export default function ViewerToolbar({
  currentPage,
  totalPages,
  onPageChange,
  zoomLevel,
  onZoomChange,
  isAiSidebarOpen,
  onAiSidebarToggle,
  documentTitle,
}: ViewerToolbarProps) {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  // ── Zoom helpers ───────────────────────────────────────────────────────
  const zoomIn = useCallback(() => {
    const next = ZOOM_STEPS.find((z) => z > zoomLevel);
    if (next) onZoomChange(next);
  }, [zoomLevel, onZoomChange]);

  const zoomOut = useCallback(() => {
    const prev = [...ZOOM_STEPS].reverse().find((z) => z < zoomLevel);
    if (prev) onZoomChange(prev);
  }, [zoomLevel, onZoomChange]);

  const fitWidth = useCallback(() => {
    onZoomChange(1);
  }, [onZoomChange]);

  const zoomPercent = Math.round(zoomLevel * 100);

  // Close zoom menu on mobile when zoom changes
  useEffect(() => {
    if (isMobile) setZoomMenuOpen(false);
  }, [zoomLevel, isMobile]);

  // ── Keyboard shortcuts (desktop only — avoid mobile keyboard conflicts) ─
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (!isFirstPage) onPageChange(currentPage - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!isLastPage) onPageChange(currentPage + 1);
          break;
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            fitWidth();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentPage,
    isFirstPage,
    isLastPage,
    onPageChange,
    zoomIn,
    zoomOut,
    fitWidth,
    isMobile,
  ]);

  // ── Fullscreen toggle ─────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // ── Mobile bottom toolbar ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <nav
        className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        role="toolbar"
        aria-label="Viewer controls"
      >
        <div className="flex items-center justify-around px-2 py-1.5">
          {/* Exit */}
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center gap-0.5 min-w-[44px] py-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Exit viewer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="text-[10px]">Exit</span>
          </button>

          {/* Prev page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={isFirstPage}
            className="flex flex-col items-center gap-0.5 min-w-[44px] py-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            aria-label="Previous page"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Page indicator */}
          <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap min-w-[60px] text-center">
            <span className="font-medium text-foreground">{currentPage}</span>
            <span className="mx-0.5">/</span>
            <span>{totalPages}</span>
          </span>

          {/* Next page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={isLastPage}
            className="flex flex-col items-center gap-0.5 min-w-[44px] py-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            aria-label="Next page"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Zoom button (opens inline popover) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setZoomMenuOpen(!zoomMenuOpen)}
              className="flex flex-col items-center gap-0.5 min-w-[44px] py-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`Zoom ${zoomPercent}%. Tap to change`}
              aria-expanded={zoomMenuOpen}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
              </svg>
              <span className="text-[10px]">{zoomPercent}%</span>
            </button>

            {/* Zoom popover */}
            {zoomMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setZoomMenuOpen(false)} />
                <div className="absolute bottom-full right-0 mb-2 z-50 flex items-center gap-1 rounded-lg border bg-background p-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={zoomLevel <= ZOOM_STEPS[0]}
                    className="rounded-md p-2 hover:bg-muted transition-colors disabled:opacity-30"
                    aria-label="Zoom out"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={fitWidth}
                    className="rounded-md px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                    aria-label="Reset zoom to 100%"
                  >
                    {zoomPercent}%
                  </button>
                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={zoomLevel >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                    className="rounded-md p-2 hover:bg-muted transition-colors disabled:opacity-30"
                    aria-label="Zoom in"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* AI toggle */}
          <button
            type="button"
            onClick={onAiSidebarToggle}
            className={`flex flex-col items-center gap-0.5 min-w-[44px] py-1 transition-colors ${
              isAiSidebarOpen
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label={isAiSidebarOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="text-[10px]">AI</span>
          </button>
        </div>
      </nav>
    );
  }

  // ── Desktop top toolbar ──────────────────────────────────────────────────
  return (
    <header
      className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="toolbar"
      aria-label="Viewer toolbar"
    >
      <div className="flex items-center justify-between px-3 py-1.5 gap-2">
        {/* ── Left: Document title + Exit ─────────────────────────────── */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            aria-label="Exit viewer"
            className="flex-shrink-0"
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
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            <span className="hidden sm:inline">Exit</span>
          </Button>

          {documentTitle && (
            <span className="text-sm font-medium truncate hidden md:block max-w-[200px]">
              {documentTitle}
            </span>
          )}
        </div>

        {/* ── Center: Page navigation + Zoom ──────────────────────────── */}
        <div className="flex items-center gap-1">
          {/* Page navigation */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={isFirstPage}
              aria-label="Previous page"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Button>

            <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap px-1 min-w-[80px] text-center">
              <span className="font-medium text-foreground">{currentPage}</span>
              {' / '}
              <span>{totalPages}</span>
            </span>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={isLastPage}
              aria-label="Next page"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Button>
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={zoomOut}
              disabled={zoomLevel <= ZOOM_STEPS[0]}
              aria-label="Zoom out"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs min-w-[48px] h-8"
              onClick={fitWidth}
              aria-label={`Zoom ${zoomPercent}%. Click to reset to 100%`}
            >
              {zoomPercent}%
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={zoomIn}
              disabled={zoomLevel >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              aria-label="Zoom in"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </Button>
          </div>
        </div>

        {/* ── Right: AI toggle + Fullscreen ───────────────────────────── */}
        <div className="flex items-center gap-1">
          <Button
            variant={isAiSidebarOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onAiSidebarToggle}
            aria-label={isAiSidebarOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
            aria-pressed={isAiSidebarOpen}
            className="gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="hidden sm:inline text-xs">AI</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </Button>
        </div>
      </div>
    </header>
  );
}
