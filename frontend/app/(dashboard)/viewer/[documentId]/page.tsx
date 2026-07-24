'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CanvasViewer from '@/components/viewer/canvas-viewer';
import ViewerToolbar from '@/components/viewer/viewer-toolbar';
import AISidebar from '@/components/viewer/ai-sidebar';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { viewerApi, documentsApi } from '@/lib/api/client';
import type { DocumentDetail } from '@/lib/api/client';

/**
 * Viewer page — orchestrates the full document viewing experience.
 *
 * Wrapped in ToastProvider for global toast notifications.
 * On SESSION_TERMINATED error: shows warning toast and redirects to /dashboard.
 */
export default function ViewerPage() {
  return (
    <ToastProvider>
      <ViewerPageInner />
    </ToastProvider>
  );
}

function ViewerPageInner() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string;
  const { addToast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Watermark data from session creation
  const [watermarkData, setWatermarkData] = useState<{
    userEmail: string;
    sessionIdShort: string;
    timestamp: string;
  } | null>(null);

  // ── Load document + create session on mount ────────────────────────────
  const initializeViewer = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const doc = await documentsApi.getDocument(documentId);
      setDocument(doc);

      const session = await viewerApi.createSession(documentId);
      setSessionId(session.session_id);
      setWatermarkData(session.watermark_data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load document';

      // Check for SESSION_TERMINATED or forbidden error
      const isSessionError =
        /session|forbidden|unauthorized|terminated|403/i.test(message);

      if (isSessionError) {
        addToast({
          message: 'Your session was terminated. Please try again.',
          variant: 'warning',
          duration: 6000,
        });
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }

    // Intentionally omit addToast from deps — it is stable (useCallback in provider)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    initializeViewer();
  }, [initializeViewer]);

  // ── Session terminated handler ─────────────────────────────────────────
  const handleSessionTerminated = useCallback(() => {
    addToast({
      message: 'Your viewing session was terminated. This may happen if the document was opened on another device. Redirecting to dashboard...',
      variant: 'warning',
      duration: 6000,
    });

    // Redirect to dashboard after a brief delay so the user sees the toast
    setTimeout(() => {
      router.push('/dashboard');
    }, 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleNavigateToPage = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);

  const toggleAiSidebar = useCallback(() => {
    setAiSidebarOpen((prev) => !prev);
  }, []);

  const closeAiSidebar = useCallback(() => {
    setAiSidebarOpen(false);
  }, []);

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="h-12 animate-pulse bg-muted border-b" />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading document...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
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
          <h2 className="font-semibold text-foreground">Failed to Load Document</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={initializeViewer}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!sessionId || !document) {
    return null;
  }

  const pageCount = document.pageCount ?? 1;

  // ── Viewer layout ──────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Viewer Toolbar — zoom state synced with CanvasViewer */}
      <ViewerToolbar
        currentPage={currentPage}
        totalPages={pageCount}
        onPageChange={setCurrentPage}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        isAiSidebarOpen={aiSidebarOpen}
        onAiSidebarToggle={toggleAiSidebar}
        documentTitle={document.title}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas — fully controlled: parent owns currentPage and zoomLevel */}
        <div className="flex-1 min-w-0 relative">
          <CanvasViewer
            sessionId={sessionId}
            documentId={documentId}
            currentPage={currentPage}
            totalPages={pageCount}
            zoomLevel={zoomLevel}
            allowTextSelection={
              (document.protectionConfig as { allow_text_selection?: boolean })
                ?.allow_text_selection ?? false
            }
            watermarkData={watermarkData ?? undefined}
            onPageChange={setCurrentPage}
            onZoomChange={setZoomLevel}
            onSessionTerminated={handleSessionTerminated}
          />
        </div>

        {/* AI Sidebar — citation clicks navigate canvas via onNavigateToPage */}
        <AISidebar
          documentId={documentId}
          isOpen={aiSidebarOpen}
          onClose={closeAiSidebar}
          onNavigateToPage={handleNavigateToPage}
        />
      </div>
    </div>
  );
}
