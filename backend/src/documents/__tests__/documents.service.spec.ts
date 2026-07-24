import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { DocumentsService } from '../documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../shared/utils/s3.service';
import { JobsBridgeService } from '../../jobs-bridge/jobs-bridge.service';
import type { UploadInitDto } from '../dto/upload-init.dto';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: PrismaService;
  let s3Service: S3Service;
  let jobsBridgeService: JobsBridgeService;

  const mockWorkspaceId = 'workspace-uuid-123';

  const validDto: UploadInitDto = {
    title: 'Advanced SEO Guide',
    file_name: 'seo_guide.pdf',
    file_size: 5_242_880, // 5 MB
    mime_type: 'application/pdf',
    protection_config: {
      watermark_enabled: true,
      max_concurrent_sessions: 3,
      allow_text_selection: false,
    },
  };

  const mockPresignedUrl =
    'https://s3.example.com/bucket/key?X-Amz-Signature=mock';

  const mockS3Key = `${mockWorkspaceId}/00000000-0000-0000-0000-000000000000/seo_guide.pdf`;

  function mockDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      workspaceId: mockWorkspaceId,
      title: validDto.title,
      description: null,
      fileName: 'seo_guide.pdf',
      s3Key: mockS3Key,
      fileType: 'pdf',
      fileSize: validDto.file_size,
      status: 'PROCESSING',
      protectionConfig: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: PrismaService,
          useValue: {
            document: {
              create: jest.fn().mockResolvedValue(mockDocument()),
              findUnique: jest
                .fn()
                .mockResolvedValue(mockDocument()),
              update: jest.fn().mockResolvedValue(mockDocument()),
            },
            embedding: {
              findMany: jest
                .fn()
                .mockResolvedValue([
                  { chunkText: 'Test chunk content' },
                ]),
            },
            accessGrant: {
              findUnique: jest.fn().mockResolvedValue({
                isActive: true,
                expiresAt: null,
              }),
            },
            aiUsageLog: {
              count: jest.fn().mockResolvedValue(5),
              create: jest.fn().mockResolvedValue({}),
            },
            documentVersion: {
              findFirst: jest.fn().mockResolvedValue({
                pageCount: 24,
              }),
            },
            session: {
              count: jest.fn().mockResolvedValue(10),
              groupBy: jest.fn().mockResolvedValue([
                { userId: 'user-1' },
                { userId: 'user-2' },
                { userId: 'user-3' },
              ]),
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'session-1',
                  createdAt: new Date('2026-07-21T10:00:00Z'),
                  isActive: true,
                },
                {
                  id: 'session-2',
                  createdAt: new Date('2026-07-20T14:30:00Z'),
                  isActive: false,
                },
              ]),
            },
            workspace: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          },
        },
        {
          provide: S3Service,
          useValue: {
            generatePresignedUploadUrl: jest
              .fn()
              .mockResolvedValue(mockPresignedUrl),
            checkObjectExists: jest
              .fn()
              .mockResolvedValue(true),
          },
        },
        {
          provide: JobsBridgeService,
          useValue: {
            dispatchAiProcessing: jest
              .fn()
              .mockResolvedValue({ jobId: 'mock-job-id' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                S3_UPLOAD_URL_EXPIRY: 300,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    prisma = module.get<PrismaService>(PrismaService);
    s3Service = module.get<S3Service>(S3Service);
    jobsBridgeService = module.get<JobsBridgeService>(JobsBridgeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── initUpload ─────────────────────────────────────────────────────────

  describe('initUpload', () => {
    it('should return document_id and upload_url on success', async () => {
      const result = await service.initUpload(mockWorkspaceId, validDto);

      expect(result).toHaveProperty('document_id');
      expect(result).toHaveProperty('upload_url', mockPresignedUrl);
      expect(result).toHaveProperty('expires_in', 300);
    });

    it('should generate S3 key with correct path structure', async () => {
      await service.initUpload(mockWorkspaceId, validDto);

      expect(
        s3Service.generatePresignedUploadUrl,
      ).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `^${mockWorkspaceId}/[0-9a-f-]+/${validDto.file_name}$`,
          ),
        ),
        validDto.mime_type,
        expect.any(Number),
      );
    });

    it('should create a Document record with PROCESSING status and s3Key', async () => {
      await service.initUpload(mockWorkspaceId, validDto);
      const prismaMock = prisma.document.create as jest.Mock;

      expect(prismaMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: mockWorkspaceId,
          title: validDto.title,
          fileName: validDto.file_name,
          fileType: 'pdf',
          fileSize: validDto.file_size,
          status: 'PROCESSING',
          s3Key: expect.stringContaining(mockWorkspaceId),
        }),
      });
    });

    it('AC-1: should merge default protectionConfig with snake_case fields when not provided', async () => {
      const dtoWithoutProtection: UploadInitDto = {
        title: 'Minimal Guide',
        file_name: 'guide.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
      };

      await service.initUpload(
        mockWorkspaceId,
        dtoWithoutProtection,
      );

      const prismaMock = prisma.document.create as jest.Mock;
      expect(prismaMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          protectionConfig: {
            watermark_enabled: true,
            max_concurrent_sessions: 2,
            allow_text_selection: false,
          },
        }),
      });
    });

    it('should use provided protection_config values when given', async () => {
      const dtoWithOverrides: UploadInitDto = {
        title: 'Custom Protection Guide',
        file_name: 'custom.pdf',
        file_size: 2048,
        mime_type: 'application/pdf',
        protection_config: {
          watermark_enabled: false,
          max_concurrent_sessions: 5,
          allow_text_selection: true,
        },
      };

      await service.initUpload(
        mockWorkspaceId,
        dtoWithOverrides,
      );

      const prismaMock = prisma.document.create as jest.Mock;
      expect(prismaMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          protectionConfig: {
            watermark_enabled: false,
            max_concurrent_sessions: 5,
            allow_text_selection: true,
          },
        }),
      });
    });

    it('should throw BadRequestException when S3 URL generation fails', async () => {
      const s3Mock = s3Service.generatePresignedUploadUrl as jest.Mock;
      s3Mock.mockRejectedValue(new Error('S3 connection failed'));

      await expect(
        service.initUpload(mockWorkspaceId, validDto),
      ).rejects.toThrow(BadRequestException);

      const prismaMock = prisma.document.create as jest.Mock;
      expect(prismaMock).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when Prisma create fails', async () => {
      const prismaMock = prisma.document.create as jest.Mock;
      prismaMock.mockRejectedValue(
        new Error('Database constraint violation'),
      );

      await expect(
        service.initUpload(mockWorkspaceId, validDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── completeUpload ─────────────────────────────────────────────────────

  describe('completeUpload', () => {
    it('AC-1: should verify S3 and persist AI processing job on success', async () => {
      const result = await service.completeUpload(
        '00000000-0000-0000-0000-000000000000',
        mockWorkspaceId,
      );

      expect(result).toHaveProperty(
        'document_id',
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toHaveProperty('status', 'PROCESSING');
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('queued');

      // Verify S3 headObject was called with the correct key
      expect(s3Service.checkObjectExists).toHaveBeenCalledWith(
        mockS3Key,
      );

      // Verify JobsBridge persistence was called
      expect(
        jobsBridgeService.dispatchAiProcessing,
      ).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000000',
        mockS3Key,
      );
    });

    it('AC-2: should throw BadRequestException with FILE_NOT_FOUND_IN_STORAGE when file is not in S3', async () => {
      const s3Mock = s3Service.checkObjectExists as jest.Mock;
      s3Mock.mockResolvedValue(false);

      let error: BadRequestException | undefined;
      try {
        await service.completeUpload(
          '00000000-0000-0000-0000-000000000000',
          mockWorkspaceId,
        );
      } catch (e) {
        error = e as BadRequestException;
      }

      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(BadRequestException);
      const errorResponse = (error as BadRequestException).getResponse() as {
        error?: { code?: string };
      };
      expect(errorResponse?.error?.code).toBe(
        'FILE_NOT_FOUND_IN_STORAGE',
      );

      // JobsBridge should NOT be called when file is missing
      expect(
        jobsBridgeService.dispatchAiProcessing,
      ).not.toHaveBeenCalled();
    });

    it('AC-3: should throw NotFoundException when document does not exist', async () => {
      const prismaMock = prisma.document.findUnique as jest.Mock;
      prismaMock.mockResolvedValue(null);

      await expect(
        service.completeUpload(
          'nonexistent-id',
          mockWorkspaceId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('AC-3: should throw NotFoundException when document workspace does not match', async () => {
      const prismaMock = prisma.document.findUnique as jest.Mock;
      prismaMock.mockResolvedValue(
        mockDocument({ workspaceId: 'other-workspace' }),
      );

      await expect(
        service.completeUpload(
          '00000000-0000-0000-0000-000000000000',
          mockWorkspaceId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when S3 check itself fails', async () => {
      const s3Mock = s3Service.checkObjectExists as jest.Mock;
      s3Mock.mockRejectedValue(new Error('S3 connection error'));

      await expect(
        service.completeUpload(
          '00000000-0000-0000-0000-000000000000',
          mockWorkspaceId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should persist job via JobsBridge', async () => {
      const result = await service.completeUpload(
        '00000000-0000-0000-0000-000000000000',
        mockWorkspaceId,
      );

      expect(result).toHaveProperty('status', 'PROCESSING');
      expect(
        jobsBridgeService.dispatchAiProcessing,
      ).toHaveBeenCalled();
    });
  });

  // ── askQuestion ───────────────────────────────────────────────────────

  describe('askQuestion', () => {
    const mockDocId = 'doc-uuid-for-qa';
    const mockUserId = 'user-uuid-123';

    const mockWorkerResponse = {
      answer: 'According to [1], Python is a programming language.',
      sources: [{ chunkIndex: 0, text: 'Python is a programming language.' }],
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('AC-1: should return answer with sources on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorkerResponse),
      });

      const result = await service.askQuestion(
        mockDocId,
        mockUserId,
        'What is Python?',
      );

      expect(result.answer).toContain('Python');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].chunkIndex).toBe(0);

      // Verify fetch was called with correct URL and headers
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/ai/qa'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Internal-API-Key': expect.any(String),
          }),
        }),
      );

      // Verify AiUsageLog was created
      const aiUsageMock = prisma.aiUsageLog.create as jest.Mock;
      expect(aiUsageMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          documentId: mockDocId,
          queryType: 'qa',
        }),
      });

      delete (global as Record<string, unknown>).fetch;
    });

    it('AC-4: should throw ForbiddenException when no AccessGrant', async () => {
      const accessMock = prisma.accessGrant.findUnique as jest.Mock;
      accessMock.mockResolvedValue(null);

      await expect(
        service.askQuestion(mockDocId, mockUserId, 'What is Python?'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when AccessGrant is expired', async () => {
      const accessMock = prisma.accessGrant.findUnique as jest.Mock;
      accessMock.mockResolvedValue({
        isActive: true,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(
        service.askQuestion(mockDocId, mockUserId, 'What is Python?'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('AC-3: should throw BadRequestException when AI Worker fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        service.askQuestion(mockDocId, mockUserId, 'What is Python?'),
      ).rejects.toThrow(BadRequestException);

      delete (global as Record<string, unknown>).fetch;
    });

    it('AC-3: should throw BadRequestException when AI Worker returns non-200', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: jest.fn(),
      });

      await expect(
        service.askQuestion(mockDocId, mockUserId, 'What is Python?'),
      ).rejects.toThrow(BadRequestException);

      delete (global as Record<string, unknown>).fetch;
    });

    it('should handle AiUsageLog failure gracefully (non-fatal)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorkerResponse),
      });

      const aiUsageMock = prisma.aiUsageLog.create as jest.Mock;
      aiUsageMock.mockRejectedValue(new Error('DB error'));

      // Should still return the answer even if logging fails
      const result = await service.askQuestion(
        mockDocId,
        mockUserId,
        'What is Python?',
      );

      expect(result.answer).toContain('Python');

      delete (global as Record<string, unknown>).fetch;
    });

    it('should check AccessGrant via correct unique constraint', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorkerResponse),
      });

      await service.askQuestion(mockDocId, mockUserId, 'What is Python?');

      const accessMock = prisma.accessGrant.findUnique as jest.Mock;
      expect(accessMock).toHaveBeenCalledWith({
        where: {
          userId_documentId: {
            userId: mockUserId,
            documentId: mockDocId,
          },
        },
        select: { isActive: true, expiresAt: true },
      });

      delete (global as Record<string, unknown>).fetch;
    });

    it('AC-3: should throw 429 Too Many Requests after 11 calls', async () => {
      // Reset rate limiter state by accessing private map
      // We need to call askQuestion 10 times successfully, then the 11th should fail

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockWorkerResponse),
      });

      // 10 successful calls should work
      for (let i = 0; i < 10; i++) {
        const result = await service.askQuestion(
          mockDocId,
          mockUserId,
          'What is Python?',
        );
        expect(result.answer).toBeDefined();
      }

      // 11th call should throw 429
      let error: HttpException | undefined;
      try {
        await service.askQuestion(
          mockDocId,
          mockUserId,
          'What is Python?',
        );
      } catch (e) {
        error = e as HttpException;
      }

      expect(error).toBeDefined();
      expect(error?.getStatus()).toBe(429);

      delete (global as Record<string, unknown>).fetch;
    });
  });

  // ── getDocument ───────────────────────────────────────────────────────

  describe('getDocument', () => {
    const mockDocId = '00000000-0000-0000-0000-000000000000';

    it('should return document details when found', async () => {
      const prismaMock = prisma.document.findUnique as jest.Mock;
      prismaMock.mockResolvedValue(
        mockDocument({ title: 'Test Doc', fileSize: 1024 }),
      );

      const result = await service.getDocument(mockDocId);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Doc');
      expect(result?.fileSize).toBe(1024);
      expect(prismaMock).toHaveBeenCalledWith({
        where: { id: mockDocId },
        select: expect.objectContaining({
          id: true,
          title: true,
          description: true,
        }),
      });
    });

    it('should return null when document does not exist', async () => {
      const prismaMock = prisma.document.findUnique as jest.Mock;
      prismaMock.mockResolvedValue(null);

      const result = await service.getDocument('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ── updateDocument ────────────────────────────────────────────────────

  describe('updateDocument', () => {
    const mockDocId = '00000000-0000-0000-0000-000000000000';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('AC-1: should update title only when only title is provided', async () => {
      const prismaUpdateMock = prisma.document.update as jest.Mock;
      prismaUpdateMock.mockResolvedValue(
        mockDocument({ title: 'New Title' }),
      );

      const result = await service.updateDocument(mockDocId, {
        title: 'New Title',
      });

      expect(result.title).toBe('New Title');
      expect(prismaUpdateMock).toHaveBeenCalledWith({
        where: { id: mockDocId },
        data: { title: 'New Title' },
        select: expect.any(Object),
      });
    });

    it('AC-1: should update title and description when both are provided', async () => {
      const prismaUpdateMock = prisma.document.update as jest.Mock;
      prismaUpdateMock.mockResolvedValue(
        mockDocument({ title: 'Updated', description: 'New desc' }),
      );

      const result = await service.updateDocument(mockDocId, {
        title: 'Updated',
        description: 'New desc',
      });

      expect(result.title).toBe('Updated');
      expect(prismaUpdateMock).toHaveBeenCalledWith({
        where: { id: mockDocId },
        data: { title: 'Updated', description: 'New desc' },
        select: expect.any(Object),
      });
    });

    it('AC-2: should merge protection_config with existing values', async () => {
      const prismaFindMock = prisma.document.findUnique as jest.Mock;
      prismaFindMock.mockResolvedValue({
        protectionConfig: {
          watermark_enabled: true,
          max_concurrent_sessions: 2,
          allow_text_selection: false,
        },
      });

      const prismaUpdateMock = prisma.document.update as jest.Mock;
      prismaUpdateMock.mockResolvedValue(
        mockDocument({ protectionConfig: { watermark_enabled: false } }),
      );

      await service.updateDocument(mockDocId, {
        protection_config: { watermark_enabled: false },
      });

      expect(prismaUpdateMock).toHaveBeenCalledWith({
        where: { id: mockDocId },
        data: expect.objectContaining({
          protectionConfig: expect.objectContaining({
            watermark_enabled: false,
            max_concurrent_sessions: 2,
            allow_text_selection: false,
          }),
        }),
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException when document does not exist', async () => {
      const prismaUpdateMock = prisma.document.update as jest.Mock;
      const prismaError = new Error('Record not found') as Error & { code: string };
      prismaError.code = 'P2025';
      prismaUpdateMock.mockRejectedValue(prismaError);

      await expect(
        service.updateDocument(mockDocId, { title: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on unexpected database error', async () => {
      const prismaUpdateMock = prisma.document.update as jest.Mock;
      prismaUpdateMock.mockRejectedValue(
        new Error('Unexpected DB error'),
      );

      await expect(
        service.updateDocument(mockDocId, { title: 'Nope' }),
      ).rejects.toThrow(BadRequestException);
    });

    // ── AC-3: allowDownload MVP restriction ───────────────────────────

    it('AC-3: should throw BadRequestException when allowDownload is true', async () => {
      await expect(
        service.updateDocument(mockDocId, {
          protection_config: { allow_download: true },
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify update was NOT called
      const prismaUpdateMock = prisma.document.update as jest.Mock;
      expect(prismaUpdateMock).not.toHaveBeenCalled();
    });

    it('should allow allowDownload: false', async () => {
      const prismaFindMock = prisma.document.findUnique as jest.Mock;
      prismaFindMock.mockResolvedValue({
        protectionConfig: {
          watermark_enabled: true,
          max_concurrent_sessions: 2,
          allow_text_selection: false,
        },
      });

      const prismaUpdateMock = prisma.document.update as jest.Mock;
      prismaUpdateMock.mockResolvedValue({});

      await expect(
        service.updateDocument(mockDocId, {
          protection_config: { allow_download: false },
        }),
      ).resolves.not.toThrow();
    });

    it('AC-4: should merge partial protectionConfig without overwriting unchanged fields', async () => {
      // Existing config has all 5 fields
      const prismaFindMock = prisma.document.findUnique as jest.Mock;
      prismaFindMock.mockResolvedValue({
        protectionConfig: {
          watermark_enabled: true,
          watermark_text: 'OLD WATERMARK',
          max_concurrent_sessions: 2,
          allow_text_selection: false,
          allow_download: false,
        },
      });

      const prismaUpdateMock = prisma.document.update as jest.Mock;
      prismaUpdateMock.mockResolvedValue({});

      await service.updateDocument(mockDocId, {
        protection_config: {
          max_concurrent_sessions: 5,
          watermark_text: 'NEW WATERMARK',
        },
      });

      expect(prismaUpdateMock).toHaveBeenCalledWith({
        where: { id: mockDocId },
        data: expect.objectContaining({
          protectionConfig: expect.objectContaining({
            watermark_enabled: true,       // unchanged
            watermark_text: 'NEW WATERMARK', // changed
            max_concurrent_sessions: 5,     // changed
            allow_text_selection: false,    // unchanged
            allow_download: false,           // unchanged
          }),
        }),
        select: expect.any(Object),
      });
    });
  });

  // ── getDocumentAnalytics ──────────────────────────────────────────────

  describe('getDocumentAnalytics', () => {
    const mockDocId = 'doc-uuid-for-analytics';

    it('should return correct metrics when data exists', async () => {
      const result = await service.getDocumentAnalytics(mockDocId);

      expect(result.totalViews).toBe(10);
      expect(result.uniqueViewers).toBe(3);
      expect(result.aiQueries).toBe(5);
      expect(result.recentSessions).toHaveLength(2);
      expect(result.recentSessions[0].id).toBe('session-1');
      expect(result.recentSessions[0].isActive).toBe(true);
      expect(result.recentSessions[1].id).toBe('session-2');
      expect(result.recentSessions[1].isActive).toBe(false);
    });

    it('should return zeros and empty array when no data exists', async () => {
      const sessionCountMock = prisma.session.count as jest.Mock;
      sessionCountMock.mockResolvedValue(0);

      const sessionGroupByMock = prisma.session.groupBy as jest.Mock;
      sessionGroupByMock.mockResolvedValue([]);

      const aiCountMock = prisma.aiUsageLog.count as jest.Mock;
      aiCountMock.mockResolvedValue(0);

      const sessionFindMock = prisma.session.findMany as jest.Mock;
      sessionFindMock.mockResolvedValue([]);

      const result = await service.getDocumentAnalytics(mockDocId);

      expect(result.totalViews).toBe(0);
      expect(result.uniqueViewers).toBe(0);
      expect(result.aiQueries).toBe(0);
      expect(result.recentSessions).toHaveLength(0);
    });

    it('should not throw when Prisma queries fail (graceful fallback)', async () => {
      const sessionCountMock = prisma.session.count as jest.Mock;
      sessionCountMock.mockRejectedValue(new Error('DB error'));

      const sessionGroupByMock = prisma.session.groupBy as jest.Mock;
      sessionGroupByMock.mockRejectedValue(new Error('DB error'));

      const aiCountMock = prisma.aiUsageLog.count as jest.Mock;
      aiCountMock.mockRejectedValue(new Error('DB error'));

      const sessionFindMock = prisma.session.findMany as jest.Mock;
      sessionFindMock.mockRejectedValue(new Error('DB error'));

      // Should not throw — all errors are caught and logged
      const result = await service.getDocumentAnalytics(mockDocId);

      // Should return defaults
      expect(result.totalViews).toBe(0);
      expect(result.uniqueViewers).toBe(0);
      expect(result.aiQueries).toBe(0);
      expect(result.recentSessions).toHaveLength(0);
    });
  });

  // ── generateAndSaveSummary ────────────────────────────────────────────

  describe('generateAndSaveSummary', () => {
    const mockDocumentId = 'doc-uuid-for-summary';

    const mockChunks = [
      { chunkText: 'First chunk of the document with key information.' },
      { chunkText: 'Second chunk continuing the explanation.' },
    ];

    const mockSummaryText =
      '• Key takeaway 1\n• Key takeaway 2';

    it('AC-1: should generate and save summary when chunks exist', async () => {
      // Mock embedding.findMany to return chunks
      const prismaEmbeddingMock =
        prisma.embedding.findMany as jest.Mock;
      prismaEmbeddingMock.mockResolvedValue(mockChunks);

      // Mock document.update
      const prismaUpdateMock =
        prisma.document.update as jest.Mock;
      prismaUpdateMock.mockResolvedValue({});

      // Mock global fetch to simulate AI Worker response
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          summary: mockSummaryText,
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const result = await service.generateAndSaveSummary(
        mockDocumentId,
      );

      expect(result).toBe(mockSummaryText);

      // Verify embedding fetch called with correct params
      expect(prismaEmbeddingMock).toHaveBeenCalledWith({
        where: { documentId: mockDocumentId },
        orderBy: { chunkIndex: 'asc' },
        take: 5,
        select: { chunkText: true },
      });

      // Verify document.update was called with summary
      expect(prismaUpdateMock).toHaveBeenCalledWith({
        where: { id: mockDocumentId },
        data: { summary: mockSummaryText },
      });

      // Verify fetch was called with correct URL and headers
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/ai/summary'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Internal-API-Key': expect.any(String),
          }),
          body: expect.stringContaining('text'),
        }),
      );

      // Cleanup
      delete (global as Record<string, unknown>).fetch;
    });

    it('AC-2: should return null when no chunks exist', async () => {
      const prismaEmbeddingMock =
        prisma.embedding.findMany as jest.Mock;
      prismaEmbeddingMock.mockResolvedValue([]);

      const result = await service.generateAndSaveSummary(
        mockDocumentId,
      );

      expect(result).toBeNull();

      // Should NOT call fetch or update
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it('AC-3: should return null when AI Worker returns error', async () => {
      const prismaEmbeddingMock =
        prisma.embedding.findMany as jest.Mock;
      prismaEmbeddingMock.mockResolvedValue(mockChunks);

      // Simulate fetch failure
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));

      const result = await service.generateAndSaveSummary(
        mockDocumentId,
      );

      expect(result).toBeNull();

      // Should NOT update document
      expect(prisma.document.update).not.toHaveBeenCalled();

      delete (global as Record<string, unknown>).fetch;
    });

    it('AC-3: should return null when AI Worker returns non-200', async () => {
      const prismaEmbeddingMock =
        prisma.embedding.findMany as jest.Mock;
      prismaEmbeddingMock.mockResolvedValue(mockChunks);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: jest.fn(),
      });

      const result = await service.generateAndSaveSummary(
        mockDocumentId,
      );

      expect(result).toBeNull();
      expect(prisma.document.update).not.toHaveBeenCalled();

      delete (global as Record<string, unknown>).fetch;
    });

    it('should return null when embedding fetch fails', async () => {
      const prismaEmbeddingMock =
        prisma.embedding.findMany as jest.Mock;
      prismaEmbeddingMock.mockRejectedValue(
        new Error('DB error'),
      );

      const result = await service.generateAndSaveSummary(
        mockDocumentId,
      );

      expect(result).toBeNull();
    });

    it('should truncate text to 4000 chars when chunks exceed limit', async () => {
      const longChunks = [
        { chunkText: 'A'.repeat(3000) },
        { chunkText: 'B'.repeat(3000) },
      ];
      const prismaEmbeddingMock =
        prisma.embedding.findMany as jest.Mock;
      prismaEmbeddingMock.mockResolvedValue(longChunks);

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          summary: 'Truncated summary',
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);
      const prismaUpdateMock =
        prisma.document.update as jest.Mock;
      prismaUpdateMock.mockResolvedValue({});

      const result = await service.generateAndSaveSummary(
        mockDocumentId,
      );

      expect(result).toBe('Truncated summary');

      // Verify fetch was called with max 4000 chars
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('text'),
        }),
      );
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.text.length).toBeLessThanOrEqual(4000);

      delete (global as Record<string, unknown>).fetch;
    });
  });
});
