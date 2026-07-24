'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { billingApi } from '@/lib/api/client';
import type { BillingSubscriptionStatus } from '@/lib/api/client';

interface UpgradeButtonProps {
  /** Workspace UUID */
  workspaceId: string;
  /** Current subscription status */
  subscriptionStatus: 'FREE' | 'ACTIVE' | 'CANCELLED' | 'PAST_DUE';
  /** Optional subscription details for displaying status */
  subscription?: BillingSubscriptionStatus | null;
  /** Called after successful payment redirect */
  onSuccess?: () => void;
}

/**
 * Upgrade button for workspace Pro subscription.
 *
 * Shows subscription status and a "Subscribe" button for FREE/CANCELLED workspaces.
 * Redirects user to YooKassa hosted payment page on click.
 */
export function UpgradeButton({
  workspaceId,
  subscriptionStatus,
  subscription,
  onSuccess,
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await billingApi.createPayment({
        workspaceId,
        amount: 99000, // 990 RUB in minor units
        description: 'Pro Subscription — 1 month',
        returnUrl: `${window.location.origin}/workspace/settings?payment=success`,
      });

      // Redirect user to YooKassa hosted payment page
      window.location.href = result.confirmationUrl;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Payment creation failed. Please try again.';
      setError(message);
      setLoading(false);
    }
  }, [workspaceId, onSuccess]);

  // ── Already subscribed ─────────────────────────────────────────────────
  if (subscriptionStatus === 'ACTIVE') {
    const expiresDate = subscription?.expiresAt
      ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800">✓ Pro Active</CardTitle>
          <CardDescription className="text-green-700">
            Your Pro subscription is active
            {expiresDate ? ` until ${expiresDate}` : ''}.
            {subscription?.daysRemaining !== undefined &&
              ` ${subscription.daysRemaining} days remaining.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            Current Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Free / Cancelled / Past Due — show upgrade CTA ───────────────────
  const isCancelled = subscriptionStatus === 'CANCELLED';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pro Subscription</CardTitle>
        <CardDescription>
          {isCancelled
            ? 'Your subscription was cancelled. Resubscribe to continue using Pro features.'
            : 'Upgrade to Pro and unlock premium features for your workspace.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">990</span>
          <span className="text-lg text-muted-foreground">RUB/month</span>
        </div>

        {/* Feature list */}
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">✓ Unlimited document uploads</li>
          <li className="flex items-center gap-2">✓ AI-powered Q&A assistant</li>
          <li className="flex items-center gap-2">✓ Advanced DRM protection</li>
          <li className="flex items-center gap-2">✓ Detailed analytics</li>
        </ul>

        {/* Subscribe button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubscribe}
          disabled={loading}
          aria-label={loading ? 'Processing payment...' : 'Subscribe to Pro'}
        >
          {loading ? 'Redirecting to payment...' : 'Subscribe'}
        </Button>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Secure payment via YooKassa. No card data is stored on our servers.
        </p>
      </CardContent>
    </Card>
  );
}
