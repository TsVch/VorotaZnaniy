'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ProtectionConfig } from '@/lib/api/client';

// ── Types ───────────────────────────────────────────────────────────────────

export interface UploadFormData {
  title: string;
  description: string;
  protectionConfig: ProtectionConfig;
}

export interface UploadFormProps {
  /** Called with form data when the user submits */
  onSubmit: (data: UploadFormData) => void;
  /** Whether the form is in a loading state (upload in progress) */
  loading: boolean;
  /** Whether a file is selected (controls submit availability) */
  hasFile: boolean;
}

interface FormErrors {
  title?: string;
}

// ── Default DRM config ──────────────────────────────────────────────────────

const DEFAULT_PROTECTION: ProtectionConfig = {
  watermark_enabled: true,
  max_concurrent_sessions: 2,
  allow_text_selection: false,
};

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Upload form with metadata fields and expandable DRM settings.
 */
export default function UploadForm({
  onSubmit,
  loading,
  hasFile,
}: UploadFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [protection, setProtection] = useState<ProtectionConfig>(DEFAULT_PROTECTION);
  const [showDrm, setShowDrm] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

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

    return errs;
  }, [title]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const errs = validate();
      setErrors(errs);

      if (Object.keys(errs).length > 0) return;

      onSubmit({
        title: title.trim(),
        description: description.trim(),
        protectionConfig: protection,
      });
    },
    [title, description, protection, validate, onSubmit],
  );

  const canSubmit = hasFile && !loading && title.trim().length >= 3;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Title (required) ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label htmlFor="doc-title" className="text-sm font-medium">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="doc-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="Enter document title"
          maxLength={255}
          disabled={loading}
          className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
        />
        {errors.title && (
          <p id="title-error" className="text-xs text-red-600 dark:text-red-400" role="alert">
            {errors.title}
          </p>
        )}
      </div>

      {/* ── Description (optional) ─────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label htmlFor="doc-description" className="text-sm font-medium">
          Description <span className="text-muted-foreground text-xs">(optional)</span>
        </label>
        <textarea
          id="doc-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the document"
          maxLength={1000}
          rows={3}
          disabled={loading}
          className="block w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground text-right">
          {description.length}/1000
        </p>
      </div>

      {/* ── DRM Settings (expandable) ──────────────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <button
          type="button"
          onClick={() => setShowDrm(!showDrm)}
          className="flex w-full items-center justify-between text-sm font-medium"
          aria-expanded={showDrm}
          aria-controls="drm-settings"
        >
          <span>DRM Settings</span>
          <svg
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              showDrm && 'rotate-180',
            ) as string}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {showDrm && (
          <div id="drm-settings" className="space-y-3 pt-2">
            {/* Watermark */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={protection.watermark_enabled}
                onChange={(e) =>
                  setProtection((prev) => ({
                    ...prev,
                    watermark_enabled: e.target.checked,
                  }))
                }
                disabled={loading}
                className="size-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-sm">Enable watermark overlay</span>
            </label>

            {/* Allow text selection */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={protection.allow_text_selection}
                onChange={(e) =>
                  setProtection((prev) => ({
                    ...prev,
                    allow_text_selection: e.target.checked,
                  }))
                }
                disabled={loading}
                className="size-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-sm">Allow text selection</span>
            </label>

            {/* Max concurrent sessions */}
            <div className="space-y-1.5">
              <label htmlFor="max-sessions" className="text-sm text-muted-foreground">
                Max concurrent sessions: <span className="font-medium text-foreground">{protection.max_concurrent_sessions}</span>
              </label>
              <input
                id="max-sessions"
                type="range"
                min={1}
                max={5}
                step={1}
                value={protection.max_concurrent_sessions}
                onChange={(e) =>
                  setProtection((prev) => ({
                    ...prev,
                    max_concurrent_sessions: Number(e.target.value),
                  }))
                }
                disabled={loading}
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Submit ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {loading ? 'Uploading...' : 'Upload Document'}
        </Button>
        {!hasFile && (
          <span className="text-xs text-muted-foreground">
            Select a file to enable upload
          </span>
        )}
      </div>
    </form>
  );
}


