import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionManager } from '../subscription-manager';

// Mock billing API
const { mockCancelSubscription } = vi.hoisted(() => ({
  mockCancelSubscription: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  billingApi: {
    cancelSubscription: mockCancelSubscription,
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

describe('SubscriptionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseSubscription = {
    status: 'ACTIVE' as const,
    plan: 'PRO',
    expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    daysRemaining: 25,
    proPlanPrice: 99000,
    proPlanCurrency: 'RUB',
  };

  const defaultProps = {
    workspaceId: 'ws-1',
    subscription: baseSubscription,
    paymentHistory: [],
  };

  it('should render active subscription status', () => {
    render(<SubscriptionManager {...defaultProps} />);

    expect(screen.getByText(/✓ Pro Active/i)).toBeInTheDocument();
    expect(screen.getByText(/25 days remaining/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /cancel subscription/i }),
    ).toBeInTheDocument();
  });

  it('should show cancel confirmation dialog', () => {
    render(<SubscriptionManager {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));

    expect(
      screen.getByText(/are you sure/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /confirm cancellation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /keep subscription/i }),
    ).toBeInTheDocument();
  });

  it('should call cancelSubscription on confirm', async () => {
    mockCancelSubscription.mockResolvedValue({ message: 'Cancelled' });

    render(<SubscriptionManager {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    await waitFor(() => {
      expect(mockCancelSubscription).toHaveBeenCalledWith('ws-1');
    });
  });

  it('should show error on cancellation failure', async () => {
    mockCancelSubscription.mockRejectedValue(
      new Error('Cannot cancel at this time'),
    );

    render(<SubscriptionManager {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Cannot cancel at this time'),
      ).toBeInTheDocument();
    });
  });

  it('should show Free Plan info for non-active subscriptions', () => {
    render(
      <SubscriptionManager
        {...defaultProps}
        subscription={{
          ...baseSubscription,
          status: 'FREE',
          isActive: false,
          daysRemaining: undefined,
        }}
      />,
    );

    expect(screen.getByText('Free Plan')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /upgrade to pro/i }),
    ).toBeInTheDocument();
  });

  it('should show Cancelled info with resubscribe button', () => {
    render(
      <SubscriptionManager
        {...defaultProps}
        subscription={{
          ...baseSubscription,
          status: 'CANCELLED',
          isActive: false,
          daysRemaining: undefined,
        }}
      />,
    );

    expect(screen.getByText(/subscription cancelled/i)).toBeInTheDocument();
    expect(
      screen.getByText('Resubscribe'),
    ).toBeInTheDocument();
  });

  it('should render payment history table', () => {
    const history = [
      {
        providerTransactionId: 'tx-1',
        eventType: 'payment.succeeded',
        amount: '990.00',
        currency: 'RUB',
        isRecurring: false,
        processedAt: '2026-07-23T12:00:00.000Z',
      },
      {
        providerTransactionId: 'tx-2',
        eventType: 'payment.succeeded',
        amount: '990.00',
        currency: 'RUB',
        isRecurring: true,
        processedAt: '2026-08-23T12:00:00.000Z',
      },
    ];

    render(
      <SubscriptionManager
        {...defaultProps}
        paymentHistory={history}
      />,
    );

    expect(screen.getByText('Payment History')).toBeInTheDocument();
    expect(screen.getByText('Initial payment')).toBeInTheDocument();
    expect(screen.getByText('Auto-renewal')).toBeInTheDocument();
  });

  it('should not render payment history card when empty', () => {
    render(<SubscriptionManager {...defaultProps} />);

    expect(screen.queryByText('Payment History')).not.toBeInTheDocument();
  });
});
