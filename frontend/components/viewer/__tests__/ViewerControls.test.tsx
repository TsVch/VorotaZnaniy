import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewerControls from '../ViewerControls';

// ── Helpers ───────────────────────────────────────────────────────────────

function renderControls(props?: Partial<ViewerControlsProps>) {
  return render(
    <ViewerControls
      currentPage={1}
      totalPages={10}
      onPageChange={vi.fn()}
      zoomLevel={1}
      onZoomChange={vi.fn()}
      allowTextSelection={false}
      {...props}
    />,
  );
}

// Re-import the type for the helper above
import type { ViewerControlsProps } from '../ViewerControls';

describe('ViewerControls', () => {
  // ── AC-1: Navigation ──────────────────────────────────────────────────
  describe('AC-1: Navigation', () => {
    it('calls onPageChange with previous page number when Previous is clicked', () => {
      const onPageChange = vi.fn();
      renderControls({ currentPage: 3, onPageChange });

      fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange with next page number when Next is clicked', () => {
      const onPageChange = vi.fn();
      renderControls({ currentPage: 3, onPageChange });

      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('disables Previous button on first page', () => {
      renderControls({ currentPage: 1 });
      expect(
        screen.getByRole('button', { name: 'Previous page' }),
      ).toBeDisabled();
    });

    it('disables Next button on last page', () => {
      renderControls({ currentPage: 10, totalPages: 10 });
      expect(
        screen.getByRole('button', { name: 'Next page' }),
      ).toBeDisabled();
    });

    it('displays current page and total pages', () => {
      renderControls({ currentPage: 5, totalPages: 20 });

      // The text is "Page 5 / 20" with non-breaking spaces
      const container = screen.getByRole('navigation', {
        name: 'Page navigation',
      });
      expect(container).toHaveTextContent('5');
      expect(container).toHaveTextContent('20');
    });
  });

  // ── AC-2: Zoom ────────────────────────────────────────────────────────
  describe('AC-2: Zoom', () => {
    it('calls onZoomChange with the correct value when a zoom button is clicked', () => {
      const onZoomChange = vi.fn();
      renderControls({ zoomLevel: 1, onZoomChange });

      fireEvent.click(screen.getByRole('button', { name: 'Zoom 150%' }));
      expect(onZoomChange).toHaveBeenCalledWith(1.5);
    });

    it('calls onZoomChange with 0.75 when 75% is clicked', () => {
      const onZoomChange = vi.fn();
      renderControls({ zoomLevel: 1, onZoomChange });

      fireEvent.click(screen.getByRole('button', { name: 'Zoom 75%' }));
      expect(onZoomChange).toHaveBeenCalledWith(0.75);
    });

    it('highlights the active zoom level with secondary variant', () => {
      renderControls({ zoomLevel: 1.25 });
      const activeButton = screen.getByRole('button', { name: 'Zoom 125%' });
      expect(activeButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('does not highlight non-active zoom levels', () => {
      renderControls({ zoomLevel: 1 });
      const inactiveButton = screen.getByRole('button', { name: 'Zoom 150%' });
      expect(inactiveButton.getAttribute('aria-pressed')).toBe('false');
    });
  });

  // ── AC-3: Text Selection DRM ──────────────────────────────────────────
  describe('AC-3: Text Selection DRM', () => {
    it('shows Protected indicator when text selection is not allowed', () => {
      renderControls({ allowTextSelection: false });
      expect(screen.getByText('Protected')).toBeInTheDocument();
    });

    it('does not show Protected indicator when text selection is allowed', () => {
      renderControls({ allowTextSelection: true });
      expect(screen.queryByText('Protected')).toBeNull();
    });
  });
});
