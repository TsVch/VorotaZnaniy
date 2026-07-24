'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, FileText, Mail, User } from 'lucide-react';

import type { WorkspaceDetails } from '@/lib/api/client';

export interface WorkspaceSettingsFormProps {
  /** Current workspace details */
  workspace: WorkspaceDetails;
  /** Called when Save is clicked with the new name */
  onSave: (name: string) => Promise<void>;
  /** Called when Cancel is clicked */
  onCancel: () => void;
}

/**
 * Workspace settings form with name editing, owner info, and stats.
 *
 * AC-1: Displays current workspace name, owner email, and document count.
 * AC-2: Saves new name on submit and shows success message.
 * AC-3: Validates name length (3–50 chars) before submitting.
 */
export function WorkspaceSettingsForm({
  workspace,
  onSave,
  onCancel,
}: WorkspaceSettingsFormProps) {
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset when workspace prop changes (e.g. after save re-fetch)
  const [key] = useState(workspace.updatedAt);

  const hasChanges = name.trim() !== workspace.name;

  const validate = useCallback((): boolean => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setValidationError('Workspace name must be at least 3 characters');
      return false;
    }
    if (trimmed.length > 50) {
      setValidationError('Workspace name must be at most 50 characters');
      return false;
    }
    setValidationError(null);
    return true;
  }, [name]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);

    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(name.trim());
      setSuccessMessage('Workspace settings saved successfully');
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to save workspace settings',
      );
    } finally {
      setSaving(false);
    }
  }, [name, onSave, validate]);

  return (
    <div className="space-y-6" key={key}>
      {/* ── Success / Error messages ──────────────────────────────────── */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Workspace Name ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workspace Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setName(e.target.value);
                setValidationError(null);
              }}
              placeholder="My Workspace"
              maxLength={50}
              aria-invalid={validationError ? 'true' : undefined}
              aria-describedby={validationError ? 'name-error' : undefined}
            />
            {validationError && (
              <p id="name-error" className="text-sm text-red-500">
                {validationError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {name.trim().length}/50 characters
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges || !!validationError}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Owner Information ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Owner Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{workspace.owner.email}</span>
          </div>
          {workspace.owner.name && (
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{workspace.owner.name}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Workspace Stats ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workspace Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              {workspace.documentCount}{' '}
              {workspace.documentCount === 1 ? 'document' : 'documents'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
