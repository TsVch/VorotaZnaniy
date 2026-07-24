'use client';

import { useCallback, useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { cn } from '@/lib/utils';
import { validateFile, formatFileSize, type FileValidationResult } from '@/lib/upload';

export interface FileDropzoneProps {
  /** Called when a valid file is selected */
  onFileSelected: (file: File) => void;
  /** Called when the selected file is removed */
  onFileRemoved: () => void;
  /** Currently selected file (optional, for controlled state) */
  selectedFile: File | null;
  /** Validation result from parent (optional, for error display) */
  validationResult: FileValidationResult | null;
}

/**
 * Drag-and-drop zone for selecting a PDF file.
 *
 * Supports both drag-and-drop and click-to-browse.
 * Validates file type and size on selection.
 * Shows visual feedback on drag-over and error states.
 */
export default function FileDropzone({
  onFileSelected,
  onFileRemoved,
  selectedFile,
  validationResult,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalError, setInternalError] = useState<FileValidationResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        const result = validateFile(file);
        setInternalError(result.valid ? null : result);
        onFileSelected(file);
      }
    },
    [onFileSelected],
  );

  // ── Click/browse handler ───────────────────────────────────────────────────

  const handleBrowseClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const result = validateFile(file);
        setInternalError(result.valid ? null : result);
        onFileSelected(file);
      }
      // Reset input so re-selecting the same file triggers onChange
      e.target.value = '';
    },
    [onFileSelected],
  );

  const handleRemove = useCallback(() => {
    setInternalError(null);
    onFileRemoved();
  }, [onFileRemoved]);

  // Show either parent-provided error or internal validation error
  const displayError = validationResult?.valid === false
    ? validationResult
    : internalError;
  const hasError = displayError !== null && !displayError.valid;

  return (
    <div className="space-y-2">
      {/* ── Hidden file input ────────────────────────────────────────────── */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileInput}
        aria-hidden="true"
        data-testid="file-input"
      />

      {/* ── Drop zone ────────────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Select a PDF file to upload"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleBrowseClick();
        }}
        onClick={handleBrowseClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all',
          isDragOver &&
            'border-primary bg-primary/5 ring-2 ring-primary/20',
          !isDragOver && !selectedFile && !hasError &&
            'border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/30',
          hasError && 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/10',
          selectedFile && !hasError && 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-900/10',
        )}
      >
        {selectedFile ? (
          // ── Selected file display ────────────────────────────────────────
          <div className="flex flex-col items-center gap-2">
            <svg
              className="size-10 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-red-500"
              aria-label="Remove selected file"
            >
              Remove file
            </button>
          </div>
        ) : (
          // ── Empty state ──────────────────────────────────────────────────
          <>
            <svg
              className="size-10 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className="mt-2 text-sm font-medium">
              Drag & drop your PDF here
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or <span className="text-primary underline underline-offset-2">browse</span> to select a file
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              PDF only &middot; Max 500 MB
            </p>
          </>
        )}
      </div>

      {/* ── Error message ────────────────────────────────────────────────── */}
      {hasError && displayError?.error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
          <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          {displayError.error.message}
        </p>
      )}
    </div>
  );
}
