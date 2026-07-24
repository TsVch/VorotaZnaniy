import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileDropzone from '../file-dropzone';

// ── Mock upload validation ──────────────────────────────────────────────────
// vi.hoisted() ensures the const is available during vi.mock() hoisting.
const { mockValidateFile } = vi.hoisted(() => ({
  mockValidateFile: vi.fn(),
}));

vi.mock('@/lib/upload', async () => {
  const actual = await vi.importActual<typeof import('@/lib/upload')>('@/lib/upload');
  return {
    ...actual,
    validateFile: mockValidateFile,
  };
});

function createFile(name: string, size: number, type: string): File {
  return new File(['x'.repeat(size)], name, { type });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderDropzone(props?: Partial<import('../file-dropzone').FileDropzoneProps>) {
  return render(
    <FileDropzone
      onFileSelected={vi.fn()}
      onFileRemoved={vi.fn()}
      selectedFile={null}
      validationResult={null}
      {...props}
    />,
  );
}

describe('FileDropzone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── AC-1: File selection ─────────────────────────────────────────────────

  describe('AC-1: File selection', () => {
    it('displays file name and size when a file is selected', () => {
      const file = createFile('guide.pdf', 500_000, 'application/pdf');
      mockValidateFile.mockReturnValue({ valid: true, error: null });

      renderDropzone({ selectedFile: file });

      expect(screen.getByText('guide.pdf')).toBeInTheDocument();
      expect(screen.getByText('488.3 KB')).toBeInTheDocument();
      expect(screen.getByText('Remove file')).toBeInTheDocument();
    });

    it('does not show Remove file button when no file is selected', () => {
      mockValidateFile.mockReturnValue({ valid: true, error: null });
      renderDropzone({ selectedFile: null });

      expect(screen.queryByText('Remove file')).toBeNull();
      expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
    });

    it('calls onFileRemoved when Remove button is clicked', () => {
      const file = createFile('test.pdf', 1000, 'application/pdf');
      mockValidateFile.mockReturnValue({ valid: true, error: null });
      const onFileRemoved = vi.fn();

      renderDropzone({ selectedFile: file, onFileRemoved });
      fireEvent.click(screen.getByText('Remove file'));

      expect(onFileRemoved).toHaveBeenCalledTimes(1);
    });
  });

  // ── AC-2: File validation errors ─────────────────────────────────────────

  describe('AC-2: File validation errors', () => {
    it('displays error message when validation fails (parent-provided)', () => {
      mockValidateFile.mockReturnValue({ valid: false, error: null });

      renderDropzone({
        validationResult: {
          valid: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File is too large. Maximum size is 500 MB.',
          },
        },
      });

      expect(
        screen.getByText('File is too large. Maximum size is 500 MB.'),
      ).toBeInTheDocument();
    });

    it('does not show error when validation passes', () => {
      mockValidateFile.mockReturnValue({ valid: true, error: null });

      renderDropzone({
        validationResult: { valid: true, error: null },
      });

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  // ── Internal validation error surfacing ─────────────────────────────────

  describe('Internal validation error surfacing', () => {
    it('shows error when an invalid file is selected via file input', () => {
      const file = createFile('bad.txt', 100, 'text/plain');
      mockValidateFile.mockReturnValue({
        valid: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'File must be a PDF.',
        },
      });

      const onFileSelected = vi.fn();
      renderDropzone({ onFileSelected });

      // Simulate selecting a file via the hidden input
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [file] } });

      // The error should surface in the UI
      expect(screen.getByText('File must be a PDF.')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(onFileSelected).toHaveBeenCalledWith(file);
    });

    it('still calls onFileSelected for invalid files', () => {
      const file = createFile('bad.txt', 100, 'text/plain');
      mockValidateFile.mockReturnValue({
        valid: false,
        error: { code: 'INVALID_TYPE', message: 'File must be a PDF.' },
      });

      const onFileSelected = vi.fn();
      renderDropzone({ onFileSelected });

      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [file] } });

      expect(onFileSelected).toHaveBeenCalledWith(file);
    });
  });

  // ── Drag-and-drop visual feedback ────────────────────────────────────────

  describe('Drag-and-drop feedback', () => {
    it('shows correct placeholder text in empty state', () => {
      mockValidateFile.mockReturnValue({ valid: true, error: null });
      renderDropzone();

      expect(screen.getByText(/drag & drop your pdf/i)).toBeInTheDocument();
      expect(screen.getByText(/max 500 mb/i)).toBeInTheDocument();
    });

    it('has proper aria-label for accessibility', () => {
      mockValidateFile.mockReturnValue({ valid: true, error: null });
      renderDropzone();

      expect(
        screen.getByRole('button', { name: 'Select a PDF file to upload' }),
      ).toBeInTheDocument();
    });
  });
});
