import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CanvasRenderer from '../CanvasRenderer';

// ── API mock ──────────────────────────────────────────────────────────────
const mockGetPageUrl = vi.fn();

vi.mock('@/lib/api/client', () => ({
  viewerApi: {
    getPageUrl: (...args: unknown[]) => mockGetPageUrl(...args),
    createSession: vi.fn(),
    heartbeat: vi.fn(),
  },
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'ApiError';
    }
    get isUnauthorized(): boolean {
      return this.status === 401 || this.status === 403;
    }
  },
}));

// ── Constants ─────────────────────────────────────────────────────────────
const SESSION_ID = 'test-session-1234-5678';
const DOCUMENT_ID = 'test-doc-1234-5678';

// ── Helpers ───────────────────────────────────────────────────────────────
async function renderCanvasRenderer(props?: Record<string, unknown>) {
  const result = render(
    <CanvasRenderer
      sessionId={SESSION_ID}
      documentId={DOCUMENT_ID}
      {...props}
    />,
  );

  // Wait for initial render to settle
  await waitFor(() => {
    expect(
      screen.getByRole('application', { name: 'Document viewer' }),
    ).toBeInTheDocument();
  });

  return result;
}

describe('CanvasRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful image load for page 1
    mockGetPageUrl.mockResolvedValue({
      url: 'https://storage.example.com/pages/page-1.webp?token=abc',
      expires_in: 60,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── AC-1: Successful page rendering ────────────────────────────────────
  describe('AC-1: Successful page rendering', () => {
    it('renders a canvas element', async () => {
      await renderCanvasRenderer();

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('requests presigned URL for the initial page (1)', async () => {
      await renderCanvasRenderer({ totalPages: 10 });

      await waitFor(() => {
        expect(mockGetPageUrl).toHaveBeenCalledWith(SESSION_ID, 1);
      });
    });

    it('displays page navigation with current page number', async () => {
      await renderCanvasRenderer({ totalPages: 10 });

      const nav = screen.getByRole('navigation', {
        name: 'Page navigation',
      });
      expect(nav).toHaveTextContent('Page');
      expect(nav).toHaveTextContent('1');
      expect(nav).toHaveTextContent('10');
    });
  });

  // ── AC-2: Preloading adjacent pages ────────────────────────────────────
  describe('AC-2: Preloading adjacent pages', () => {
    it('preloads pages N-1, N, N+1', async () => {
      mockGetPageUrl.mockResolvedValue({
        url: 'https://storage.example.com/pages/page-1.webp?token=abc',
        expires_in: 60,
      });

      await renderCanvasRenderer({ initialPage: 5 });

      // Should request pages 4, 5, 6
      await waitFor(() => {
        expect(mockGetPageUrl).toHaveBeenCalledWith(SESSION_ID, 4);
        expect(mockGetPageUrl).toHaveBeenCalledWith(SESSION_ID, 5);
        expect(mockGetPageUrl).toHaveBeenCalledWith(SESSION_ID, 6);
      });
    });

    it('does not request page 0 or negative pages', async () => {
      mockGetPageUrl.mockResolvedValue({
        url: 'https://storage.example.com/pages/page-1.webp?token=abc',
        expires_in: 60,
      });

      await renderCanvasRenderer({ initialPage: 1 });

      // Should request pages 1, 2 (not 0)
      await waitFor(() => {
        expect(mockGetPageUrl).toHaveBeenCalledWith(SESSION_ID, 1);
        expect(mockGetPageUrl).toHaveBeenCalledWith(SESSION_ID, 2);
      });

      expect(mockGetPageUrl).not.toHaveBeenCalledWith(SESSION_ID, 0);
    });
  });

  // ── AC-3: Block context menu ───────────────────────────────────────────
  describe('AC-3: Block context menu', () => {
    it('prevents default context menu on canvas', async () => {
      await renderCanvasRenderer();

      const canvas = document.querySelector('canvas')!;
      const prevented = !canvas.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(prevented).toBe(true);
    });
  });

  // ── AC-4: Block hotkeys ────────────────────────────────────────────────
  describe('AC-4: Block hotkeys', () => {
    function dispatchKeyOnContainer(
      key: string,
      ctrlKey: boolean,
    ): boolean {
      const container = screen.getByRole('application', {
        name: 'Document viewer',
      });
      return !container.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          ctrlKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    }

    it('blocks Ctrl+S (Save)', async () => {
      await renderCanvasRenderer();
      expect(dispatchKeyOnContainer('s', true)).toBe(true);
    });

    it('blocks Ctrl+P (Print)', async () => {
      await renderCanvasRenderer();
      expect(dispatchKeyOnContainer('p', true)).toBe(true);
    });

    it('blocks Ctrl+U (View Source)', async () => {
      await renderCanvasRenderer();
      expect(dispatchKeyOnContainer('u', true)).toBe(true);
    });

    it('does not block non-blocked hotkeys (Ctrl+C)', async () => {
      await renderCanvasRenderer();
      expect(dispatchKeyOnContainer('c', true)).toBe(false);
    });
  });

  // ── AC-5: Handle session expiry / errors ──────────────────────────────
  describe('AC-5: Handle session expiry / errors', () => {
    it('shows "Failed to load page" with retry on load error', async () => {
      mockGetPageUrl.mockRejectedValue(new Error('Network error'));

      await renderCanvasRenderer();

      await waitFor(() => {
        expect(
          screen.getByText('Failed to Load Page'),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole('button', { name: 'Retry' }),
      ).toBeInTheDocument();
    });

    it('shows "Session Expired" with Refresh when error indicates auth failure', async () => {
      // Simulate a forbidden/expired session error
      // The preloader stores the error message; CanvasRenderer checks
      // for /session|forbidden|unauthorized|expired/i regex match
      mockGetPageUrl.mockRejectedValue(new Error('Forbidden'));

      await renderCanvasRenderer();

      await waitFor(() => {
        expect(
          screen.getByText('Session Expired'),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole('button', { name: 'Refresh Page' }),
      ).toBeInTheDocument();
    });
  });

  // ── Page navigation ────────────────────────────────────────────────────
  describe('Page navigation', () => {
    it('increments page when "Next" is clicked', async () => {
      await renderCanvasRenderer({ totalPages: 10 });

      const nextButton = screen.getByRole('button', { name: 'Next page' });

      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(mockGetPageUrl).toHaveBeenCalledWith(SESSION_ID, 2);
      });
    });

    it('decrements page when "Previous" is clicked', async () => {
      await renderCanvasRenderer({ initialPage: 3, totalPages: 10 });

      const prevButton = screen.getByRole('button', { name: 'Previous page' });

      fireEvent.click(prevButton);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('disables previous button on first page', async () => {
      await renderCanvasRenderer({ initialPage: 1, totalPages: 10 });

      const prevButton = screen.getByRole('button', { name: 'Previous page' });
      expect(prevButton).toBeDisabled();
    });

    it('calls onPageChange callback when navigating', async () => {
      const onPageChange = vi.fn();
      await renderCanvasRenderer({ initialPage: 2, totalPages: 10, onPageChange });

      const nextButton = screen.getByRole('button', { name: 'Next page' });
      fireEvent.click(nextButton);

      expect(onPageChange).toHaveBeenCalledWith(3);
    });
  });

  // ── DRM: Additional protections ────────────────────────────────────────
  describe('DRM protections', () => {
    it('canvas is not draggable', async () => {
      await renderCanvasRenderer();

      const canvas = document.querySelector('canvas')!;
      expect(canvas.getAttribute('draggable')).toBe('false');
    });

    it('text is not selectable (user-select: none)', async () => {
      await renderCanvasRenderer();

      const container = screen.getByRole('application', {
        name: 'Document viewer',
      });
      expect(container.className).toContain('select-none');
    });
  });

  // ── Zoom integration ────────────────────────────────────────────────────
  describe('Zoom integration', () => {
    it('applies transform scale(1) by default', async () => {
      await renderCanvasRenderer();

      // The scaled wrapper is the parent of the <canvas>
      const canvas = document.querySelector('canvas')!;
      expect(canvas).toBeInTheDocument();
      const scaledWrapper = canvas.parentElement!;
      expect(scaledWrapper).toBeInTheDocument();
      expect(scaledWrapper.style.transform).toBe('scale(1)');
    });

    it('renders ViewerControls with zoom buttons', async () => {
      await renderCanvasRenderer();

      expect(
        screen.getByRole('group', { name: 'Zoom level' }),
      ).toBeInTheDocument();
    });

    it('default zoom level is 1 (100%) highlighted', async () => {
      await renderCanvasRenderer();

      const zoomButton = screen.getByRole('button', { name: 'Zoom 100%' });
      expect(zoomButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('updates canvas transform when zoom button is clicked', async () => {
      await renderCanvasRenderer();

      fireEvent.click(screen.getByRole('button', { name: 'Zoom 150%' }));

      const scaledWrapper = document.querySelector('canvas')!.parentElement!;
      expect(scaledWrapper.style.transform).toBe('scale(1.5)');
    });
  });

  // ── Text Selection DRM ─────────────────────────────────────────────────
  describe('Text Selection DRM', () => {
    it('applies select-none class when allowTextSelection is false (default)', async () => {
      await renderCanvasRenderer();

      const container = screen.getByRole('application', {
        name: 'Document viewer',
      });
      expect(container.className).toContain('select-none');
      expect(container.className).not.toContain('select-text');
    });

    it('applies select-text class when allowTextSelection is true', async () => {
      await renderCanvasRenderer({ allowTextSelection: true });

      const container = screen.getByRole('application', {
        name: 'Document viewer',
      });
      expect(container.className).toContain('select-text');
      expect(container.className).not.toContain('select-none');
    });
  });

  // ── Watermark Overlay integration ───────────────────────────────────────
  describe('Watermark Overlay integration', () => {
    const testWatermarkData = {
      userEmail: 'viewer@example.com',
      sessionIdShort: 'abc12345',
      timestamp: '2026-07-21',
    };

    it('renders WatermarkOverlay when watermarkData is provided', async () => {
      await renderCanvasRenderer({ watermarkData: testWatermarkData });

      const overlay = screen.getByTestId('watermark-overlay');
      expect(overlay).toBeInTheDocument();
    });

    it('does not render WatermarkOverlay when watermarkData is omitted', async () => {
      await renderCanvasRenderer();

      expect(screen.queryByTestId('watermark-overlay')).toBeNull();
    });
  });
});
