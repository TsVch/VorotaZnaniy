import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentsFilters from '../documents-filters';

// ── Helpers ───────────────────────────────────────────────────────────────

function renderFilters(props?: Partial<DocumentsFiltersProps>) {
  return render(
    <DocumentsFilters
      search=""
      onSearchChange={vi.fn()}
      statusFilter="ALL"
      onStatusFilterChange={vi.fn()}
      hasActiveFilters={false}
      onClearFilters={vi.fn()}
      {...props}
    />,
  );
}

import type { DocumentsFiltersProps } from '../documents-filters';

describe('DocumentsFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── AC-2: Search with debounce (part of AC-2 flow) ──────────────────────

  describe('AC-2: Search with debounce', () => {
    it('calls onSearchChange after 300ms debounce', () => {
      const onSearchChange = vi.fn();
      renderFilters({ onSearchChange });

      const input = screen.getByPlaceholderText('Search documents...');
      fireEvent.change(input, { target: { value: 'guide' } });

      // Should NOT be called immediately
      expect(onSearchChange).not.toHaveBeenCalled();

      // Advance time by 300ms
      vi.advanceTimersByTime(300);

      expect(onSearchChange).toHaveBeenCalledTimes(1);
      expect(onSearchChange).toHaveBeenCalledWith('guide');
    });

    it('does not call onSearchChange before debounce expires', () => {
      const onSearchChange = vi.fn();
      renderFilters({ onSearchChange });

      const input = screen.getByPlaceholderText('Search documents...');
      fireEvent.change(input, { target: { value: 'guide' } });

      // Advance only 200ms
      vi.advanceTimersByTime(200);

      expect(onSearchChange).not.toHaveBeenCalled();
    });

    it('resets debounce timer on rapid input', () => {
      const onSearchChange = vi.fn();
      renderFilters({ onSearchChange });

      const input = screen.getByPlaceholderText('Search documents...');
      fireEvent.change(input, { target: { value: 'g' } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: 'gu' } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: 'gui' } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: 'guid' } });

      // Only 200ms have passed since the last change
      vi.advanceTimersByTime(200);
      expect(onSearchChange).not.toHaveBeenCalled();

      // Now advance past 300ms from last change
      vi.advanceTimersByTime(100);
      expect(onSearchChange).toHaveBeenCalledTimes(1);
      expect(onSearchChange).toHaveBeenCalledWith('guid');
    });
  });

  // ── AC-3: Status filter ─────────────────────────────────────────────────

  describe('AC-3: Status filter', () => {
    it('calls onStatusFilterChange when a new status is selected', () => {
      const onStatusFilterChange = vi.fn();
      renderFilters({ onStatusFilterChange });

      const select = screen.getByLabelText('Filter by document status');
      fireEvent.change(select, { target: { value: 'READY' } });

      expect(onStatusFilterChange).toHaveBeenCalledTimes(1);
      expect(onStatusFilterChange).toHaveBeenCalledWith('READY');
    });

    it('shows correct options in the status dropdown', () => {
      renderFilters();

      const select = screen.getByLabelText('Filter by document status');
      const options = Array.from(select.querySelectorAll('option'));

      expect(options).toHaveLength(4);
      expect(options[0]).toHaveValue('ALL');
      expect(options[1]).toHaveValue('PROCESSING');
      expect(options[2]).toHaveValue('READY');
      expect(options[3]).toHaveValue('ERROR');
    });
  });

  // ── Clear filters ───────────────────────────────────────────────────────

  describe('Clear filters', () => {
    it('shows clear button when hasActiveFilters is true', () => {
      renderFilters({ hasActiveFilters: true });
      expect(
        screen.getByRole('button', { name: 'Clear all filters' }),
      ).toBeInTheDocument();
    });

    it('hides clear button when hasActiveFilters is false', () => {
      renderFilters({ hasActiveFilters: false });
      expect(
        screen.queryByRole('button', { name: 'Clear all filters' }),
      ).toBeNull();
    });

    it('calls onClearFilters when clear button is clicked', () => {
      const onClearFilters = vi.fn();
      renderFilters({ hasActiveFilters: true, onClearFilters });

      fireEvent.click(
        screen.getByRole('button', { name: 'Clear all filters' }),
      );

      expect(onClearFilters).toHaveBeenCalledTimes(1);
    });
  });

  // ── Search input accessibility ──────────────────────────────────────────

  describe('Accessibility', () => {
    it('has proper aria-label on search input', () => {
      renderFilters();
      expect(
        screen.getByLabelText('Search documents by title'),
      ).toBeInTheDocument();
    });

    it('has proper aria-label on status filter', () => {
      renderFilters();
      expect(
        screen.getByLabelText('Filter by document status'),
      ).toBeInTheDocument();
    });
  });
});
