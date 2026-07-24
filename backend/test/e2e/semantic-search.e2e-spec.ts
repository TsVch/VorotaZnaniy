import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JobsBridgeModule } from '../../src/jobs-bridge/jobs-bridge.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { InternalApiKeyGuard } from '../../src/auth/guards/internal-api-key.guard';

describe('SemanticSearch (E2E)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([] as never),
    $executeRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
    pendingJob: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const validEmbedding = Array.from({ length: 1536 }, () => 0.1);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [JobsBridgeModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      // Override the InternalApiKeyGuard to always pass in tests
      .overrideGuard(InternalApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply global ValidationPipe matching production config
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // Happy path
  // ------------------------------------------------------------------

  it('POST /internal/search/semantic — 200 with results for valid payload', async () => {
    const mockRows = [
      { chunkIndex: 0, chunkText: 'Relevant text', similarity: 0.95 },
    ];
    mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockRows);

    const res = await request(app.getHttpServer())
      .post('/internal/search/semantic')
      .send({
        documentId: '00000000-0000-0000-0000-000000000001',
        queryEmbedding: validEmbedding,
        topK: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].chunkIndex).toBe(0);
    expect(res.body.results[0].similarity).toBe(0.95);
  });

  // ------------------------------------------------------------------
  // DTO validation — topK out of range
  // ------------------------------------------------------------------

  it('POST /internal/search/semantic — 400 when topK > 20', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/search/semantic')
      .send({
        documentId: '00000000-0000-0000-0000-000000000001',
        queryEmbedding: validEmbedding,
        topK: 21,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
    // Should mention topK in the validation error
    const errorStr = JSON.stringify(res.body.message);
    expect(errorStr).toContain('topK');
  });

  it('POST /internal/search/semantic — 400 when topK < 1', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/search/semantic')
      .send({
        documentId: '00000000-0000-0000-0000-000000000001',
        queryEmbedding: validEmbedding,
        topK: 0,
      });

    expect(res.status).toBe(400);
  });

  // ------------------------------------------------------------------
  // DTO validation — embedding dimensions
  // ------------------------------------------------------------------

  it('POST /internal/search/semantic — 400 when queryEmbedding has wrong dimensions', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/search/semantic')
      .send({
        documentId: '00000000-0000-0000-0000-000000000001',
        queryEmbedding: [0.1, 0.2, 0.3], // 3 instead of 1536
        topK: 5,
      });

    expect(res.status).toBe(400);
  });

  it('POST /internal/search/semantic — 400 when queryEmbedding is empty', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/search/semantic')
      .send({
        documentId: '00000000-0000-0000-0000-000000000001',
        queryEmbedding: [],
        topK: 5,
      });

    expect(res.status).toBe(400);
  });

  // ------------------------------------------------------------------
  // DTO validation — documentId
  // ------------------------------------------------------------------

  it('POST /internal/search/semantic — 400 when documentId is not UUID', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/search/semantic')
      .send({
        documentId: 'not-a-uuid',
        queryEmbedding: validEmbedding,
        topK: 5,
      });

    expect(res.status).toBe(400);
  });

  // ------------------------------------------------------------------
  // Forbid non-whitelisted fields
  // ------------------------------------------------------------------

  it('POST /internal/search/semantic — 400 when extra unknown fields are sent', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/search/semantic')
      .send({
        documentId: '00000000-0000-0000-0000-000000000001',
        queryEmbedding: validEmbedding,
        topK: 5,
        maliciousField: 'should be stripped',
      });

    expect(res.status).toBe(400);
  });

  // ------------------------------------------------------------------
  // Auth guard
  // ------------------------------------------------------------------

  it('POST /internal/search/semantic — 401 when missing internal API key', async () => {
    // Temporarily restore real guard behaviour to test auth
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [JobsBridgeModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    const unauthApp = moduleFixture.createNestApplication();
    unauthApp.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await unauthApp.init();

    const res = await request(unauthApp.getHttpServer())
      .post('/internal/search/semantic')
      .send({
        documentId: '00000000-0000-0000-0000-000000000001',
        queryEmbedding: validEmbedding,
        topK: 5,
      });

    expect(res.status).toBe(401);

    await unauthApp.close();
  });
});
