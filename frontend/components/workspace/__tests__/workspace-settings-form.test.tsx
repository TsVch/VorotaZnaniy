import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceSettingsForm } from '../workspace-settings-form';
import type { WorkspaceDetails } from '@/lib/api/client';

const defaultWorkspace: WorkspaceDetails = {
  id: 'ws-1',
  name: 'Test Workspace',
  slug: 'test-workspace',
  owner: { email: 'owner@test.com', name: 'Owner Name' },
  documentCount: 5,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
};

describe('WorkspaceSettingsForm', () => {
  it('renders workspace name, owner info, and document count', () => {
    render(
      <WorkspaceSettingsForm
        workspace={defaultWorkspace}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // AC-1: Displays workspace name
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Test Workspace');

    // AC-1: Displays owner email
    expect(screen.getByText('owner@test.com')).toBeInTheDocument();

    // AC-1: Displays owner name
    expect(screen.getByText('Owner Name')).toBeInTheDocument();

    // AC-1: Displays document count
    expect(screen.getByText('5 documents')).toBeInTheDocument();
  });

  it('calls onSave with the new name when Save is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <WorkspaceSettingsForm
        workspace={defaultWorkspace}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'New Workspace Name' } });

    fireEvent.click(screen.getByText('Save Changes'));

    // Wait for the async save
    await screen.findByText('Workspace settings saved successfully');

    expect(onSave).toHaveBeenCalledWith('New Workspace Name');
  });

  it('shows validation error when name is too short', () => {
    render(
      <WorkspaceSettingsForm
        workspace={defaultWorkspace}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'AB' } });

    fireEvent.click(screen.getByText('Save Changes'));

    // AC-3: Validation error appears
    expect(
      screen.getByText('Workspace name must be at least 3 characters'),
    ).toBeInTheDocument();
  });

  it('shows validation error when name is too long', () => {
    render(
      <WorkspaceSettingsForm
        workspace={defaultWorkspace}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'A'.repeat(51) } });

    fireEvent.click(screen.getByText('Save Changes'));

    // AC-3: Validation error appears
    expect(
      screen.getByText('Workspace name must be at most 50 characters'),
    ).toBeInTheDocument();
  });

  it('shows error message when save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <WorkspaceSettingsForm
        workspace={defaultWorkspace}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    fireEvent.click(screen.getByText('Save Changes'));

    await screen.findByText('Network error');
  });

  it('disables Save button when no changes are made', () => {
    render(
      <WorkspaceSettingsForm
        workspace={defaultWorkspace}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Save button should be disabled when name hasn't changed
    expect(screen.getByText('Save Changes')).toBeDisabled();
  });

  it('enables Save button when changes are made', () => {
    render(
      <WorkspaceSettingsForm
        workspace={defaultWorkspace}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    expect(screen.getByText('Save Changes')).not.toBeDisabled();
  });

  it('disables inputs while saving', async () => {
    // A promise that never resolves to keep saving state active
    const onSave = vi.fn().mockReturnValue(new Promise(() => {}));

    render(
      <WorkspaceSettingsForm
        workspace={defaultWorkspace}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    fireEvent.click(screen.getByText('Save Changes'));

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByText('Saving...')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();

    render(
      <WorkspaceSettingsForm
        workspace={defaultWorkspace}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
  });
});
