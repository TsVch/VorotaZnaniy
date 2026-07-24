import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewerToolbar from '../viewer-toolbar';
import type { ViewerToolbarProps } from '../viewer-toolbar';

// Mock useMediaQuery (desktop by default)
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderToolbar(props?: Partial<ViewerToolbarProps>) {
  return render(
    <ViewerToolbar
      currentPage={1}
      totalPages={10}
      onPageChange={vi.fn()}
      zoomLevel={1}
      onZoomChange={vi.fn()}
      isAiSidebarOpen={false}
      onAiSidebarToggle={vi.fn()}
      {...props}
    />,
  );
}

describe('ViewerToolbar', () => {
  // ── AC-1: Page Navigation ─────────────────────────────────────────────
  describe('Navigation', () => {
    it('calls onPageChange with previous page when prev is clicked', () => {
      const onPageChange = vi.fn();
      renderToolbar({ currentPage: 3, onPageChange });

      fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange with next page when next is clicked', () => {
      const onPageChange = vi.fn();
      renderToolbar({ currentPage: 3, onPageChange });

      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('disables prev button on first page', () => {
      renderToolbar({ currentPage: 1 });
      expect(
        screen.getByRole('button', { name: 'Previous page' }),
      ).toBeDisabled();
    });

    it('disables next button on last page', () => {
      renderToolbar({ currentPage: 10, totalPages: 10 });
      expect(
        screen.getByRole('button', { name: 'Next page' }),
      ).toBeDisabled();
    });

    it('displays current page and total pages', () => {
      renderToolbar({ currentPage: 5, totalPages: 20 });
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });
  });

  // ── AC-2: Zoom Controls ──────────────────────────────────────────────
  describe('Zoom', () => {
    it('calls onZoomChange with next level on zoom in', () => {
      const onZoomChange = vi.fn();
      renderToolbar({ zoomLevel: 1, onZoomChange });

      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(onZoomChange).toHaveBeenCalledWith(1.25);
    });

    it('calls onZoomChange with previous level on zoom out', () => {
      const onZoomChange = vi.fn();
      renderToolbar({ zoomLevel: 1.25, onZoomChange });

      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      expect(onZoomChange).toHaveBeenCalledWith(1);
    });

    it('calls onZoomChange with 1 on fit width click', () => {
      const onZoomChange = vi.fn();
      renderToolbar({ zoomLevel: 1.5, onZoomChange });

      fireEvent.click(screen.getByRole('button', { name: /zoom 150%.*/i }));
      expect(onZoomChange).toHaveBeenCalledWith(1);
    });

    it('disables zoom out at minimum level', () => {
      renderToolbar({ zoomLevel: 0.5 });
      expect(
        screen.getByRole('button', { name: 'Zoom out' }),
      ).toBeDisabled();
    });

    it('disables zoom in at maximum level', () => {
      renderToolbar({ zoomLevel: 2 });
      expect(
        screen.getByRole('button', { name: 'Zoom in' }),
      ).toBeDisabled();
    });
  });

  // ── AC-3: AI Toggle ───────────────────────────────────────────────────
  describe('AI Toggle', () => {
    it('calls onAiSidebarToggle when AI button is clicked', () => {
      const onAiSidebarToggle = vi.fn();
      renderToolbar({ onAiSidebarToggle });

      fireEvent.click(screen.getByRole('button', { name: /open AI assistant/i }));
      expect(onAiSidebarToggle).toHaveBeenCalledOnce();
    });

    it('shows pressed state when sidebar is open', () => {
      renderToolbar({ isAiSidebarOpen: true });
      const aiButton = screen.getByRole('button', { name: /close AI assistant/i });
      expect(aiButton.getAttribute('aria-pressed')).toBe('true');
    });
  });

  // ── AC-4: Keyboard Shortcuts ──────────────────────────────────────────
  describe('Keyboard shortcuts', () => {
    it('navigates to previous page on ArrowLeft', () => {
      const onPageChange = vi.fn();
      renderToolbar({ currentPage: 3, onPageChange });

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('navigates to next page on ArrowRight', () => {
      const onPageChange = vi.fn();
      renderToolbar({ currentPage: 3, onPageChange });

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('does not navigate past first page on ArrowLeft', () => {
      const onPageChange = vi.fn();
      renderToolbar({ currentPage: 1, onPageChange });

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('does not navigate past last page on ArrowRight', () => {
      const onPageChange = vi.fn();
      renderToolbar({ currentPage: 10, totalPages: 10, onPageChange });

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('zooms in on Ctrl+=', () => {
      const onZoomChange = vi.fn();
      renderToolbar({ zoomLevel: 1, onZoomChange });

      fireEvent.keyDown(window, { key: '=', ctrlKey: true });
      expect(onZoomChange).toHaveBeenCalledWith(1.25);
    });

    it('zooms out on Ctrl+-', () => {
      const onZoomChange = vi.fn();
      renderToolbar({ zoomLevel: 1.25, onZoomChange });

      fireEvent.keyDown(window, { key: '-', ctrlKey: true });
      expect(onZoomChange).toHaveBeenCalledWith(1);
    });

    it('resets zoom on Ctrl+0', () => {
      const onZoomChange = vi.fn();
      renderToolbar({ zoomLevel: 1.5, onZoomChange });

      fireEvent.keyDown(window, { key: '0', ctrlKey: true });
      expect(onZoomChange).toHaveBeenCalledWith(1);
    });

    it('does not handle keyboard when typing in an input', () => {
      const onPageChange = vi.fn();
      renderToolbar({ currentPage: 3, onPageChange });

      const input = document.createElement('input');
      fireEvent.keyDown(input, { key: 'ArrowLeft' });
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  // ── AC-5: Fullscreen toggle ───────────────────────────────────────────
  describe('Fullscreen', () => {
    it('renders fullscreen toggle button', () => {
      renderToolbar();
      expect(
        screen.getByRole('button', { name: 'Toggle fullscreen' }),
      ).toBeInTheDocument();
    });
  });

  // ── AC-6: Exit viewer ─────────────────────────────────────────────────
  describe('Exit viewer', () => {
    it('renders exit button', () => {
      renderToolbar();
      expect(
        screen.getByRole('button', { name: 'Exit viewer' }),
      ).toBeInTheDocument();
    });
  });
});
