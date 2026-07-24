'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SubscriptionManager } from '@/components/workspace/subscription-manager';
import { workspacesApi, billingApi } from '@/lib/api/client';
import type { WorkspaceDetails, BillingSubscriptionStatus } from '@/lib/api/client';

interface PaymentHistoryItem {
  providerTransactionId: string;
  eventType: string;
  amount: string;
  currency: string;
  isRecurring: boolean;
  processedAt: string;
}

interface SubscriptionHistoryResponse {
  payments: PaymentHistoryItem[];
  total: number;
  subscriptionStatus: string;
  nextBillingDate?: string;
  paymentMethod?: { type: string; last4?: string };
}

/**
 * Subscription management page.
 *
 * States: loading, error (retry), empty (no workspace), success (SubscriptionManager).
 */
export default function SubscriptionPage() {
  const router = useRouter();

  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [subscription, setSubscription] = useState<BillingSubscriptionStatus | null>(null);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const ws = await workspacesApi.getMyWorkspace();
      setWorkspace(ws);

      const [sub, hist] = await Promise.all([
        billingApi.getSubscriptionStatus(ws.id),
        billingApi.getSubscriptionHistory(ws.id).catch(() => ({
          payments: [],
          total: 0,
          subscriptionStatus: 'UNKNOWN',
        } as SubscriptionHistoryResponse)),
      ]);

      setSubscription(sub);
      setHistory(hist.payments ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load subscription data';
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
            <Button onClick={loadData} variant="outline">Retry</Button>
            <Button onClick={() => router.push('/dashboard')} variant="ghost" className="ml-2">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (!workspace || !subscription) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>No Workspace Found</CardTitle>
            <CardDescription>Please create a workspace to manage your subscription.</CardDescription>
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

      <SubscriptionManager
        workspaceId={workspace.id}
        subscription={subscription}
        paymentHistory={history}
        onCancelSuccess={loadData}
      />

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
