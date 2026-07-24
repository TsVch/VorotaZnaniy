import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkspacesService } from '../workspaces.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;

  const mockWorkspace = {
    id: 'ws-1',
    name: 'Test Workspace',
    slug: 'test-workspace-abc12345',
    ownerId: 'user-1',
    plan: 'STARTER',
    stripeCustomerId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    owner: { email: 'owner@test.com', name: 'Owner Name' },
    _count: { documents: 5 },
  };

  const mockUser = {
    id: 'user-1',
    email: 'owner@test.com',
    defaultWorkspaceId: 'ws-1',
  };

  const mockPrisma = {
    workspace: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWorkspaceDetails', () => {
    it('should return workspace details when found', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      const result = await service.getWorkspaceDetails('ws-1');

      expect(result).toEqual({
        id: 'ws-1',
        name: 'Test Workspace',
        slug: 'test-workspace-abc12345',
        owner: { email: 'owner@test.com', name: 'Owner Name' },
        documentCount: 5,
        createdAt: mockWorkspace.createdAt,
        updatedAt: mockWorkspace.updatedAt,
      });
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        include: {
          owner: { select: { email: true, name: true } },
          _count: { select: { documents: true } },
        },
      });
    });

    it('should throw NotFoundException when workspace not found', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(service.getWorkspaceDetails('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return documentCount as 0 when workspace has no documents', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        ...mockWorkspace,
        _count: { documents: 0 },
      });

      const result = await service.getWorkspaceDetails('ws-1');
      expect(result.documentCount).toBe(0);
    });
  });

  describe('findUserWorkspace', () => {
    it('should return workspace for user with defaultWorkspaceId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace);

      const result = await service.findUserWorkspace('user-1');

      expect(result.id).toBe('ws-1');
      expect(result.name).toBe('Test Workspace');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { defaultWorkspaceId: true },
      });
    });

    it('should throw NotFoundException when user has no default workspace', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        defaultWorkspaceId: null,
      });

      await expect(service.findUserWorkspace('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findUserWorkspace('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateWorkspace', () => {
    const updateDto = { name: 'Updated Workspace' };

    it('should update workspace name and return updated details', async () => {
      const updatedWorkspace = {
        ...mockWorkspace,
        name: 'Updated Workspace',
        updatedAt: new Date('2025-01-03'),
      };
      mockPrisma.workspace.update.mockResolvedValue(updatedWorkspace);

      const result = await service.updateWorkspace('ws-1', updateDto);

      expect(result.name).toBe('Updated Workspace');
      expect(result.documentCount).toBe(5);
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { name: 'Updated Workspace' },
        include: {
          owner: { select: { email: true, name: true } },
          _count: { select: { documents: true } },
        },
      });
    });

    it('should throw NotFoundException when workspace does not exist (P2025)', async () => {
      const prismaError = new Error('Record not found');
      (prismaError as unknown as Record<string, string>).code = 'P2025';
      mockPrisma.workspace.update.mockRejectedValue(prismaError);

      await expect(service.updateWorkspace('nonexistent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on unexpected Prisma error', async () => {
      mockPrisma.workspace.update.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.updateWorkspace('ws-1', updateDto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
