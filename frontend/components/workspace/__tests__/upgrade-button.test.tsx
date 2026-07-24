import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpgradeButton } from '../upgrade-button';

// Mock billing API using vitest syntax
// vi.mock() is hoisted above all imports, so we must use vi.hoisted()
// to define variables available at factory evaluation time.
const { mockCreatePayment } = vi.hoisted(() => ({
  mockCreatePayment: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  billingApi: {
    createPayment: mockCreatePayment,
  },
}));

describe('UpgradeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3001',
        href: 'http://localhost:3001/workspace/upgrade',
      },
      writable: true,
    });
  });

  const defaultProps = {
    workspaceId: 'ws-1',
    subscriptionStatus: 'FREE' as const,
  };

  it('should render subscribe button for FREE status', () => {
    render(<UpgradeButton {...defaultProps} />);

    expect(screen.getByText('Pro Subscription')).toBeInTheDocument();
    expect(screen.getByText('990')).toBeInTheDocument();
    expect(screen.getByText('RUB/month')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /subscribe/i }),
    ).toBeInTheDocument();
  });

  it('should show active subscription card for ACTIVE status', () => {
    render(
      <UpgradeButton
        {...defaultProps}
        subscriptionStatus="ACTIVE"
        subscription={{
          status: 'ACTIVE',
          plan: 'PRO',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: true,
          daysRemaining: 30,
          proPlanPrice: 99000,
          proPlanCurrency: 'RUB',
        }}
      />,
    );

    expect(screen.getByText(/✓ Pro Active/i)).toBeInTheDocument();
    expect(screen.getByText(/30 days remaining/i)).toBeInTheDocument();
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
  });

  it('should call createPayment on subscribe click and redirect', async () => {
    mockCreatePayment.mockResolvedValue({
      confirmationUrl: 'https://yoomoney.ru/payment/123',
      providerTransactionId: 'tx-123',
    });

    render(<UpgradeButton {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    await waitFor(() => {
      expect(mockCreatePayment).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        amount: 99000,
        description: 'Pro Subscription — 1 month',
        returnUrl: 'http://localhost:3001/workspace/settings?payment=success',
      });
    });

    // Should redirect to YooKassa
    expect(window.location.href).toBe('https://yoomoney.ru/payment/123');
  });

  it('should show error message on API failure', async () => {
    mockCreatePayment.mockRejectedValue(
      new Error('Payment provider unavailable'),
    );

    render(<UpgradeButton {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Payment provider unavailable'),
      ).toBeInTheDocument();
    });

    // Button should be re-enabled
    expect(
      screen.getByRole('button', { name: /subscribe/i }),
    ).not.toBeDisabled();
  });

  it('should show loading state while creating payment', async () => {
    // Never resolve the promise so loading stays true
    mockCreatePayment.mockImplementation(() => new Promise(() => {}));

    render(<UpgradeButton {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /processing payment/i }),
      ).toBeDisabled();
    });
  });

  it('should render feature list for FREE status', () => {
    render(<UpgradeButton {...defaultProps} />);

    expect(
      screen.getByText(/unlimited document uploads/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ai-powered q&a assistant/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/advanced drm protection/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/detailed analytics/i),
    ).toBeInTheDocument();
  });

  it('should show security notice', () => {
    render(<UpgradeButton {...defaultProps} />);

    expect(
      screen.getByText(/no card data is stored/i),
    ).toBeInTheDocument();
  });
});
