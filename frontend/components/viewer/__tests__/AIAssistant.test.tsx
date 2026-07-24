import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIAssistant from '../AIAssistant';
import { viewerApi, ApiError } from '@/lib/api/client';

// ── Mock scrollIntoView (jsdom doesn't implement it) ──────────────────────
Element.prototype.scrollIntoView = vi.fn();

// ── Mock the API client ────────────────────────────────────────────────────
vi.mock('@/lib/api/client', () => ({
  viewerApi: {
    askQuestion: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

describe('AIAssistant', () => {
  const mockDocumentId = 'doc-uuid-123';
  const mockOnClose = vi.fn();

  const defaultProps = {
    documentId: mockDocumentId,
    isOpen: true,
    onClose: mockOnClose,
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Render / visibility ─────────────────────────────────────────────────

  it('should render when isOpen is true', () => {
    render(<AIAssistant {...defaultProps} />);
    expect(
      screen.getByRole('dialog', { name: /AI Assistant/i }),
    ).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(<AIAssistant {...defaultProps} isOpen={false} />);
    expect(
      screen.queryByRole('dialog', { name: /AI Assistant/i }),
    ).not.toBeInTheDocument();
  });

  it('should show initial empty state with placeholder text', () => {
    render(<AIAssistant {...defaultProps} />);
    expect(
      screen.getByText(/Ask anything about this document/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Ask a question/i),
    ).toBeInTheDocument();
  });

  // ── AC-1: Successful question-answer cycle ──────────────────────────────

  it('AC-1: should send question and display assistant response', async () => {
    const mockAnswer = {
      answer: 'According to [1], the main topic is AI.',
      sources: [
        { chunkIndex: 0, text: 'This document covers artificial intelligence concepts.' },
      ],
    };
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockAnswer,
    );

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'What is the main topic?');

    const sendButton = screen.getByRole('button', { name: /send question/i });
    await user.click(sendButton);

    // Should call API with correct params
    expect(viewerApi.askQuestion).toHaveBeenCalledWith(
      mockDocumentId,
      'What is the main topic?',
    );

    // Should display assistant response
    await waitFor(() => {
      expect(screen.getByText(/main topic is AI/i)).toBeInTheDocument();
    });

    // Should display user message
    expect(screen.getByText('What is the main topic?')).toBeInTheDocument();
  });

  it('AC-1: should send on Enter key', async () => {
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockResolvedValue({
      answer: 'The answer.',
      sources: [],
    });

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'What is this?');

    // Send via Enter
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(viewerApi.askQuestion).toHaveBeenCalled();
    });
  });

  // ── AC-3: Rate limiting (429) ──────────────────────────────────────────

  it('AC-3: should show rate limit message on 429', async () => {
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError(429, 'Too Many Requests'),
    );

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'What is the main topic?');
    await user.click(screen.getByRole('button', { name: /send question/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Too many requests, please wait a minute/i),
      ).toBeInTheDocument();
    });
  });

  // ── AC-4: Error handling (500) ─────────────────────────────────────────

  it('AC-4: should show error message on API error', async () => {
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError(500, 'Internal Server Error'),
    );

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'What is the main topic?');
    await user.click(screen.getByRole('button', { name: /send question/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/AI service unavailable, please try again later/i),
      ).toBeInTheDocument();
    });
  });

  it('AC-4: should show network error on fetch failure', async () => {
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'What is the main topic?');
    await user.click(screen.getByRole('button', { name: /send question/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Network error/i),
      ).toBeInTheDocument();
    });
  });

  // ── AC-5: Accessibility ────────────────────────────────────────────────

  it('AC-5: should close on Escape key', async () => {
    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, '{Escape}');

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('AC-5: should have aria-label on close button', () => {
    render(<AIAssistant {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /close AI assistant/i }),
    ).toBeInTheDocument();
  });

  it('AC-5: should have role="log" on message container', () => {
    render(<AIAssistant {...defaultProps} />);
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  // ── Input validation ───────────────────────────────────────────────────

  it('should disable send button when input is empty', () => {
    render(<AIAssistant {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /send question/i }),
    ).toBeDisabled();
  });

  it('should disable send button while loading', async () => {
    // Return a promise that never resolves to keep loading state
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}),
    );

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'What is this?');

    const sendButton = screen.getByRole('button', { name: /send question/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(sendButton).toBeDisabled();
    });
  });

  it('should show character count', () => {
    render(<AIAssistant {...defaultProps} />);
    expect(screen.getByText(/0\/500/)).toBeInTheDocument();
  });

  // ── Source citation ────────────────────────────────────────────────────

  it('should display source citations in assistant response', async () => {
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockResolvedValue({
      answer: 'According to [1], the answer is yes.',
      sources: [
        { chunkIndex: 0, text: 'The document states the answer is yes.' },
      ],
    });

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'Is the answer yes?');
    await user.click(screen.getByRole('button', { name: /send question/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view source 1/i })).toBeInTheDocument();
    });
  });

  it('AC-2: should show source preview when citation is clicked', async () => {
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockResolvedValue({
      answer: 'According to [1], the answer is yes.',
      sources: [
        { chunkIndex: 0, text: 'The document states the answer is yes.' },
      ],
    });

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'Is the answer yes?');
    await user.click(screen.getByRole('button', { name: /send question/i }));

    // Click citation
    await waitFor(async () => {
      const citation = screen.getByRole('button', { name: /view source 1/i });
      await user.click(citation);
    });

    // Should show source preview
    expect(
      screen.getByText(/The document states the answer is yes/i),
    ).toBeInTheDocument();

    // Should show the chunk number
    expect(
      screen.getByText(/Source chunk #0/i),
    ).toBeInTheDocument();
  });

  // ── Error dismissal ────────────────────────────────────────────────────

  it('should allow dismissing error messages', async () => {
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError(500, 'Error'),
    );

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'What is this?');
    await user.click(screen.getByRole('button', { name: /send question/i }));

    await waitFor(async () => {
      const dismissButton = screen.getByText(/Dismiss/i);
      await user.click(dismissButton);
      expect(
        screen.queryByText(/AI service unavailable/i),
      ).not.toBeInTheDocument();
    });
  });

  // ── Reset chat ─────────────────────────────────────────────────────────

  it('should clear messages on reset', async () => {
    (viewerApi.askQuestion as ReturnType<typeof vi.fn>).mockResolvedValue({
      answer: 'Some answer.',
      sources: [],
    });

    const user = userEvent.setup();
    render(<AIAssistant {...defaultProps} />);

    // Send a question
    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await user.type(textarea, 'Question?');
    await user.click(screen.getByRole('button', { name: /send question/i }));

    // Wait for response
    await waitFor(() => {
      expect(screen.getByText('Some answer.')).toBeInTheDocument();
    });

    // Clear chat
    const resetButton = screen.getByRole('button', { name: /clear chat/i });
    await user.click(resetButton);

    // Should show empty state again
    expect(
      screen.getByText(/Ask anything about this document/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Some answer.')).not.toBeInTheDocument();
  });
});
