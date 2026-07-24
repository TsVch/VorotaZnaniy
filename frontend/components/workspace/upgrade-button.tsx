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
 * Redirects user to payment provider's hosted page on click.
 *
 * Detects Mock Payment mode (confirmationUrl containing 'mock-payment') and
 * shows a test mode banner instead of redirecting to a fake URL.
 */
export function UpgradeButton({
  workspaceId,
  subscriptionStatus,
  subscription,
  onSuccess,
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [mockSuccess, setMockSuccess] = useState(false);
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

      // Detect Mock Payment mode by checking the confirmation URL
      if (result.confirmationUrl.includes('mock-payment.example.com')) {
        setMockMode(true);
        setLoading(false);

        // After a short delay, show success and enable "Go to Dashboard"
        setTimeout(() => {
          setMockSuccess(true);
          onSuccess?.();
        }, 3000);
      } else {
        // Real provider — redirect to hosted payment page
        window.location.href = result.confirmationUrl;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Payment creation failed. Please try again.';
      setError(message);
      setLoading(false);
    }
  }, [workspaceId, onSuccess]);

  // ── Mock Mode: simulate in-progress payment ──────────────────────────
  if (mockMode && !mockSuccess) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="text-lg" role="img" aria-label="warning">
              ⚠️
            </span>
            <CardTitle className="text-yellow-800">
              Test Mode (Mock Payment)
            </CardTitle>
          </div>
          <CardDescription className="text-yellow-700">
            Your subscription is being activated automatically.
            This is a simulated payment — no real charge will occur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress indication */}
          <div className="flex items-center gap-2 text-sm text-yellow-700">
            <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
            Processing payment simulation...
          </div>
          <div className="flex items-center gap-2 text-sm text-yellow-700">
            <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
            Waiting for simulated webhook...
          </div>
          <p className="pt-2 text-xs text-yellow-600">
            This should complete in about 3 seconds.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Mock Mode: payment succeeded ─────────────────────────────────────
  if (mockMode && mockSuccess) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800">
            ✓ Subscription Activated (Test)
          </CardTitle>
          <CardDescription className="text-green-700">
            Your Pro subscription has been activated in test mode.
            Redirecting to dashboard...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              window.location.href = '/workspace/settings';
            }}
            variant="outline"
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Already subscribed ─────────────────────────────────────────────────
  if (subscriptionStatus === 'ACTIVE') {
    const expiresDate = subscription?.expiresAt
      ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    // Show mock mode indicator in the ACTIVE card if activeProvider is 'mock'
    const isMock = subscription?.activeProvider === 'mock';

    return (
      <Card className={isMock ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}>
        <CardHeader>
          <div className="flex items-center gap-2">
            {isMock && (
              <span className="text-lg" role="img" aria-label="warning">
                ⚠️
              </span>
            )}
            <CardTitle className={isMock ? 'text-yellow-800' : 'text-green-800'}>
              {isMock ? '✓ Pro Active (Test Mode)' : '✓ Pro Active'}
            </CardTitle>
          </div>
          <CardDescription className={isMock ? 'text-yellow-700' : 'text-green-700'}>
            Your Pro subscription is active
            {expiresDate ? ` until ${expiresDate}` : ''}.
            {subscription?.daysRemaining !== undefined &&
              ` ${subscription.daysRemaining} days remaining.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMock && (
            <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-100 p-3">
              <p className="text-sm font-medium text-yellow-800">Test Mode</p>
              <p className="mt-1 text-xs text-yellow-700">
                Using Mock Payment Provider. No real payment was processed.
                Switch to <code>PAYMENT_PROVIDER_ACTIVE=yookassa</code> in production.
              </p>
            </div>
          )}
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

        {/* Mock mode banner (visible before clicking Subscribe) */}
        {subscription?.activeProvider === 'mock' && (
          <div className="rounded-md border border-yellow-300 bg-yellow-100 p-3">
            <p className="text-sm font-medium text-yellow-800">
              ⚠️ Test Mode (Mock Payment)
            </p>
            <p className="mt-1 text-xs text-yellow-700">
              No real payment will be processed. The subscription will be
              auto-activated after 3 seconds.
            </p>
          </div>
        )}

        {/* Subscribe button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubscribe}
          disabled={loading}
          aria-label={loading ? 'Processing payment...' : 'Subscribe to Pro'}
        >
          {loading ? 'Creating payment...' : 'Subscribe'}
        </Button>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {subscription?.activeProvider === 'mock'
            ? '🔬 Running in test mode — no real payment will be processed.'
            : 'Secure payment via YooKassa. No card data is stored on our servers.'}
        </p>
      </CardContent>
    </Card>
  );
}
