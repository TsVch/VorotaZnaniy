'use client';

import AIAssistant from './AIAssistant';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { QaSourceItem } from '@/lib/api/client';

export interface AISidebarProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPage?: (pageNumber: number) => void;
}

/**
 * Maps a QaSourceItem to a best-effort page number.
 * The backend Q&A endpoint returns chunkIndex, not page number.
 * For MVP, we estimate: chunk 0 = page 1, chunk 1 = page 2, etc.
 * When the backend adds actual pageNumber to QaSourceItem, this
 * mapping should use the real value.
 */
function chunkToPage(source: QaSourceItem): number {
  return Math.max(1, source.chunkIndex + 1);
}

/**
 * AISidebar — AI chat panel integrated with the Secure Viewer.
 *
 * **Desktop (>= 768px):** Slide-out panel on the right (w-96).
 * **Mobile (< 768px):** Full-screen fixed overlay with backdrop,
 * does NOT resize the canvas underneath (prevents layout shift).
 *
 * Citation clicks → canvas page navigation via onNavigateToPage,
 * using a best-effort chunk-to-page mapping for MVP.
 */
export default function AISidebar({
  documentId,
  isOpen,
  onClose,
  onNavigateToPage,
}: AISidebarProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleSourceClick = (source: QaSourceItem) => {
    if (onNavigateToPage) {
      const page = chunkToPage(source);
      onNavigateToPage(page);
    }
  };

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="AI Assistant"
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">AI Assistant</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close AI Assistant"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {/* Chat content — fills remaining space */}
        <div className="flex-1 overflow-hidden">
          <AIAssistant
            documentId={documentId}
            isOpen={isOpen}
            onClose={onClose}
            onSourceClick={handleSourceClick}
          />
        </div>
      </div>
    );
  }

  // Desktop — side panel
  return (
    <div
      className="w-96 border-l border-border bg-background flex flex-col animate-in slide-in-from-right duration-200"
      role="complementary"
      aria-label="AI Assistant"
    >
      <AIAssistant
        documentId={documentId}
        isOpen={isOpen}
        onClose={onClose}
        onSourceClick={handleSourceClick}
      />
    </div>
  );
}
