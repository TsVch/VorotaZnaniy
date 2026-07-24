import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocumentsTable from '../documents-table';
import type { DocumentListItem } from '@/lib/api/client';

// ── Fixtures ──────────────────────────────────────────────────────────────

const mockDocuments: DocumentListItem[] = [
  {
    id: 'doc-1',
    title: 'Getting Started Guide',
    status: 'READY',
    fileSize: 2_456_000,
    pageCount: 24,
    createdAt: '2026-07-01T10:00:00Z',
  },
  {
    id: 'doc-2',
    title: 'Advanced Topics',
    status: 'PROCESSING',
    fileSize: 5_120_000,
    pageCount: null,
    createdAt: '2026-07-15T14:30:00Z',
  },
  {
    id: 'doc-3',
    title: 'Broken Document',
    status: 'ERROR',
    fileSize: 100_000,
    pageCount: null,
    createdAt: '2026-06-20T08:15:00Z',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function renderTable(props?: Partial<DocumentsTableProps>) {
  return render(
    <DocumentsTable
      documents={mockDocuments}
      total={3}
      page={1}
      limit={10}
      onPageChange={vi.fn()}
      loading={false}
      {...props}
    />,
  );
}

import type { DocumentsTableProps } from '../documents-table';

describe('DocumentsTable', () => {
  // ── AC-1: Display document list ─────────────────────────────────────────

  describe('AC-1: Display document list', () => {
    it('renders all documents when data is provided', () => {
      renderTable();

      expect(screen.getByText('Getting Started Guide')).toBeInTheDocument();
      expect(screen.getByText('Advanced Topics')).toBeInTheDocument();
      expect(screen.getByText('Broken Document')).toBeInTheDocument();
    });

    it('renders status badges for each document', () => {
      renderTable();

      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders formatted file sizes', () => {
      renderTable();

      // 2,456,000 bytes = 2.34 MB → "2.3 MB"
      expect(screen.getByText('2.3 MB')).toBeInTheDocument();
      // 5,120,000 bytes = 4.88 MB → "4.9 MB"
      expect(screen.getByText('4.9 MB')).toBeInTheDocument();
      // 100,000 bytes = 97.66 KB → "97.7 KB"
      expect(screen.getByText('97.7 KB')).toBeInTheDocument();
    });

    it('renders Settings links for each document', () => {
      renderTable();

      const settingsLinks = screen.getAllByText('Settings');
      expect(settingsLinks).toHaveLength(3);
      expect(settingsLinks[0]).toHaveAttribute('href', '/documents/doc-1/settings');
      expect(settingsLinks[1]).toHaveAttribute('href', '/documents/doc-2/settings');
      expect(settingsLinks[2]).toHaveAttribute('href', '/documents/doc-3/settings');
    });
  });

  // ── AC-5: Navigation to settings (via link) ─────────────────────────────

  describe('AC-5: Settings navigation', () => {
    it('renders document title as link to settings page', () => {
      renderTable();

      const titleLink = screen.getByText('Getting Started Guide');
      expect(titleLink).toHaveAttribute(
        'href',
        '/documents/doc-1/settings',
      );
    });
  });

  // ── Pagination ──────────────────────────────────────────────────────────

  describe('AC-4: Pagination', () => {
    it('shows pagination info when total > 0', () => {
      renderTable({ total: 25, page: 1, limit: 10 });

      expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    it('shows correct page info for page 2', () => {
      renderTable({ total: 25, page: 2, limit: 10 });

      expect(screen.getByText('Showing 11–20 of 25')).toBeInTheDocument();
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });

    it('disables Previous button on first page', () => {
      renderTable({ page: 1 });

      expect(
        screen.getByRole('button', { name: 'Previous page' }),
      ).toBeDisabled();
    });

    it('disables Next button on last page', () => {
      renderTable({ total: 10, page: 1, limit: 10 });

      expect(
        screen.getByRole('button', { name: 'Next page' }),
      ).toBeDisabled();
    });

    it('enables both buttons on middle page', () => {
      renderTable({ total: 30, page: 2, limit: 10 });

      expect(
        screen.getByRole('button', { name: 'Previous page' }),
      ).toBeEnabled();
      expect(
        screen.getByRole('button', { name: 'Next page' }),
      ).toBeEnabled();
    });
  });

  // ── Loading state ───────────────────────────────────────────────────────

  describe('Loading state', () => {
    it('renders skeleton rows when loading is true', () => {
      const { container } = render(
        <DocumentsTable
          documents={[]}
          total={0}
          page={1}
          limit={10}
          onPageChange={vi.fn()}
          loading={true}
        />,
      );

      // Skeleton elements should be rendered instead of data
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────

  describe('Empty state', () => {
    it('shows empty message when no documents', () => {
      render(
        <DocumentsTable
          documents={[]}
          total={0}
          page={1}
          limit={10}
          onPageChange={vi.fn()}
          loading={false}
        />,
      );

      expect(screen.getByText('No documents found.')).toBeInTheDocument();
    });
  });

  // ── Format helpers (test edge cases) ─────────────────────────────────────

  describe('Format helpers', () => {
    it('handles zero bytes', () => {
      renderTable({
        documents: [
          {
            id: 'doc-0',
            title: 'Empty',
            status: 'READY',
            fileSize: 0,
            pageCount: null,
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      });

      expect(screen.getByText('0 B')).toBeInTheDocument();
    });
  });
});
