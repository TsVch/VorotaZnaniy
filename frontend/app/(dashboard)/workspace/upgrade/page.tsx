'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UpgradeButton } from '@/components/workspace/upgrade-button';
import { workspacesApi, billingApi } from '@/lib/api/client';
import type { WorkspaceDetails, BillingSubscriptionStatus } from '@/lib/api/client';

/**
 * Upgrade page — workspace subscription management.
 *
 * States: loading, error (with retry), empty (no workspace), and the upgrade form.
 */
export default function UpgradePage() {
  const router = useRouter();

  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [subscription, setSubscription] = useState<BillingSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const ws = await workspacesApi.getMyWorkspace();
      setWorkspace(ws);

      const sub = await billingApi.getSubscriptionStatus(ws.id);
      setSubscription(sub);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load subscription data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadData} variant="outline">
              Retry
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="ghost"
              className="ml-2"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty state (no workspace) ────────────────────────────────────────
  if (!workspace) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>No Workspace Found</CardTitle>
            <CardDescription>
              Please create a workspace before upgrading your subscription.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/workspace/settings')} variant="outline">
              Go to Workspace Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your {workspace.name} subscription
        </p>
      </div>

      <UpgradeButton
        workspaceId={workspace.id}
        subscriptionStatus={subscription?.status ?? 'FREE'}
        subscription={subscription}
      />

      {/* Go back */}
      <div className="flex justify-center">
        <Button
          onClick={() => router.push('/workspace/settings')}
          variant="link"
          className="text-sm text-muted-foreground"
        >
          ← Back to Workspace Settings
        </Button>
      </div>
    </div>
  );
}
