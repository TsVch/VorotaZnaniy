import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentSettingsForm from '../document-settings-form';
import type { ProtectionConfig } from '@/lib/api/client';

// ── Fixtures ──────────────────────────────────────────────────────────────

const defaultProtection: ProtectionConfig = {
  watermark_enabled: true,
  watermark_text: 'CONFIDENTIAL',
  max_concurrent_sessions: 2,
  allow_text_selection: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────

import type { DocumentSettingsFormProps } from '../document-settings-form';

function renderForm(props?: Partial<DocumentSettingsFormProps>) {
  return render(
    <DocumentSettingsForm
      title="My Document"
      description="A test document"
      protectionConfig={defaultProtection}
      saving={false}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );
}

function submitForm() {
  const form = document.querySelector('form');
  if (!form) throw new Error('Form not found');
  fireEvent.submit(form);
}

function openDrmSettings() {
  fireEvent.click(screen.getByText('DRM Settings'));
}

describe('DocumentSettingsForm', () => {
  // ── AC-1: Load and display data ──────────────────────────────────────────

  describe('AC-1: Load and display data', () => {
    it('renders the current title value', () => {
      renderForm({ title: 'SEO Guide' });
      const input = screen.getByLabelText(/title/i) as HTMLInputElement;
      expect(input.value).toBe('SEO Guide');
    });

    it('renders the current description value', () => {
      renderForm({ description: 'A guide about SEO' });
      const textarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('A guide about SEO');
    });
  });

  // ── AC-2: Successful save ───────────────────────────────────────────────

  describe('AC-2: Successful save', () => {
    it('calls onSave with updated title when title is changed', () => {
      const onSave = vi.fn();
      renderForm({ onSave, title: 'Old Title' });

      const input = screen.getByLabelText(/title/i);
      fireEvent.change(input, { target: { value: 'New Title' } });
      submitForm();

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Title' }),
      );
    });

    it('shows success message after save', () => {
      renderForm({ onSave: vi.fn() });
      submitForm();
      expect(screen.getByText('Settings saved successfully')).toBeInTheDocument();
    });
  });

  // ── AC-3: DRM validation ─────────────────────────────────────────────────

  describe('AC-3: DRM validation', () => {
    it('rejects max_concurrent_sessions below 1 via initial config', () => {
      const invalidProtection: ProtectionConfig = {
        ...defaultProtection,
        max_concurrent_sessions: 0,
      };

      renderForm({ protectionConfig: invalidProtection });
      openDrmSettings();
      submitForm();

      expect(
        screen.getByText('Max sessions must be between 1 and 10.'),
      ).toBeInTheDocument();
    });

    it('rejects max_concurrent_sessions above 10 via initial config', () => {
      const invalidProtection: ProtectionConfig = {
        ...defaultProtection,
        max_concurrent_sessions: 11,
      };

      renderForm({ protectionConfig: invalidProtection });
      openDrmSettings();
      submitForm();

      expect(
        screen.getByText('Max sessions must be between 1 and 10.'),
      ).toBeInTheDocument();
    });

    it('rejects watermark text longer than 50 chars', () => {
      renderForm();
      openDrmSettings();

      const watermarkInput = screen.getByLabelText(/watermark text/i);
      fireEvent.change(watermarkInput, { target: { value: 'A'.repeat(51) } });
      submitForm();

      expect(
        screen.getByText('Watermark text must be 50 characters or fewer.'),
      ).toBeInTheDocument();
    });
  });

  // ── AC-4: Watermark text diff ───────────────────────────────────────────

  describe('AC-4: Watermark text diff', () => {
    it('includes watermark_text in the patch when changed', () => {
      const onSave = vi.fn();
      renderForm({
        onSave,
        protectionConfig: {
          ...defaultProtection,
          watermark_text: 'OLD TEXT',
        },
      });

      openDrmSettings();

      const watermarkInput = screen.getByLabelText(/watermark text/i);
      fireEvent.change(watermarkInput, { target: { value: 'NEW TEXT' } });
      submitForm();

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          protectionConfig: expect.objectContaining({
            watermark_text: 'NEW TEXT',
          }),
        }),
      );
    });

    it('does not include watermark_text in patch when unchanged', () => {
      const onSave = vi.fn();
      renderForm({
        onSave,
        title: 'Old Title',
      });

      const input = screen.getByLabelText(/title/i);
      fireEvent.change(input, { target: { value: 'New Title 2' } });
      submitForm();

      // protectionConfig should not be in the patch if only title changed
      expect(onSave).toHaveBeenCalledWith(
        expect.not.objectContaining({
          protectionConfig: expect.anything(),
        }),
      );
    });
  });

  // ── AC-5: Cancel ─────────────────────────────────────────────────────────

  describe('AC-5: Cancel', () => {
    it('calls onCancel when Cancel button is clicked', () => {
      const onCancel = vi.fn();
      renderForm({ onCancel });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ── Save button state ────────────────────────────────────────────────────

  describe('Save button', () => {
    it('is disabled when saving is true', () => {
      renderForm({ saving: true });
      expect(
        screen.getByRole('button', { name: 'Saving...' }),
      ).toBeDisabled();
    });

    it('is enabled when there are changes', () => {
      renderForm({ title: 'Old' });

      const input = screen.getByLabelText(/title/i);
      fireEvent.change(input, { target: { value: 'New Title' } });

      expect(
        screen.getByRole('button', { name: 'Save Changes' }),
      ).toBeEnabled();
    });
  });

  // ── DRM section toggle ──────────────────────────────────────────────────

  describe('DRM section toggle', () => {
    it('shows DRM fields when clicked', () => {
      renderForm();

      expect(screen.queryByLabelText(/enable watermark/i)).toBeNull();

      fireEvent.click(screen.getByText('DRM Settings'));

      expect(
        screen.getByLabelText(/enable dynamic watermark/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/allow text selection/i),
      ).toBeInTheDocument();
    });
  });

  // ── Allow download is disabled ──────────────────────────────────────────

  describe('Allow download (MVP)', () => {
    it('renders allow download checkbox as disabled', () => {
      renderForm();
      openDrmSettings();

      const checkbox = screen.getByLabelText(/allow download/i);
      expect(checkbox).toBeDisabled();
    });
  });
});
