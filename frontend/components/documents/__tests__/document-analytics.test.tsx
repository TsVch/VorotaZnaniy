import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocumentAnalyticsView from '../document-analytics';
import type { DocumentAnalytics } from '@/lib/api/client';

// ── Fixtures ──────────────────────────────────────────────────────────────

const mockAnalytics: DocumentAnalytics = {
  totalViews: 10,
  uniqueViewers: 3,
  aiQueries: 5,
  recentSessions: [
    {
      id: 'session-1',
      createdAt: '2026-07-21T10:00:00Z',
      isActive: true,
    },
    {
      id: 'session-2',
      createdAt: '2026-07-20T14:30:00Z',
      isActive: false,
    },
  ],
};

const emptyAnalytics: DocumentAnalytics = {
  totalViews: 0,
  uniqueViewers: 0,
  aiQueries: 0,
  recentSessions: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────

function renderAnalytics(props?: Partial<import('../document-analytics').DocumentAnalyticsProps>) {
  return render(
    <DocumentAnalyticsView
      data={mockAnalytics}
      loading={false}
      {...props}
    />,
  );
}

describe('DocumentAnalyticsView', () => {
  // ── AC-1: Metric cards display ──────────────────────────────────────────

  describe('AC-1: Metric cards display', () => {
    it('shows total views count', () => {
      renderAnalytics();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Total Views')).toBeInTheDocument();
    });

    it('shows unique viewers count', () => {
      renderAnalytics();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Unique Viewers')).toBeInTheDocument();
    });

    it('shows AI queries count', () => {
      renderAnalytics();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('AI Queries')).toBeInTheDocument();
    });
  });

  // ── AC-3: Empty state ────────────────────────────────────────────────────

  describe('AC-3: Empty state', () => {
    it('shows empty message when all metrics are zero', () => {
      renderAnalytics({ data: emptyAnalytics });

      expect(
        screen.getByText(/No analytics data yet/i),
      ).toBeInTheDocument();
    });

    it('shows zero values in metric cards', () => {
      renderAnalytics({ data: emptyAnalytics });

      const zeroes = screen.getAllByText('0');
      expect(zeroes).toHaveLength(3);
    });
  });

  // ── AC-4: Recent activity list ───────────────────────────────────────────

  describe('AC-4: Recent activity list', () => {
    it('shows recent session entries', () => {
      renderAnalytics();

      expect(screen.getByText('Active session')).toBeInTheDocument();
      expect(screen.getByText('Session ended')).toBeInTheDocument();
    });

    it('shows "No recent sessions" when list is empty but metrics exist', () => {
      const dataWithMetricsButNoSessions: DocumentAnalytics = {
        totalViews: 5,
        uniqueViewers: 2,
        aiQueries: 1,
        recentSessions: [],
      };

      renderAnalytics({ data: dataWithMetricsButNoSessions });

      expect(
        screen.getByText('No recent sessions to display.'),
      ).toBeInTheDocument();
    });
  });

  // ── Loading state ────────────────────────────────────────────────────────

  describe('Loading state', () => {
    it('shows skeleton when loading is true', () => {
      const { container } = render(
        <DocumentAnalyticsView data={null} loading={true} />,
      );

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // ── Null data ────────────────────────────────────────────────────────────

  describe('Null data', () => {
    it('renders nothing when data is null and not loading', () => {
      const { container } = render(
        <DocumentAnalyticsView data={null} loading={false} />,
      );

      expect(container.textContent).toBe('');
    });
  });
});
