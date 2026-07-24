'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { QaSourceItem } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessageData {
  /** 'user' or 'assistant' */
  role: 'user' | 'assistant';
  /** Message text content */
  content: string;
  /** Source citations (assistant messages only) */
  sources?: QaSourceItem[];
}

export interface ChatMessageProps {
  message: ChatMessageData;
  /** Callback when user clicks a source citation — parent can navigate canvas */
  onSourceClick?: (source: QaSourceItem) => void;
}

// ── Citation parsing ───────────────────────────────────────────────────────

/** Regex to find [N] citation markers (e.g., [1], [12]). */
const CITATION_RE = /\[(\d+)\]/g;

/**
 * Renders message text with clickable [N] citation markers.
 * Uses a simple split + fragment approach to avoid dangerouslySetInnerHTML.
 */
function renderWithCitations(
  text: string,
  sources: QaSourceItem[] | undefined,
  onSourceClick: (source: QaSourceItem) => void,
): React.ReactNode[] {
  if (!sources || sources.length === 0) {
    // No citations — return plain text with word wrapping
    return [<span key="0">{text}</span>];
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  // Reset regex state
  CITATION_RE.lastIndex = 0;

  while ((match = CITATION_RE.exec(text)) !== null) {
    // Add text before the citation marker
    if (match.index > lastIndex) {
      parts.push(
        <span key={keyCounter++}>
          {text.slice(lastIndex, match.index)}
        </span>,
      );
    }

    const citationNum = Number.parseInt(match[1], 10);
    const sourceIndex = citationNum - 1;
    const source = sourceIndex >= 0 && sourceIndex < sources.length
      ? sources[sourceIndex]
      : null;

    if (source) {
      parts.push(
        <button
          key={keyCounter++}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onSourceClick(source);
          }}
          className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          aria-label={`View source ${citationNum}`}
          title={source.text.slice(0, 100)}
        >
          [{citationNum}]
        </button>,
      );
    } else {
      // Out-of-range citation — render as plain text
      parts.push(<span key={keyCounter++}>[{citationNum}]</span>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last citation
  if (lastIndex < text.length) {
    parts.push(
      <span key={keyCounter++}>{text.slice(lastIndex)}</span>,
    );
  }

  return parts;
}

// ── Source tooltip ─────────────────────────────────────────────────────────

function SourceTooltip({
  source,
  onClose,
}: {
  source: QaSourceItem;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute z-50 bottom-full left-0 mb-2 w-72 p-3 rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
      role="tooltip"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Source chunk #{source.chunkIndex}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close source preview"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <p className="text-xs leading-relaxed line-clamp-6 text-foreground/80">
        {source.text}
      </p>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * ChatMessage — Renders a single chat message with role-based styling
 * and clickable source citation markers.
 *
 * User messages are right-aligned; assistant messages are left-aligned
 * with citation markers that reveal source previews on click.
 * When onSourceClick is provided, clicking a citation also notifies the
 * parent (e.g., to navigate the canvas to the source page).
 *
 * @example
 * ```tsx
 * <ChatMessage
 *   message={{
 *     role: 'assistant',
 *     content: 'According to [1], the answer is...',
 *     sources: [{ chunkIndex: 0, text: 'Document chunk...' }],
 *   }}
 *   onSourceClick={(source) => canvas.navigate(source.pageNumber)}
 * />
 * ```
 */
export default function ChatMessage({ message, onSourceClick }: ChatMessageProps) {
  const [activeSource, setActiveSource] = useState<QaSourceItem | null>(null);
  const isUser = message.role === 'user';

  const handleSourceClick = useCallback(
    (source: QaSourceItem) => {
      // Show local tooltip
      setActiveSource((prev) =>
        prev?.chunkIndex === source.chunkIndex &&
        prev?.text === source.text
          ? null
          : source,
      );
      // Notify parent (canvas page navigation etc.)
      onSourceClick?.(source);
    },
    [onSourceClick],
  );

  return (
    <div
      className={cn(
        'flex w-full gap-3 py-3',
        isUser ? 'justify-end' : 'justify-start',
      )}
      role="listitem"
    >
      {/* ── Avatar / Icon ─────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-primary text-primary-foreground order-last'
            : 'bg-secondary text-secondary-foreground',
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        )}
      </div>

      {/* ── Message Bubble ────────────────────────────────────────────── */}
      <div
        className={cn(
          'relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-secondary text-secondary-foreground rounded-tl-sm',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="whitespace-pre-wrap">
            {renderWithCitations(
              message.content,
              message.sources,
              handleSourceClick,
            )}
          </div>
        )}

        {/* ── Source Tooltip ──────────────────────────────────────────── */}
        {activeSource && (
          <SourceTooltip
            source={activeSource}
            onClose={() => setActiveSource(null)}
          />
        )}
      </div>
    </div>
  );
}
