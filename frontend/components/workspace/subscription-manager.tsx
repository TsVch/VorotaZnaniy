'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { billingApi } from '@/lib/api/client';
import type { BillingSubscriptionStatus } from '@/lib/api/client';

interface PaymentHistoryItem {
  providerTransactionId: string;
  eventType: string;
  amount: string;
  currency: string;
  isRecurring: boolean;
  processedAt: string;
}

interface SubscriptionManagerProps {
  workspaceId: string;
  subscription: BillingSubscriptionStatus;
  paymentHistory: PaymentHistoryItem[];
  onCancelSuccess?: () => void;
}

/**
 * Subscription manager component.
 *
 * Shows current subscription status, cancel button with confirmation,
 * and payment history table.
 */
export function SubscriptionManager({
  workspaceId,
  subscription,
  paymentHistory,
  onCancelSuccess,
}: SubscriptionManagerProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    setCancelError(null);

    try {
      await billingApi.cancelSubscription(workspaceId);
      setShowConfirm(false);
      onCancelSuccess?.();
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Cancellation failed';
      setCancelError(message);
    } finally {
      setCancelling(false);
    }
  }, [workspaceId, onCancelSuccess, router]);

  // ── Active subscription — show status + cancel button ────────────────
  if (subscription.isActive) {
    const nextBilling = subscription.expiresAt
      ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    return (
      <div className="space-y-6">
        {/* Status card */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">✓ Pro Active</CardTitle>
            <CardDescription className="text-green-700">
              Your subscription is active
              {nextBilling ? ` until ${nextBilling}` : ''}.
              {subscription.daysRemaining !== undefined &&
                ` ${subscription.daysRemaining} days remaining.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Cancel section */}
            {!showConfirm ? (
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => setShowConfirm(true)}
                aria-label="Cancel subscription"
              >
                Cancel Subscription
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">
                  Are you sure? Your subscription will remain active until{' '}
                  {nextBilling ?? 'the end of the billing period'}, then
                  your workspace will revert to the Free plan.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancel}
                    disabled={cancelling}
                    aria-label="Confirm cancellation"
                  >
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowConfirm(false);
                      setCancelError(null);
                    }}
                    disabled={cancelling}
                  >
                    Keep Subscription
                  </Button>
                </div>
                {cancelError && (
                  <p className="text-sm text-destructive" role="alert">
                    {cancelError}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment history */}
        <PaymentHistoryCard payments={paymentHistory} />
      </div>
    );
  }

  // ── Cancelled / Free — show status + link to upgrade ────────────────
  const isCancelled = subscription.status === 'CANCELLED';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {isCancelled ? 'Subscription Cancelled' : 'Free Plan'}
          </CardTitle>
          <CardDescription>
            {isCancelled
              ? 'Your subscription has been cancelled. Upgrade again to access Pro features.'
              : 'You are currently on the Free plan. Upgrade to Pro for premium features.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => router.push('/workspace/upgrade')}
            aria-label="Upgrade to Pro"
          >
            {isCancelled ? 'Resubscribe' : 'Upgrade to Pro'}
          </Button>
        </CardContent>
      </Card>

      {/* Payment history (still visible for cancelled) */}
      {paymentHistory.length > 0 && (
        <PaymentHistoryCard payments={paymentHistory} />
      )}
    </div>
  );
}

/**
 * Payment history sub-component.
 */
function PaymentHistoryCard({
  payments,
}: {
  payments: PaymentHistoryItem[];
}) {
  if (payments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>Your recent payments and renewals</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.providerTransactionId} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-muted-foreground">
                    {new Date(p.processedAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="py-2 pr-4">
                    {p.isRecurring ? 'Auto-renewal' : 'Initial payment'}
                  </td>
                  <td className="py-2 pr-4">
                    {p.amount} {p.currency}
                  </td>
                  <td className="py-2">
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      {p.eventType === 'payment.succeeded' ? 'Success' : 'Failed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
