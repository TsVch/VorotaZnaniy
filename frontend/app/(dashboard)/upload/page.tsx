'use client';

import { useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { documentsApi } from '@/lib/api/client';
import FileDropzone from '@/components/upload/file-dropzone';
import UploadForm from '@/components/upload/upload-form';
import UploadProgress from '@/components/upload/upload-progress';
import type { UploadFormData } from '@/components/upload/upload-form';
import type { FileValidationResult } from '@/lib/upload';

// ── Upload step enum ────────────────────────────────────────────────────────

type UploadStep = 'FORM' | 'INIT' | 'UPLOADING' | 'COMPLETING' | 'DONE' | 'ERROR';

/**
 * Upload page — full document upload flow.
 *
 * Flow: Select file → Fill metadata → uploadInit → S3 PUT → uploadComplete
 */
export default function UploadPage() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<FileValidationResult | null>(null);
  const [step, setStep] = useState<UploadStep>('FORM');
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Store data across steps without re-renders
  const uploadUrlRef = useRef<string | null>(null);

  // ── File handlers ──────────────────────────────────────────────────────────

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setValidationResult(null);
    setError(null);
  }, []);

  const handleFileRemoved = useCallback(() => {
    setSelectedFile(null);
    setValidationResult(null);
  }, []);

  // ── Upload flow ────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (formData: UploadFormData) => {
      if (!selectedFile) return;

      setStep('INIT');
      setError(null);
      setProgress(0);
      setLabel('Initializing upload...');

      try {
        // ── Step 1: uploadInit ─────────────────────────────────────────────
        const initResponse = await documentsApi.uploadInit({
          title: formData.title,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type || 'application/pdf',
          protection_config: formData.protectionConfig,
        });

        uploadUrlRef.current = initResponse.upload_url;
        setProgress(10);
        setLabel('Uploading to storage...');

        // ── Step 2: S3 upload with progress ────────────────────────────────
        setStep('UPLOADING');
        await uploadFileToS3(initResponse.upload_url, selectedFile, (pct) => {
          // Scale progress: 10% → 90%
          setProgress(10 + Math.round(pct * 0.8));
        });

        setProgress(90);
        setLabel('Finalizing upload...');

        // ── Step 3: uploadComplete ─────────────────────────────────────────
        setStep('COMPLETING');
        await documentsApi.uploadComplete(initResponse.document_id);

        setProgress(100);
        setLabel('Upload complete!');
        setStep('DONE');

        // ── Step 4: redirect to dashboard ──────────────────────────────────
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (err) {
        setStep('ERROR');
        setError(
          err instanceof Error ? err.message : 'Upload failed. Please try again.',
        );
        setLabel('Upload failed');
      }
    },
    [selectedFile, router],
  );

  // ── Retry ──────────────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    setStep('FORM');
    setError(null);
    setProgress(0);
    setLabel('');
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isProcessing = step !== 'FORM' && step !== 'ERROR';
  const showForm = step === 'FORM';
  const showProgress = isProcessing || step === 'ERROR';

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload Document
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a PDF document to make it available for secure viewing and AI-powered analysis.
        </p>
      </div>

      {/* ── File dropzone (always visible) ──────────────────────────────── */}
      <FileDropzone
        selectedFile={selectedFile}
        onFileSelected={handleFileSelected}
        onFileRemoved={handleFileRemoved}
        validationResult={validationResult}
      />

      {/* ── Form (visible only before upload starts) ──────────────────────── */}
      {showForm && (
        <UploadForm
          onSubmit={handleSubmit}
          loading={false}
          hasFile={selectedFile !== null}
        />
      )}

      {/* ── Progress / Error (visible during/after upload) ────────────────── */}
      {showProgress && (
        <div className="space-y-4">
          <UploadProgress
            percent={progress}
            label={label}
            error={error}
          />

          {/* Post-upload action buttons */}
          {step === 'DONE' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {step === 'ERROR' && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleRetry}
                className="text-sm font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── S3 Upload helper ─────────────────────────────────────────────────────────

/**
 * Uploads a file directly to S3 via presigned PUT URL with progress tracking.
 *
 * Uses XMLHttpRequest for `progress` event support (fetch does not provide
 * upload progress natively).
 */
function uploadFileToS3(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // ── Progress tracking ──────────────────────────────────────────────────
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = event.loaded / event.total;
        onProgress(percent);
      }
    });

    // ── Completion ─────────────────────────────────────────────────────────
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `S3 upload failed with status ${xhr.status}: ${xhr.statusText}`,
          ),
        );
      }
    });

    // ── Error ──────────────────────────────────────────────────────────────
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during S3 upload.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('S3 upload was aborted.'));
    });

    // ── Execute ────────────────────────────────────────────────────────────
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}
