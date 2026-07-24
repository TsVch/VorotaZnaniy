'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { WorkspaceSettingsForm } from '@/components/workspace/workspace-settings-form';
import { workspacesApi } from '@/lib/api/client';
import type { WorkspaceDetails } from '@/lib/api/client';

/**
 * Workspace Settings page.
 *
 * Loads workspace details on mount and renders the settings form.
 * Handles loading, error, and empty auth states.
 */
export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await workspacesApi.getMyWorkspace();
      setWorkspace(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load workspace settings',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const handleSave = useCallback(
    async (name: string) => {
      if (!workspace) return;
      const updated = await workspacesApi.update(workspace.id, { name });
      setWorkspace(updated);
    },
    [workspace],
  );

  const handleCancel = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  // ── Loading State ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-28" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Error State ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Workspace Settings
          </h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchWorkspace}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty State (no workspace) ──────────────────────────────────────
  if (!workspace) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Workspace Settings
        </h1>
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No workspace found.
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Form State ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Workspace Settings
        </h1>
      </div>

      <WorkspaceSettingsForm
        workspace={workspace}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
