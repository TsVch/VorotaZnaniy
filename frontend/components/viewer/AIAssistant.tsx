'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { viewerApi, ApiError } from '@/lib/api/client';
import ChatMessage, { type ChatMessageData } from './ChatMessage';
import type { QaSourceItem } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AIAssistantProps {
  /** Document UUID */
  documentId: string;
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when the user closes the panel */
  onClose: () => void;
  /** Callback when user clicks a source citation — parent can navigate canvas to the source page */
  onSourceClick?: (source: QaSourceItem) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────

const MAX_QUESTION_LENGTH = 500;

/** Error message map for known API error statuses */
const ERROR_MESSAGES: Record<number, string> = {
  429: 'Too many requests, please wait a minute.',
  403: 'Access denied to this document.',
  400: 'Invalid question. Please rephrase and try again.',
  502: 'AI service temporarily unavailable.',
  503: 'AI service is overloaded. Please try again later.',
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * AIAssistant — Chat interface for asking questions about a document.
 *
 * Integrates with the RAG Q&A backend endpoint (TASK-004.5).
 * Supports:
 *  - Sending questions via Enter key (Shift+Enter for newline)
 *  - Auto-scrolling to latest messages
 *  - Error handling with contextual messages (429, 403, 500)
 *  - Source citation display via ChatMessage
 *  - onSourceClick callback for navigating the canvas to the cited page
 *  - Keyboard accessibility (Escape to close)
 *  - Responsive design
 *
 * @example
 * ```tsx
 * <AIAssistant
 *   documentId="doc-uuid-123"
 *   isOpen={true}
 *   onClose={() => setPanelOpen(false)}
 *   onSourceClick={(source) => navigateToPage(source.pageNumber)}
 * />
 * ```
 */
export default function AIAssistant({
  documentId,
  isOpen,
  onClose,
  onSourceClick,
}: AIAssistantProps) {
  // ── State ────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll to bottom when messages change ────────────────────────────
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // ── Focus textarea when panel opens ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    // Small delay to allow the panel animation
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // ── Lock body scroll when panel is open (mobile) ─────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ── Send question ────────────────────────────────────────────────────────
  const sendQuestion = useCallback(async () => {
    const question = inputValue.trim();
    if (!question || isLoading) return;

    setError(null);
    setIsLoading(true);

    // Add user message
    const userMessage: ChatMessageData = {
      role: 'user',
      content: question,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    try {
      const response = await viewerApi.askQuestion(documentId, question);

      const assistantMessage: ChatMessageData = {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      let errorMessage = 'AI service unavailable, please try again later.';

      if (err instanceof ApiError) {
        errorMessage =
          ERROR_MESSAGES[err.status] ??
          'AI service unavailable, please try again later.';
      } else if (err instanceof TypeError) {
        // Network error (fetch failed, CORS, etc.)
        errorMessage =
          'Network error. Please check your connection and try again.';
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, documentId]);

  // ── Handle key events ────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuestion();
      }
      if (e.key === 'Escape' && !e.shiftKey) {
        onClose();
      }
    },
    [sendQuestion, onClose],
  );

  // ── Auto-resize textarea ─────────────────────────────────────────────────
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_QUESTION_LENGTH) {
        setInputValue(value);
      }
    },
    [],
  );

  // ── Reset chat ───────────────────────────────────────────────────────────
  const handleResetChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setInputValue('');
  }, []);

  // ── Don't render anything when closed ────────────────────────────────────
  if (!isOpen) return null;

  const canSend = inputValue.trim().length >= 3 && !isLoading;

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex justify-end',
        'md:relative md:inset-auto md:z-auto',
      )}
      role="dialog"
      aria-modal="true"
      aria-label="AI Assistant"
    >
      {/* ── Backdrop (mobile only) ──────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Panel ───────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'relative flex flex-col w-full h-full',
          'md:w-96 md:h-full md:border-l md:border-border',
          'bg-background shadow-2xl md:shadow-none',
          'animate-in slide-in-from-right duration-300 ease-out',
        )}
        ref={inputContainerRef}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
            <h2 className="text-sm font-semibold">AI Assistant</h2>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleResetChat}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Clear chat history"
                title="Clear chat"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                  />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close AI Assistant"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
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
        </div>

        {/* ── Messages ─────────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-2"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          {messages.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <svg
                  className="h-8 w-8 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                Ask anything about this document
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Type a question below and get answers with source citations
                from the document content.
              </p>
            </div>
          )}

          <div className="flex flex-col">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} onSourceClick={onSourceClick} />
            ))}

            {/* ── Loading Indicator ──────────────────────────────────────── */}
            {isLoading && (
              <div className="flex items-start gap-3 py-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <svg
                    className="h-4 w-4 text-secondary-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                    />
                  </svg>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-sm bg-secondary text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="ml-1">Thinking...</span>
                </div>
              </div>
            )}

            {/* ── Error Message ──────────────────────────────────────────── */}
            {error && (
              <div className="flex items-start gap-3 py-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                  <svg
                    className="h-4 w-4 text-destructive"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 bg-destructive/10 text-destructive text-sm leading-relaxed">
                  <p className="font-medium mb-0.5">Error</p>
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="mt-1.5 text-xs underline hover:no-underline focus:outline-none"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input Area ────────────────────────────────────────────────── */}
        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this document..."
              maxLength={MAX_QUESTION_LENGTH}
              rows={1}
              className={cn(
                'flex-1 min-h-[40px] max-h-[120px] resize-none',
                'rounded-xl border border-input bg-transparent px-3 py-2.5',
                'text-sm placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:border-input',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              disabled={isLoading}
              aria-label="Your question"
              aria-describedby="char-count"
            />
            <button
              type="button"
              onClick={sendQuestion}
              disabled={!canSend}
              className={cn(
                'inline-flex items-center justify-center h-10 w-10 rounded-xl',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex-shrink-0',
              )}
              aria-label="Send question"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px] text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </span>
            <span
              id="char-count"
              className={cn(
                'text-[10px]',
                inputValue.length >= MAX_QUESTION_LENGTH
                  ? 'text-destructive'
                  : 'text-muted-foreground',
              )}
            >
              {inputValue.length}/{MAX_QUESTION_LENGTH}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
