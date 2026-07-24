import type { ExecutionContext } from '@nestjs/common';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WorkspaceOwnerGuard } from '../guards/workspace-owner.guard';
import { PrismaService } from '../../prisma/prisma.service';

function createMockContext(
  headers: Record<string, string | undefined>,
  user?: { sub: string; workspaceId?: string },
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        user,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('WorkspaceOwnerGuard', () => {
  let guard: WorkspaceOwnerGuard;
  let prisma: PrismaService;

  const mockWorkspace = {
    id: 'ws-123',
    ownerId: 'user-1',
  };

  beforeEach(async () => {
    prisma = {
      workspace: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;

    guard = new WorkspaceOwnerGuard(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── AC-2: Own workspace ────────────────────────────────────────────────

  it('AC-2: should allow access when user owns the workspace', async () => {
    (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
      mockWorkspace,
    );

    const context = createMockContext(
      { 'x-workspace-id': 'ws-123' },
      { sub: 'user-1' },
    );

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  // ── AC-3: Foreign workspace ────────────────────────────────────────────

  it('AC-3: should deny access when user does not own the workspace', async () => {
    (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
      mockWorkspace,
    );

    const context = createMockContext(
      { 'x-workspace-id': 'ws-123' },
      { sub: 'user-2' }, // different user
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'You do not own this workspace',
    );
  });

  // ── AC-4: Missing header ───────────────────────────────────────────────

  it('AC-4: should return 400 when X-Workspace-Id header is missing', async () => {
    const context = createMockContext({}, { sub: 'user-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Workspace ID is required',
    );
  });

  // ── Missing workspace in DB ────────────────────────────────────────────

  it('should deny access when workspace does not exist', async () => {
    (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null);

    const context = createMockContext(
      { 'x-workspace-id': 'non-existent-ws' },
      { sub: 'user-1' },
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Workspace not found',
    );
  });

  // ── No user on request ─────────────────────────────────────────────────

  it('should deny access when user is not authenticated', async () => {
    const context = createMockContext(
      { 'x-workspace-id': 'ws-123' },
      undefined,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'User not authenticated',
    );
  });
});
