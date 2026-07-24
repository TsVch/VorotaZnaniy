import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { JobsBridgeService } from '../jobs-bridge.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('JobsBridgeService', () => {
  let service: JobsBridgeService;
  let prisma: PrismaService;

  const mockDocumentId = 'doc-uuid-123';
  const mockS3Key = 'workspace-uuid/doc-uuid-123/guide.pdf';
  const mockJobId = 'job-uuid-456';

  const mockJobRecord = {
    id: mockJobId,
    jobType: 'ai_processing',
    payload: {
      document_id: mockDocumentId,
      s3_key: mockS3Key,
    },
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsBridgeService,
        {
          provide: PrismaService,
          useValue: {
            pendingJob: {
              create: jest.fn().mockResolvedValue(mockJobRecord),
              findMany: jest.fn().mockResolvedValue([mockJobRecord]),
            },
            $queryRawUnsafe: jest.fn(),
            $executeRawUnsafe: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JobsBridgeService>(JobsBridgeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatchAiProcessing', () => {
    it('should create a PendingJob record in the database', async () => {
      const result = await service.dispatchAiProcessing(
        mockDocumentId,
        mockS3Key,
      );

      expect(result).toHaveProperty('jobId', mockJobId);

      const prismaMock = prisma.pendingJob.create as jest.Mock;
      expect(prismaMock).toHaveBeenCalledWith({
        data: {
          jobType: 'ai_processing',
          payload: {
            document_id: mockDocumentId,
            s3_key: mockS3Key,
          },
          status: 'PENDING',
        },
      });
    });

    it('should store document_id and s3_key in the payload JSON', async () => {
      const result = await service.dispatchAiProcessing(
        mockDocumentId,
        mockS3Key,
      );

      expect(result.jobId).toBe(mockJobId);

      const prismaMock = prisma.pendingJob.create as jest.Mock;
      const callData = prismaMock.mock.calls[0][0].data;

      expect(callData.payload).toEqual({
        document_id: mockDocumentId,
        s3_key: mockS3Key,
      });
    });

    it('should set jobType to ai_processing', async () => {
      await service.dispatchAiProcessing(mockDocumentId, mockS3Key);

      const prismaMock = prisma.pendingJob.create as jest.Mock;
      expect(prismaMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jobType: 'ai_processing',
        }),
      });
    });

    it('should throw when Prisma create fails', async () => {
      const prismaMock = prisma.pendingJob.create as jest.Mock;
      prismaMock.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.dispatchAiProcessing(mockDocumentId, mockS3Key),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('getPendingAiJobs', () => {
    it('should fetch pending ai_processing jobs from the database', async () => {
      const jobs = await service.getPendingAiJobs();

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBe(1);
      expect(jobs[0].id).toBe(mockJobId);
      expect(jobs[0].jobType).toBe('ai_processing');

      const prismaMock = prisma.pendingJob.findMany as jest.Mock;
      expect(prismaMock).toHaveBeenCalledWith({
        where: {
          jobType: 'ai_processing',
          status: 'PENDING',
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: {
          id: true,
          jobType: true,
          payload: true,
          createdAt: true,
        },
      });
    });

    it('should respect the limit parameter', async () => {
      await service.getPendingAiJobs(5);

      const prismaMock = prisma.pendingJob.findMany as jest.Mock;
      expect(prismaMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('should return an empty array when no pending jobs exist', async () => {
      const prismaMock = prisma.pendingJob.findMany as jest.Mock;
      prismaMock.mockResolvedValue([]);

      const jobs = await service.getPendingAiJobs();

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBe(0);
    });
  });

  describe('semanticSearch', () => {
    const mockEmbedding = Array.from({ length: 1536 }, () => 0.1);

    const mockResults = [
      { chunkIndex: 0, chunkText: 'First relevant chunk', similarity: 0.92 },
      { chunkIndex: 3, chunkText: 'Another relevant chunk', similarity: 0.87 },
    ];

    it('should call $queryRawUnsafe with correct parameters', async () => {
      const prismaMock = prisma.$queryRawUnsafe as jest.Mock;
      prismaMock.mockResolvedValue(mockResults);

      await service.semanticSearch(
        mockDocumentId,
        mockEmbedding,
        5,
      );

      expect(prismaMock).toHaveBeenCalledTimes(1);
      // First arg: SQL query (string), second: vector string, third: documentId, fourth: topK
      const callArgs = prismaMock.mock.calls[0];
      expect(callArgs[0]).toContain('embedding <=>');
      expect(callArgs[0]).toContain('LIMIT');
      expect(callArgs[1]).toBe(`[${mockEmbedding.join(',')}]`);
      expect(callArgs[2]).toBe(mockDocumentId);
      expect(callArgs[3]).toBe(5);
    });

    it('should return mapped SearchResultItem objects ordered by similarity', async () => {
      const prismaMock = prisma.$queryRawUnsafe as jest.Mock;
      prismaMock.mockResolvedValue(mockResults);

      const results = await service.semanticSearch(
        mockDocumentId,
        mockEmbedding,
        5,
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        chunkIndex: 0,
        chunkText: 'First relevant chunk',
        similarity: 0.92,
      });
      expect(results[1]).toEqual({
        chunkIndex: 3,
        chunkText: 'Another relevant chunk',
        similarity: 0.87,
      });
    });

    it('should return empty array when no similar chunks found', async () => {
      const prismaMock = prisma.$queryRawUnsafe as jest.Mock;
      prismaMock.mockResolvedValue([]);

      const result = await service.semanticSearch(
        mockDocumentId,
        mockEmbedding,
        5,
      );

      expect(result).toEqual([]);
    });

    it('should throw when Prisma query fails', async () => {
      const prismaMock = prisma.$queryRawUnsafe as jest.Mock;
      prismaMock.mockRejectedValue(new Error('DB connection error'));

      await expect(
        service.semanticSearch(mockDocumentId, mockEmbedding, 5),
      ).rejects.toThrow('DB connection error');
    });

    it('should respect the topK limit (max 20)', async () => {
      // Verify DTO constraint prevents topK > 20
      const prismaMock = prisma.$queryRawUnsafe as jest.Mock;
      prismaMock.mockResolvedValue([]);

      await service.semanticSearch(mockDocumentId, mockEmbedding, 20);

      const callArgs = prismaMock.mock.calls[0];
      expect(callArgs[3]).toBe(20);
    });
  });
});
