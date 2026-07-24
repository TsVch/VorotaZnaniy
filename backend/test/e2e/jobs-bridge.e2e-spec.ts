import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type {
  INestApplication } from '@nestjs/common';
import {
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { InternalApiKeyGuard } from '../../src/auth/guards/internal-api-key.guard';
import { PrismaService } from '../../src/prisma/prisma.service';

const mockDocumentId = '22222222-2222-2222-2222-222222222222';
const mockJobId = '11111111-1111-1111-1111-111111111111';

describe('JobsBridge (E2E) — Embeddings', () => {
  let app: INestApplication;

  // ── Mock PrismaService to test real JobsBridgeService.saveEmbeddings ──
  // This exercises the real $transaction + $executeRawUnsafe + rawInsertEmbedding chain.
  const mockPrismaService = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $transaction: jest
      .fn()
      .mockImplementation(
        (queries: unknown[]) => Promise.all(queries),
      ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Override auth guard to allow internal access
      .overrideGuard(InternalApiKeyGuard)
      .useValue({ canActivate: () => true })
      // Only mock PrismaService — JobsBridgeService is real
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }),
    );

    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /internal/jobs/:id/embeddings ─────────────────────────

  describe('POST /internal/jobs/:id/embeddings', () => {
    const validPayload = {
      documentId: mockDocumentId,
      embeddings: [
        {
          chunkIndex: 0,
          chunkText: 'First chunk of extracted text from the PDF.',
          embedding: Array.from(
            { length: 1536 },
            (_, i) => (i % 100) * 0.01,
          ),
        },
        {
          chunkIndex: 1,
          chunkText: 'Second chunk with more document content.',
          embedding: Array.from(
            { length: 1536 },
            (_, i) => (i % 50) * 0.02,
          ),
        },
      ],
    };

    it('AC-3: should return 200 and call $transaction with $executeRawUnsafe queries', async () => {
      const response = await request(app.getHttpServer())
        .post(`/internal/jobs/${mockJobId}/embeddings`)
        .set('X-Internal-API-Key', 'test-internal-key')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count', 2);

      // Verify $transaction was called (exercises real saveEmbeddings)
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      const txArg = mockPrismaService.$transaction.mock.calls[0][0];
      expect(Array.isArray(txArg)).toBe(true);
      expect(txArg).toHaveLength(2); // 2 embeddings → 2 queries
    });

    it('should return 400 when embedding array has wrong dimensions', async () => {
      const invalidPayload = {
        documentId: mockDocumentId,
        embeddings: [
          {
            chunkIndex: 0,
            chunkText: 'Bad embedding dimensions.',
            embedding: [0.1, 0.2, 0.3], // Only 3, not 1536
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(`/internal/jobs/${mockJobId}/embeddings`)
        .set('X-Internal-API-Key', 'test-internal-key')
        .send(invalidPayload);

      expect(response.status).toBe(400);
    });

    it('should return 400 when chunkIndex is negative', async () => {
      const invalidPayload = {
        documentId: mockDocumentId,
        embeddings: [
          {
            chunkIndex: -1,
            chunkText: 'Negative index.',
            embedding: Array.from({ length: 1536 }, () => 0.1),
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(`/internal/jobs/${mockJobId}/embeddings`)
        .set('X-Internal-API-Key', 'test-internal-key')
        .send(invalidPayload);

      expect(response.status).toBe(400);
    });

    it('should return 400 when chunkText exceeds 4000 chars', async () => {
      const invalidPayload = {
        documentId: mockDocumentId,
        embeddings: [
          {
            chunkIndex: 0,
            chunkText: 'x'.repeat(4001),
            embedding: Array.from({ length: 1536 }, () => 0.1),
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(`/internal/jobs/${mockJobId}/embeddings`)
        .set('X-Internal-API-Key', 'test-internal-key')
        .send(invalidPayload);

      expect(response.status).toBe(400);
    });

    it('should return 401 without Internal-API-Key header', async () => {
      const response = await request(app.getHttpServer())
        .post(`/internal/jobs/${mockJobId}/embeddings`)
        .send(validPayload);

      expect(response.status).toBe(401);
    });

    it('should return 400 when embeddings array is empty', async () => {
      const invalidPayload = {
        documentId: mockDocumentId,
        embeddings: [],
      };

      const response = await request(app.getHttpServer())
        .post(`/internal/jobs/${mockJobId}/embeddings`)
        .set('X-Internal-API-Key', 'test-internal-key')
        .send(invalidPayload);

      expect(response.status).toBe(400);
    });
  });
});
