'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ProtectionConfig } from '@/lib/api/client';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DocumentSettingsFormProps {
  /** Current document title */
  title: string;
  /** Current document description */
  description: string | null;
  /** Current DRM protection config */
  protectionConfig: ProtectionConfig;
  /** Whether data is being saved */
  saving: boolean;
  /** Called with updated values when Save is clicked */
  onSave: (data: {
    title: string;
    description: string;
    protectionConfig: Partial<ProtectionConfig>;
  }) => void;
  /** Called when Cancel is clicked */
  onCancel: () => void;
}

interface FormErrors {
  title?: string;
  watermarkText?: string;
  protectionConfig?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Settings form for editing document metadata and DRM protection.
 *
 * DRM section features:
 * - Watermark toggle + custom text input (max 50 chars, placeholder with {user_email})
 * - Max concurrent sessions slider (1–10) with tooltip
 * - Allow text selection toggle with warning
 * - Allow download toggle (disabled for MVP — always forced to false on backend)
 * - Diff detection: Save button disabled when no changes detected
 */
export default function DocumentSettingsForm({
  title: initialTitle,
  description: initialDescription,
  protectionConfig: initialConfig,
  saving,
  onSave,
  onCancel,
}: DocumentSettingsFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [protection, setProtection] = useState<ProtectionConfig>({
    ...initialConfig,
    watermark_text: initialConfig.watermark_text ?? '',
  });
  const [showDrm, setShowDrm] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      errs.title = 'Title is required.';
    } else if (trimmedTitle.length < 3) {
      errs.title = 'Title must be at least 3 characters.';
    } else if (trimmedTitle.length > 255) {
      errs.title = 'Title must be 255 characters or fewer.';
    }

    if (protection.watermark_enabled && !protection.watermark_text) {
      errs.watermarkText = 'Watermark text is required when watermark is enabled.';
    } else if (protection.watermark_text && protection.watermark_text.length > 50) {
      errs.watermarkText = 'Watermark text must be 50 characters or fewer.';
    }

    if (
      protection.max_concurrent_sessions < 1 ||
      protection.max_concurrent_sessions > 10
    ) {
      errs.protectionConfig = 'Max sessions must be between 1 and 10.';
    }

