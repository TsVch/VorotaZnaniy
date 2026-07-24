import type { DocStatus } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface DocumentStatusBadgeProps {
  status: DocStatus;
}

const statusConfig: Record<
  DocStatus,
  { label: string; className: string; icon: string }
> = {
  PROCESSING: {
    label: 'Processing',
    className:
      'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-400/20',
    icon: '⟳',
  },
  READY: {
    label: 'Ready',
    className:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/20',
    icon: '✓',
  },
  ERROR: {
    label: 'Error',
    className:
      'bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/20',
    icon: '✕',
  },
};

/**
 * Badge displaying the processing status of a document.
 */
export default function DocumentStatusBadge({
  status,
}: DocumentStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'PROCESSING' && 'animate-pulse',
        config.className,
      )}
    >
      <span
        className={cn(
          'text-[10px]',
          status === 'PROCESSING' && 'animate-spin inline-block',
        )}
        aria-hidden="true"
      >
        {config.icon}
      </span>
      {config.label}
    </span>
  );
}
