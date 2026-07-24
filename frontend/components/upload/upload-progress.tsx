'use client';

import { cn } from '@/lib/utils';

interface UploadProgressProps {
  /** Upload progress percentage (0–100) */
  percent: number;
  /** Current step description */
  label: string;
  /** Whether the upload is in an error state */
  error: string | null;
}

/**
 * Progress bar for the document upload flow.
 */
export default function UploadProgress({
  percent,
  label,
  error,
}: UploadProgressProps) {
  // Clamp between 0 and 100
  const clampedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {error ? null : (
          <span className="font-medium tabular-nums text-foreground">
            {clampedPercent}%
          </span>
        )}
      </div>

      {/* ── Progress bar track ──────────────────────────────────────────── */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={clampedPercent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            error ? 'bg-red-500' : 'bg-primary',
          )}
          style={{ width: `${error ? 100 : clampedPercent}%` }}
        />
      </div>

      {/* ── Error message ───────────────────────────────────────────────── */}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
          <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