    return errs;
  }, [title, protection]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSuccessMessage(null);

      const errs = validate();
      setErrors(errs);

      if (Object.keys(errs).length > 0) return;

      // Build the patch — only include changed values
      const patch: {
        title: string;
        description: string;
        protectionConfig: Partial<ProtectionConfig>;
      } = {
        title: title.trim(),
        description: description.trim(),
        protectionConfig: {},
      };

      // Only include DRM fields that actually changed
      if (protection.watermark_enabled !== initialConfig.watermark_enabled) {
        patch.protectionConfig.watermark_enabled = protection.watermark_enabled;
      }
      if (protection.watermark_text !== (initialConfig.watermark_text ?? '')) {
        patch.protectionConfig.watermark_text = protection.watermark_text || undefined;
      }
      if (protection.max_concurrent_sessions !== initialConfig.max_concurrent_sessions) {
        patch.protectionConfig.max_concurrent_sessions =
          protection.max_concurrent_sessions;
      }
      if (protection.allow_text_selection !== initialConfig.allow_text_selection) {
        patch.protectionConfig.allow_text_selection =
          protection.allow_text_selection;
      }
      if (protection.allow_download !== initialConfig.allow_download) {
        patch.protectionConfig.allow_download = protection.allow_download;
      }

      // Remove empty protectionConfig if nothing changed
      if (Object.keys(patch.protectionConfig).length === 0) {
        delete (patch as Record<string, unknown>).protectionConfig;
      }

      onSave(patch);
      setSuccessMessage('Settings saved successfully');
    },
    [title, description, protection, initialConfig, validate, onSave],
  );

  const hasChanges =
    title !== initialTitle ||
    description !== (initialDescription ?? '') ||
    protection.watermark_enabled !== initialConfig.watermark_enabled ||
    protection.watermark_text !== (initialConfig.watermark_text ?? '') ||
    protection.max_concurrent_sessions !==
      initialConfig.max_concurrent_sessions ||
    protection.allow_text_selection !== initialConfig.allow_text_selection ||
    protection.allow_download !== initialConfig.allow_download;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* ── Success message ─────────────────────────────────────────────── */}
      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
        >
          {successMessage}
        </div>
      )}

      {/* ── Title (required) ────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label htmlFor="settings-title" className="text-sm font-medium">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="settings-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title)
              setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="Document title"
          maxLength={255}
          disabled={saving}
          className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'settings-title-error' : undefined}
        />
        {errors.title && (
          <p
            id="settings-title-error"
            className="text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {errors.title}
          </p>
        )}
      </div>

      {/* ── Description (optional) ───────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label htmlFor="settings-description" className="text-sm font-medium">
          Description{' '}
          <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="settings-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Document description"
          maxLength={1000}
          rows={3}
          disabled={saving}
          className="block w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
        />
        <p className="text-right text-xs text-muted-foreground">
          {description.length}/1000
        </p>
      </div>

      {/* ── DRM Settings (expandable) ────────────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <button
          type="button"
          onClick={() => setShowDrm(!showDrm)}
          className="flex w-full items-center justify-between text-sm font-medium"
          aria-expanded={showDrm}
          aria-controls="settings-drm"
        >
          <span>DRM Settings</span>
          <svg
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              showDrm && 'rotate-180',
            )}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        {showDrm && (
          <div id="settings-drm" className="space-y-4 pt-2">
            {/* ── Watermark Section ────────────────────────────────────────── */}
            <div className="space-y-3 rounded-md bg-muted/30 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Watermark
              </h4>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={protection.watermark_enabled}
                  onChange={(e) =>
                    setProtection((prev) => ({
                      ...prev,
                      watermark_enabled: e.target.checked,
                    }))
                  }
                  disabled={saving}
                  className="size-4 rounded border-border text-primary focus:ring-primary/20"
                />
                <span className="text-sm">Enable dynamic watermark</span>
              </label>

              {protection.watermark_enabled && (
                <div className="space-y-1 pl-6">
                  <label
                    htmlFor="settings-watermark-text"
                    className="text-xs text-muted-foreground"
                  >
                    Watermark text{' '}
                    <span className="text-[10px]">(max 50 chars, supports {'{user_email}'})</span>
                  </label>
                  <input
                    id="settings-watermark-text"
                    type="text"
                    value={protection.watermark_text ?? ''}
                    onChange={(e) =>
                      setProtection((prev) => ({
                        ...prev,
                        watermark_text: e.target.value,
                      }))
                    }
                    placeholder="CONFIDENTIAL - {user_email}"
                    maxLength={50}
                    disabled={saving}
                    className="block w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                    aria-invalid={!!errors.watermarkText}
                    aria-describedby={
                      errors.watermarkText
                        ? 'settings-watermark-error'
                        : undefined
                    }
                  />
                  {errors.watermarkText && (
                    <p
                      id="settings-watermark-error"
                      className="text-xs text-red-600 dark:text-red-400"
                      role="alert"
                    >
                      {errors.watermarkText}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Default: <code>CONFIDENTIAL - {'{user_email}'}</code>
                  </p>
                </div>
              )}
            </div>

            {/* ── Access Control Section ──────────────────────────────────── */}
            <div className="space-y-3 rounded-md bg-muted/30 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Access Control
              </h4>

              {/* Max concurrent sessions */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="settings-max-sessions"
                    className="text-sm text-muted-foreground"
                  >
                    Max concurrent sessions
                  </label>
                  <span className="text-sm font-medium tabular-nums">
                    {protection.max_concurrent_sessions}
                  </span>
                </div>
                <input
                  id="settings-max-sessions"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={protection.max_concurrent_sessions}
                  onChange={(e) =>
                    setProtection((prev) => ({
                      ...prev,
                      max_concurrent_sessions: Number(e.target.value),
                    }))
                  }
                  disabled={saving}
                  className="w-full accent-primary"
                  title="Number of devices that can view this document simultaneously"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>1 device</span>
                  <span>10 devices</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  </svg>
                  Limits the number of devices that can read the document at the same time
                </p>
                {errors.protectionConfig && (
                  <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                    {errors.protectionConfig}
                  </p>
                )}
              </div>

              {/* Allow text selection */}
              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={protection.allow_text_selection}
                    onChange={(e) =>
                      setProtection((prev) => ({
                        ...prev,
                        allow_text_selection: e.target.checked,
                      }))
                    }
                    disabled={saving}
                    className="size-4 rounded border-border text-primary focus:ring-primary/20"
                  />
                  <span className="text-sm">Allow text selection</span>
                </label>
                <p className="text-xs text-muted-foreground pl-6 flex items-center gap-1">
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Enables copying text with visible watermark overlays
                </p>
              </div>

              {/* Allow download (disabled for MVP) */}
              <div className="space-y-1.5">
                <label className="flex cursor-not-allowed items-center gap-2 opacity-50">
                  <input
                    type="checkbox"
                    checked={protection.allow_download ?? false}
                    onChange={() => {
                      // Disabled for MVP — always forced to false on backend
                    }}
                    disabled={true}
                    className="size-4 rounded border-border text-primary focus:ring-primary/20"
                  />
                  <span className="text-sm">Allow download</span>
                </label>
                <p className="text-xs text-muted-foreground pl-6 flex items-center gap-1">
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Disabled for MVP — will be available in a future update
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving || !hasChanges}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
