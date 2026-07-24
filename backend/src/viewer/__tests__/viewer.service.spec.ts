import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ViewerService } from '../viewer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../shared/utils/s3.service';
import { WatermarkService } from '../../access/services/watermark.service';
import { AccessService } from '../../access/services/access.service';

describe('ViewerService', () => {
  let service: ViewerService;
  let prisma: PrismaService;
  let s3Service: S3Service;

  const mockUserId = 'user-uuid-123';
  const mockUserEmail = 'buyer@example.com';
  const mockDocumentId = 'doc-uuid-456';
  const mockSessionId = 'session-uuid-789';
  const mockWorkspaceId = 'workspace-uuid-abc';
  const mockPageUrl =
    'https://s3.example.com/bucket/pages/page-1.webp?X-Amz-Signature=mock';

  const defaultDocument = {
    id: mockDocumentId,
    title: 'Advanced SEO Guide',
    status: 'READY' as const,
    protectionConfig: {
      watermark_enabled: true,
      max_concurrent_sessions: 2,
      allow_text_selection: false,
    },
  };

  const defaultGrant = {
    id: 'grant-uuid-1',
    userId: mockUserId,
    documentId: mockDocumentId,
    isActive: true,
    expiresAt: null,
    grantedAt: new Date(),
  };

  const mockWatermarkPayload = {
    userEmail: mockUserEmail,
    sessionIdShort: 'session-u',
    timestamp: '2026-07-21',
  };

  // Default active session for getPageUrl (includes document relation)
  const defaultActiveSession = {
    id: mockSessionId,
    userId: mockUserId,
    documentId: mockDocumentId,
    isActive: true,
    lastActivity: new Date(),
    document: {
      id: mockDocumentId,
      workspaceId: mockWorkspaceId,
    },
  };

  beforeEach(async () => {
    const mockDocumentVersionFindFirst = jest
      .fn()
      .mockResolvedValue({ pageCount: 100 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViewerService,
        {
          provide: PrismaService,
          useValue: {
            document: {
              findUnique: jest.fn().mockResolvedValue(defaultDocument),
            },
            documentVersion: {
              findFirst: mockDocumentVersionFindFirst,
            },
            accessGrant: {
              findUnique: jest.fn().mockResolvedValue(defaultGrant),
            },
            session: {
              count: jest.fn().mockResolvedValue(1),
              create: jest.fn().mockResolvedValue({
                id: mockSessionId,
                userId: mockUserId,
                documentId: mockDocumentId,
                isActive: true,
                lastActivity: new Date(),
                deviceFingerprint: null,
                ipAddress: null,
                userAgent: null,
                createdAt: new Date(),
              }),
              findFirst: jest.fn().mockResolvedValue(
                defaultActiveSession,
              ),
              update: jest.fn().mockResolvedValue({
                id: mockSessionId,
                lastActivity: new Date(),
              }),
            },
          },
        },
        {
          provide: S3Service,
          useValue: {
            generatePresignedGetUrl: jest
              .fn()
              .mockResolvedValue(mockPageUrl),
          },
        },
        {
          provide: WatermarkService,
          useValue: {
            generateWatermarkPayload: jest
              .fn()
              .mockReturnValue(mockWatermarkPayload),
          },
        },
        {
          provide: AccessService,
          useValue: {
            terminateOldestSession: jest
              .fn()
              .mockResolvedValue(null), // null = no session terminated → falls back to ForbiddenException
            countActiveSessions: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<ViewerService>(ViewerService);
    prisma = module.get<PrismaService>(PrismaService);
    s3Service = module.get<S3Service>(S3Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── createSession ─────────────────────────────────────────────────────

  describe('createSession', () => {
    it('AC-1: should create a session and return document metadata + watermark', async () => {
      const result = await service.createSession(
        mockUserId,
        mockUserEmail,
        mockDocumentId,
      );

      expect(result).toHaveProperty('session_id', mockSessionId);
      expect(result).toHaveProperty('document');
      expect(result).toHaveProperty('watermark_data');

      expect(result.document).toHaveProperty(
        'id',
        mockDocumentId,
      );
      expect(result.document).toHaveProperty(
        'title',
        'Advanced SEO Guide',
      );
      expect(result.document).toHaveProperty('page_count', null);
      expect(result.watermark_data).toEqual(mockWatermarkPayload);
    });

    it('AC-1: should create a Session record with correct userId and documentId', async () => {
      await service.createSession(
        mockUserId,
        mockUserEmail,
        mockDocumentId,
      );

      const sessionCreateMock = prisma.session.create as jest.Mock;
      expect(sessionCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          documentId: mockDocumentId,
          isActive: true,
        }),
      });
    });

    it('AC-1: should pass optional device info to session creation', async () => {
      const deviceInfo = {
        deviceFingerprint: 'fp-abc123',
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      };

      await service.createSession(
        mockUserId,
        mockUserEmail,
        mockDocumentId,
        deviceInfo,
      );

      const sessionCreateMock = prisma.session.create as jest.Mock;
      expect(sessionCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceFingerprint: 'fp-abc123',
          ipAddress: '192.168.1.1',
          userAgent: 'TestAgent/1.0',
        }),
      });
    });

    it('AC-2: should throw ForbiddenException with CONCURRENT_SESSION_LIMIT when limit exceeded', async () => {
      const sessionCountMock = prisma.session.count as jest.Mock;
      sessionCountMock.mockResolvedValue(2);

      let error: ForbiddenException | undefined;
      try {
        await service.createSession(
          mockUserId,
          mockUserEmail,
          mockDocumentId,
        );
      } catch (e) {
        error = e as ForbiddenException;
      }

      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(ForbiddenException);

      const errorResponse = error!.getResponse() as {
        error?: { code?: string; details?: Record<string, unknown> };
      };
      expect(errorResponse?.error?.code).toBe(
        'CONCURRENT_SESSION_LIMIT',
      );
      expect(errorResponse?.error?.details).toHaveProperty(
        'max_sessions',
        2,
      );
      expect(errorResponse?.error?.details).toHaveProperty(
        'active_sessions',
        2,
      );

      const sessionCreateMock = prisma.session.create as jest.Mock;
      expect(sessionCreateMock).not.toHaveBeenCalled();
    });

    it('AC-3: should throw ForbiddenException with ACCESS_DENIED when no grant exists', async () => {
      const grantMock = prisma.accessGrant.findUnique as jest.Mock;
      grantMock.mockResolvedValue(null);

      let error: ForbiddenException | undefined;
      try {
        await service.createSession(
          mockUserId,
          mockUserEmail,
          mockDocumentId,
        );
      } catch (e) {
        error = e as ForbiddenException;
      }

      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(ForbiddenException);

      const errorResponse = error!.getResponse() as {
        error?: { code?: string };
      };
      expect(errorResponse?.error?.code).toBe('ACCESS_DENIED');
    });

    it('AC-3: should throw ForbiddenException with ACCESS_DENIED when grant is inactive', async () => {
      const grantMock = prisma.accessGrant.findUnique as jest.Mock;
      grantMock.mockResolvedValue({
        ...defaultGrant,
        isActive: false,
      });

      let error: ForbiddenException | undefined;
      try {
        await service.createSession(
          mockUserId,
          mockUserEmail,
          mockDocumentId,
        );
      } catch (e) {
        error = e as ForbiddenException;
      }

      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(
        (error!.getResponse() as { error?: { code?: string } })
          ?.error?.code,
      ).toBe('ACCESS_DENIED');
    });

    it('AC-3: should throw ForbiddenException with ACCESS_DENIED when grant is expired', async () => {
      const grantMock = prisma.accessGrant.findUnique as jest.Mock;
      grantMock.mockResolvedValue({
        ...defaultGrant,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      let error: ForbiddenException | undefined;
      try {
        await service.createSession(
          mockUserId,
          mockUserEmail,
          mockDocumentId,
        );
      } catch (e) {
        error = e as ForbiddenException;
      }

      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(
        (error!.getResponse() as { error?: { code?: string } })
          ?.error?.code,
      ).toBe('ACCESS_DENIED');
    });

    it('should throw NotFoundException when document does not exist', async () => {
      const docMock = prisma.document.findUnique as jest.Mock;
      docMock.mockResolvedValue(null);

      await expect(
        service.createSession(
          mockUserId,
          mockUserEmail,
          mockDocumentId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when document status is ERROR', async () => {
      const docMock = prisma.document.findUnique as jest.Mock;
      docMock.mockResolvedValue({
        ...defaultDocument,
        status: 'ERROR',
      });

      await expect(
        service.createSession(
          mockUserId,
          mockUserEmail,
          mockDocumentId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── heartbeat ─────────────────────────────────────────────────────────

  describe('heartbeat', () => {
    it('AC-1: should return valid=true and nextHeartbeatIn=60 for active session', async () => {
      const result = await service.heartbeat(
        mockSessionId,
        mockUserId,
      );

      expect(result).toEqual({
        valid: true,
        nextHeartbeatIn: 60,
      });

      const updateMock = prisma.session.update as jest.Mock;
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: mockSessionId },
        data: { lastActivity: expect.any(Date) },
      });
    });

    it('AC-2: should return valid=false when session is not active (isActive=false)', async () => {
      const findFirstMock = prisma.session.findFirst as jest.Mock;
      findFirstMock.mockResolvedValue({
        id: mockSessionId,
        isActive: false,
      });

      const result = await service.heartbeat(
        mockSessionId,
        mockUserId,
      );

      expect(result).toEqual({
        valid: false,
        reason: 'SESSION_TERMINATED',
      });

      const updateMock = prisma.session.update as jest.Mock;
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('AC-3: should return valid=false when session does not exist', async () => {
      const findFirstMock = prisma.session.findFirst as jest.Mock;
      findFirstMock.mockResolvedValue(null);

      const result = await service.heartbeat(
        'nonexistent-session',
        mockUserId,
      );

      expect(result).toEqual({
        valid: false,
        reason: 'SESSION_TERMINATED',
      });
    });

    it('AC-2: should return valid=false when session belongs to another user (IDOR protection)', async () => {
      const findFirstMock = prisma.session.findFirst as jest.Mock;
      findFirstMock.mockResolvedValue(null);

      const result = await service.heartbeat(
        mockSessionId,
        'different-user-id',
      );

      expect(result).toEqual({
        valid: false,
        reason: 'SESSION_TERMINATED',
      });
    });

    it('should return valid=false when Prisma update fails', async () => {
      const updateMock = prisma.session.update as jest.Mock;
      updateMock.mockRejectedValue(
        new Error('Database connection lost'),
      );

      const result = await service.heartbeat(
        mockSessionId,
        mockUserId,
      );

      expect(result).toEqual({
        valid: false,
        reason: 'SESSION_TERMINATED',
      });
    });
  });

  // ── getPageUrl ────────────────────────────────────────────────────────

  describe('getPageUrl', () => {
    it('AC-1: should generate presigned GET URL with correct S3 key for valid session', async () => {
      const result = await service.getPageUrl(
        mockSessionId,
        mockUserId,
        1,
      );

      expect(result).toHaveProperty('url', mockPageUrl);
      expect(result).toHaveProperty('expires_in', 60);

      // Verify S3 key pattern: workspaceId/documentId/pages/page-N.webp
      expect(
        s3Service.generatePresignedGetUrl,
      ).toHaveBeenCalledWith(
        `${mockWorkspaceId}/${mockDocumentId}/pages/page-1.webp`,
        60,
      );
    });

    it('AC-1: should work for any valid page number', async () => {
      await service.getPageUrl(mockSessionId, mockUserId, 42);

      expect(
        s3Service.generatePresignedGetUrl,
      ).toHaveBeenCalledWith(
        `${mockWorkspaceId}/${mockDocumentId}/pages/page-42.webp`,
        60,
      );
    });

    it('AC-2: should throw ForbiddenException with SESSION_INVALID when session is inactive', async () => {
      const findFirstMock = prisma.session.findFirst as jest.Mock;
      findFirstMock.mockResolvedValue(null); // findFirst with isActive=false + lastActivity filter returns null

      await expect(
        service.getPageUrl(mockSessionId, mockUserId, 1),
      ).rejects.toThrow(ForbiddenException);

      // S3 should NOT be called
      expect(
        s3Service.generatePresignedGetUrl,
      ).not.toHaveBeenCalled();
    });

    it('AC-4: should throw ForbiddenException with SESSION_INVALID when session belongs to another user (IDOR)', async () => {
      const findFirstMock = prisma.session.findFirst as jest.Mock;
      findFirstMock.mockResolvedValue(null);

      await expect(
        service.getPageUrl(
          mockSessionId,
          'different-user-id',
          1,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(
        s3Service.generatePresignedGetUrl,
      ).not.toHaveBeenCalled();
    });

    it('AC-2: should throw ForbiddenException when session lastActivity is older than 5 minutes', async () => {
      const findFirstMock = prisma.session.findFirst as jest.Mock;
      // Simulate expired session — findFirst with lastActivity filter returns null
      findFirstMock.mockResolvedValue(null);

      await expect(
        service.getPageUrl(mockSessionId, mockUserId, 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should generate URL with exact 60-second expiry', async () => {
      await service.getPageUrl(mockSessionId, mockUserId, 1);

      expect(
        s3Service.generatePresignedGetUrl,
      ).toHaveBeenCalledWith(
        expect.any(String),
        60, // Must be exactly 60 seconds
      );
    });

    it('AC-3: should throw NotFoundException when pageNumber exceeds pageCount', async () => {
      // Override mock for this test: pageCount = 10
      const versionMock =
        prisma.documentVersion.findFirst as jest.Mock;
      versionMock.mockResolvedValue({ pageCount: 10 });

      await expect(
        service.getPageUrl(mockSessionId, mockUserId, 99),
      ).rejects.toThrow(NotFoundException);

      // S3 should NOT be called for out-of-range pages
      expect(
        s3Service.generatePresignedGetUrl,
      ).not.toHaveBeenCalled();
    });

    it('should allow pages within range when pageCount is known', async () => {
      const versionMock =
        prisma.documentVersion.findFirst as jest.Mock;
      versionMock.mockResolvedValue({ pageCount: 10 });

      const result = await service.getPageUrl(
        mockSessionId,
        mockUserId,
        10, // Last page — should succeed
      );

      expect(result).toHaveProperty('url');
      expect(
        s3Service.generatePresignedGetUrl,
      ).toHaveBeenCalled();
    });
  });
});
