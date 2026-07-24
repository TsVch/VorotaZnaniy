/**
 * Upload utility helpers — file validation, type checking, and size formatting.
 */

// ── Constants ───────────────────────────────────────────────────────────────

/** Maximum allowed file size: 500 MB */
export const MAX_FILE_SIZE = 500 * 1024 * 1024;

/** Only PDF files are accepted */
export const ALLOWED_MIME_TYPES = ['application/pdf'] as const;

export const ALLOWED_EXTENSIONS = ['.pdf'] as const;

// ── Types ───────────────────────────────────────────────────────────────────

export interface FileValidationError {
  code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'NO_FILE';
  message: string;
}

export interface FileValidationResult {
  valid: boolean;
  error: FileValidationError | null;
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates a file for upload: type and size constraints.
 *
 * @param file - The File object to validate
 * @returns Validation result with error details if invalid
 */
export function validateFile(file: File | null): FileValidationResult {
  if (!file) {
    return {
      valid: false,
      error: { code: 'NO_FILE', message: 'No file selected.' },
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    // Also check file extension as a fallback for browsers that don't set MIME correctly
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
      return {
        valid: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'File must be a PDF.',
        },
      };
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `File is too large. Maximum size is 500 MB. Your file is ${formatFileSize(file.size)}.`,
      },
    };
  }

  return { valid: true, error: null };
}

// ── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Formats a file size in bytes into a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
