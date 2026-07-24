import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UploadForm from '../upload-form';

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderForm(props?: Partial<UploadFormProps>) {
  return render(
    <UploadForm
      onSubmit={vi.fn()}
      loading={false}
      hasFile={true}
      {...props}
    />,
  );
}

import type { UploadFormProps } from '../upload-form';

/**
 * Finds the form element and fires a submit event on it.
 * This is more reliable than clicking a submit button in jsdom,
 * especially when the button may be disabled.
 */
function submitForm() {
  const form = document.querySelector('form');
  if (!form) throw new Error('Form not found');
  fireEvent.submit(form);
}

describe('UploadForm', () => {
  // ── AC-3: Form submission ───────────────────────────────────────────────

  describe('AC-3: Form submission', () => {
    it('calls onSubmit with form data when submitted with valid title', () => {
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      fireEvent.change(screen.getByLabelText(/title/i), {
        target: { value: 'My Document' },
      });
      submitForm();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Document',
          description: '',
          protectionConfig: expect.objectContaining({
            watermark_enabled: true,
            max_concurrent_sessions: 2,
            allow_text_selection: false,
          }),
        }),
      );
    });

    it('does not call onSubmit when title is empty', () => {
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      submitForm();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('Title is required.')).toBeInTheDocument();
    });

    it('does not call onSubmit when title is too short', () => {
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      fireEvent.change(screen.getByLabelText(/title/i), {
        target: { value: 'Ab' },
      });
      submitForm();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(
        screen.getByText('Title must be at least 3 characters.'),
      ).toBeInTheDocument();
    });

    it('disables submit button when hasFile is false', () => {
      renderForm({ hasFile: false });

      expect(
        screen.getByRole('button', { name: 'Upload Document' }),
      ).toBeDisabled();
    });
  });

  // ── AC-5: DRM settings ──────────────────────────────────────────────────

  describe('AC-5: DRM settings', () => {
    it('includes protection config values in the submission', () => {
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      // Open DRM settings
      fireEvent.click(screen.getByText('DRM Settings'));

      // Change max sessions
      const slider = screen.getByLabelText(/max concurrent sessions/i);
      fireEvent.change(slider, { target: { value: '5' } });

      // Uncheck watermark
      const watermarkCheckbox = screen.getByLabelText(/enable watermark/i);
      fireEvent.click(watermarkCheckbox);

      // Check allow text selection
      const textSelectionCheckbox = screen.getByLabelText(/allow text selection/i);
      fireEvent.click(textSelectionCheckbox);

      // Submit
      fireEvent.change(screen.getByLabelText(/title/i), {
        target: { value: 'Test Doc' },
      });
      submitForm();

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Doc',
          protectionConfig: {
            watermark_enabled: false,
            max_concurrent_sessions: 5,
            allow_text_selection: true,
          },
        }),
      );
    });
  });

  // ── Description field ────────────────────────────────────────────────────

  describe('Description field', () => {
    it('shows character count for description', () => {
      renderForm();

      const textarea = screen.getByPlaceholderText(/brief description/i);
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      expect(screen.getByText('5/1000')).toBeInTheDocument();
    });
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('has proper labels for form fields', () => {
      renderForm();

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/description/i),
      ).toBeInTheDocument();
    });

    it('shows hint when no file is selected', () => {
      renderForm({ hasFile: false });

      expect(
        screen.getByText('Select a file to enable upload'),
      ).toBeInTheDocument();
    });
  });
});
