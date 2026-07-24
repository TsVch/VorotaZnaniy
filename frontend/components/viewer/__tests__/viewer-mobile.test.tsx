import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AISidebar from '../ai-sidebar';
import CanvasViewer from '../canvas-viewer';

// ── Mock useMediaQuery ─────────────────────────────────────────────────────

const mockUseMediaQuery = vi.fn();

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: (query: string) => mockUseMediaQuery(query),
}));

// ── Mock AIAssistant ───────────────────────────────────────────────────────

vi.mock('@/components/viewer/AIAssistant', () => ({
  default: function MockAIAssistant() {
    return <div data-testid="ai-assistant-mock">AI Assistant</div>;
  },
}));

// ── Mock hooks — use functions so they can be overridden per test ─────────

const mockPagePreloader = vi.fn();
mockPagePreloader.mockReturnValue({
  1: { image: null, isLoading: true, error: null },
});

vi.mock('@/components/viewer/hooks/usePagePreloader', () => ({
  usePagePreloader: (...args: unknown[]) => mockPagePreloader(...args),
}));

const mockUseCanvasRenderer = vi.fn().mockReturnValue({
  canvasState: 'loading',
  errorMessage: null,
  retry: vi.fn(),
});

vi.mock('@/components/viewer/hooks/useCanvasRenderer', () => ({
  useCanvasRenderer: () => mockUseCanvasRenderer(),
}));

// ── Mock sub-components ────────────────────────────────────────────────────

vi.mock('@/components/viewer/WatermarkOverlay', () => ({
  default: function MockWatermark() {
    return null;
  },
  __esModule: true,
}));

vi.mock('@/components/viewer/ViewerControls', () => ({
  default: function MockControls() {
    return <div data-testid="viewer-controls" />;
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: function MockSkeleton({ className }: { className?: string }) {
    return <div data-testid="skeleton" className={className} />;
  },
}));

// ── Mock IntersectionObserver (jsdom doesn't have it) ─────────────────────
// Must be a class mock because the component calls `new IntersectionObserver(...)`
class MockIntersectionObserver {
  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {}
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AISidebar — Mobile Responsive', () => {
  const defaultProps = {
    documentId: 'doc-1',
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMediaQuery.mockReset();
  });

  it('AC-1: should render as full-screen overlay on mobile (< 768px)', () => {
    mockUseMediaQuery.mockReturnValue(true);
    const { container } = render(<AISidebar {...defaultProps} />);

    // Should have fixed inset-0 z-50 (mobile overlay)
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Should have AI Assistant heading (h2 element — there may be multiple elements with this text)
    const headings = screen.getAllByText('AI Assistant');
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(headings[0].tagName).toBe('H2');
  });

  it('should render as side panel on desktop (>= 768px)', () => {
    mockUseMediaQuery.mockReturnValue(false);
    const { container } = render(<AISidebar {...defaultProps} />);

    // Should have complementary role (side panel)
    const panel = container.querySelector('[role="complementary"]');
    expect(panel).toBeTruthy();
    expect(panel).toHaveClass('w-96');

    // Should NOT have aria-modal (not a modal on desktop)
    const dialog = container.querySelector('[aria-modal="true"]');
    expect(dialog).toBeFalsy();
  });

  it('should render nothing when closed', () => {
    mockUseMediaQuery.mockReturnValue(true);
    const { container } = render(
      <AISidebar {...defaultProps} isOpen={false} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('should render AI Assistant component when open', () => {
    mockUseMediaQuery.mockReturnValue(false);
    render(<AISidebar {...defaultProps} />);

    expect(screen.getByTestId('ai-assistant-mock')).toBeTruthy();
  });

  it('should call onClose when close button is clicked on mobile', () => {
    mockUseMediaQuery.mockReturnValue(true);
    const onClose = vi.fn();
    render(<AISidebar {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByLabelText('Close AI Assistant');
    closeButton.click();

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('CanvasViewer — Loading States', () => {
  const defaultProps = {
    sessionId: 'session-1',
    documentId: 'doc-1',
    currentPage: 1,
    totalPages: 10,
    zoomLevel: 1,
    onPageChange: vi.fn(),
    onZoomChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCanvasRenderer.mockReturnValue({
      canvasState: 'loading',
      errorMessage: null,
      retry: vi.fn(),
    });
    mockPagePreloader.mockReturnValue({
      1: { image: null, isLoading: true, error: null },
    });
  });

  it('AC-4: should render skeleton loader when page is loading', () => {
    const { container } = render(<CanvasViewer {...defaultProps} />);

    // Should have skeleton elements
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render canvas when page is loaded', () => {
    mockUseCanvasRenderer.mockReturnValue({
      canvasState: 'ready',
      errorMessage: null,
      retry: vi.fn(),
    });
    mockPagePreloader.mockReturnValue({
      1: { image: 'data:image/png;base64,mock', isLoading: false, error: null },
    });

    const { container } = render(<CanvasViewer {...defaultProps} />);

    // Should have a canvas element
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });
});
