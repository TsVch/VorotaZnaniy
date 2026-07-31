import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock global fetch before importing the client ──────────────────────────

const mockFetch = vi.fn();

describe('API client — X-Workspace-Id header', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ documents: [], total: 0, page: 1, limit: 10 }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AC-3: attaches x-workspace-id header when user has a defaultWorkspaceId', async () => {
    localStorage.setItem(
      'kv_user',
      JSON.stringify({
        id: 'user-1',
        email: 'creator@example.com',
        role: 'CREATOR',
        defaultWorkspaceId: 'ws-uuid-123',
      }),
    );

    const { documentsApi } = await import('../client');
    await documentsApi.getDocuments();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['x-workspace-id']).toBe('ws-uuid-123');
  });

  it('AC-3: omits the header when no workspace is stored', async () => {
    localStorage.setItem(
      'kv_user',
      JSON.stringify({ id: 'user-1', email: 'creator@example.com', role: 'CREATOR' }),
    );

    const { documentsApi } = await import('../client');
    await documentsApi.getDocuments();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['x-workspace-id']).toBeUndefined();
  });

  it('AC-3: reads the workspace fresh on each request (not cached at module load)', async () => {
    const { documentsApi } = await import('../client');
    await documentsApi.getDocuments();
    expect(mockFetch.mock.calls[0][1].headers['x-workspace-id']).toBeUndefined();

    // Log in with a workspace → subsequent requests carry the header
    localStorage.setItem(
      'kv_user',
      JSON.stringify({
        id: 'user-1',
        email: 'creator@example.com',
        role: 'CREATOR',
        defaultWorkspaceId: 'ws-uuid-456',
      }),
    );

    await documentsApi.getDocuments();
    expect(mockFetch.mock.calls[1][1].headers['x-workspace-id']).toBe('ws-uuid-456');
  });
});
