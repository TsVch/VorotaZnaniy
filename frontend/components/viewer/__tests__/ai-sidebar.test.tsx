import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AISidebar from '../ai-sidebar';

// ── Mock useMediaQuery (desktop by default) ──────────────────────────────
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

// ── Mock AIAssistant inner component ─────────────────────────────────────
vi.mock('../AIAssistant', () => ({
  default: ({
    documentId,
    isOpen,
    onClose,
    onSourceClick,
  }: {
    documentId: string;
    isOpen: boolean;
    onClose: () => void;
    onSourceClick?: (source: { chunkIndex: number; text: string }) => void;
  }) =>
    isOpen ? (
      <div data-testid="ai-assistant-mock">
        <span data-testid="doc-id">{documentId}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI Assistant"
        >
          Close
        </button>
        <button
          type="button"
          data-testid="simulate-source-click"
          onClick={() =>
            onSourceClick?.({ chunkIndex: 2, text: 'Sample chunk text' })
          }
        >
          Simulate Citation Click
        </button>
      </div>
    ) : null,
}));

describe('AISidebar', () => {
  const defaultProps = {
    documentId: 'doc-uuid-123',
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render AIAssistant when isOpen is true', () => {
    render(<AISidebar {...defaultProps} />);
    expect(screen.getByTestId('ai-assistant-mock')).toBeInTheDocument();
    expect(screen.getByTestId('doc-id')).toHaveTextContent('doc-uuid-123');
  });

  it('should pass documentId to AIAssistant', () => {
    render(<AISidebar {...defaultProps} documentId="custom-doc-id" />);
    expect(screen.getByTestId('doc-id')).toHaveTextContent('custom-doc-id');
  });

  it('should render nothing when isOpen is false', () => {
    const { container } = render(
      <AISidebar {...defaultProps} isOpen={false} />,
    );

    expect(screen.queryByTestId('ai-assistant-mock')).not.toBeInTheDocument();
    // Should render an empty fragment (no wrapping div)
    expect(container.innerHTML).toBe('');
  });

  it('should call onClose when close is triggered', () => {
    const onClose = vi.fn();
    render(<AISidebar {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call onNavigateToPage with estimated page number when source is clicked', () => {
    const onNavigateToPage = vi.fn();
    render(
      <AISidebar
        {...defaultProps}
        onNavigateToPage={onNavigateToPage}
      />,
    );

    fireEvent.click(screen.getByTestId('simulate-source-click'));
    // chunkIndex=2 → page 3 (0-based to 1-based mapping)
    expect(onNavigateToPage).toHaveBeenCalledWith(3);
  });

  it('should not crash when onNavigateToPage is not provided and source is clicked', () => {
    render(<AISidebar {...defaultProps} />);

    // Should not throw
    expect(() => {
      fireEvent.click(screen.getByTestId('simulate-source-click'));
    }).not.toThrow();
  });

  it('should have accessible label', () => {
    render(<AISidebar {...defaultProps} />);
    expect(
      screen.getByRole('complementary', { name: /AI Assistant/i }),
    ).toBeInTheDocument();
  });
});
