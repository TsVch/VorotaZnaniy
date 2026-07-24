import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type {
  INestApplication} from '@nestjs/common';
import {
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../../src/prisma/prisma.service';
import { S3Service } from '../../src/shared/utils/s3.service';
import { WatermarkService } from '../../src/access/services/watermark.service';

const mockDocumentId = '00000000-0000-0000-0000-000000000001';
const mockSessionId = '00000000-0000-0000-0000-0000000000s1';
const mockUserId = 'user-uuid-for-e2e';
const mockWorkspaceId = 'workspace-uuid-for-e2e';

const defaultDocument = {
  id: mockDocumentId,
  title: 'E2E Test Document',
  status: 'READY',
  protectionConfig: {
    watermark_enabled: true,
    max_concurrent_sessions: 2,
    allow_text_selection: false,
  },
};

const defaultGrant = {
  id: 'grant-uuid-e2e',
  userId: mockUserId,
  documentId: mockDocumentId,
  isActive: true,
  expiresAt: null,
  grantedAt: new Date(),
};

let lastActivityDate = new Date();

describe('Viewer (E2E)', () => {
  let app: INestApplication;
  let validToken: string;

  const JWT_SECRET = 'test-jwt-secret-for-e2e-tests';

  let sessionCount = 0;

  const mockPrismaService = {
    document: {
      findUnique: jest.fn().mockResolvedValue(defaultDocument),
    },
    documentVersion: {
      findFirst: jest.fn().mockResolvedValue({ pageCount: 100 }),
    },
    accessGrant: {
      findUnique: jest.fn().mockResolvedValue(defaultGrant),
    },
    session: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(() => {
        sessionCount++;
        return {
          id: `${mockSessionId}-${sessionCount}`,
          userId: mockUserId,
          documentId: mockDocumentId,
          isActive: true,
          lastActivity: new Date(),
          deviceFingerprint: null,
          ipAddress: null,
          userAgent: null,
          createdAt: new Date(),
        };
      }),
      findFirst: jest.fn().mockImplementation(
        (args: { where: Record<string, unknown>; include?: Record<string, unknown> }) => {
          // For getPageUrl, the session is found with include.document
          if (args.where.userId !== mockUserId) {
            return null;
          }
          if (args.where.id === 'nonexistent-session') {
            return null;
          }
          if (args.where.id === 'inactive-session') {
            return null; // findFirst with isActive:true won't find inactive
          }
          if (args.include?.document) {
            // getPageUrl uses include: { document: { select: { id, workspaceId } } }
            return {
              id: args.where.id,
              userId: mockUserId,
              documentId: mockDocumentId,
              isActive: true,
              lastActivity: new Date(),
              document: {
                id: mockDocumentId,
                workspaceId: mockWorkspaceId,
              },
            };
          }
          // heartbeat uses simpler select
          if (args.where.id === 'inactive-heartbeat') {
            return {
              id: 'inactive-heartbeat',
              isActive: false,
            };
          }
          return {
            id: args.where.id,
            isActive: true,
          };
        },
      ),
      update: jest.fn().mockImplementation(() => {
        lastActivityDate = new Date();
        return {
          id: mockSessionId,
          lastActivity: lastActivityDate,
        };
      }),
    },
  };

  const mockS3Service = {
    generatePresignedGetUrl: jest
      .fn()
      .mockResolvedValue(
        'https://s3.example.com/bucket/pages/page-1.webp?X-Amz-Signature=e2e-test',
      ),
  };

  const mockWatermarkService = {
    generateWatermarkPayload: jest
      .fn()
      .mockReturnValue({
        userEmail: 'buyer@test.com',
        sessionIdShort: 'mock-ses',
        timestamp: '2026-07-21',
      }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(S3Service)
      .useValue(mockS3Service)
      .overrideProvider(WatermarkService)
      .useValue(mockWatermarkService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }),
    );

    await app.init();

    validToken = jwt.sign(
      {
        sub: mockUserId,
        email: 'buyer@test.com',
        role: 'VIEWER',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /v1/viewer/sessions ───────────────────────────────────────────

  describe('POST /v1/viewer/sessions', () => {
    it('AC-1: should return 200 with session_id, document, and watermark_data for valid request', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.document.findUnique.mockResolvedValue(
        defaultDocument,
      );
      mockPrismaService.accessGrant.findUnique.mockResolvedValue(
        defaultGrant,
      );

      const response = await request(app.getHttpServer())
        .post('/v1/viewer/sessions')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          documentId: mockDocumentId,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('document');
      expect(response.body).toHaveProperty('watermark_data');

      expect(response.body.document).toHaveProperty(
        'id',
        mockDocumentId,
      );
      expect(response.body.document).toHaveProperty(
        'title',
        'E2E Test Document',
      );
      expect(response.body.document).toHaveProperty(
        'protection_config',
      );

      expect(response.body.watermark_data).toHaveProperty(
        'userEmail',
      );
      expect(response.body.watermark_data).toHaveProperty(
        'sessionIdShort',
      );
      expect(response.body.watermark_data).toHaveProperty(
        'timestamp',
      );
    });

    it('AC-2: should return 403 with CONCURRENT_SESSION_LIMIT when session limit exceeded', async () => {
      mockPrismaService.session.count.mockResolvedValue(2);
      mockPrismaService.document.findUnique.mockResolvedValue(
        defaultDocument,
      );
      mockPrismaService.accessGrant.findUnique.mockResolvedValue(
        defaultGrant,
      );

      const response = await request(app.getHttpServer())
        .post('/v1/viewer/sessions')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          documentId: mockDocumentId,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.code).toBe(
        'CONCURRENT_SESSION_LIMIT',
      );
      expect(response.body.error?.details).toHaveProperty(
        'max_sessions',
      );
      expect(response.body.error?.details).toHaveProperty(
        'active_sessions',
      );
    });

    it('AC-3: should return 403 with ACCESS_DENIED when no access grant exists', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.document.findUnique.mockResolvedValue(
        defaultDocument,
      );
      mockPrismaService.accessGrant.findUnique.mockResolvedValue(
        null,
      );

      const response = await request(app.getHttpServer())
        .post('/v1/viewer/sessions')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          documentId: mockDocumentId,
        });

      expect(response.status).toBe(403);
      expect(response.body.error?.code).toBe('ACCESS_DENIED');
    });

    it('should return 400 when documentId is not a valid UUID', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/viewer/sessions')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          documentId: 'not-a-uuid',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 when documentId is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/viewer/sessions')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 401 without Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/viewer/sessions')
        .send({
          documentId: mockDocumentId,
        });

      expect(response.status).toBe(401);
    });
  });

  // ── POST /v1/viewer/sessions/:sessionId/heartbeat ─────────────────────

  describe('POST /v1/viewer/sessions/:sessionId/heartbeat', () => {
    it('AC-1: should return 200 with valid=true for an active session', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/viewer/sessions/${mockSessionId}/heartbeat`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        valid: true,
        nextHeartbeatIn: 60,
      });
    });

    it('AC-2: should return valid=false for an inactive session', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/viewer/sessions/inactive-heartbeat/heartbeat')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        valid: false,
        reason: 'SESSION_TERMINATED',
      });
    });

    it('AC-3: should return valid=false for a non-existent session', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/viewer/sessions/nonexistent-session/heartbeat')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        valid: false,
        reason: 'SESSION_TERMINATED',
      });
    });

    it('should return 401 without Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/viewer/sessions/${mockSessionId}/heartbeat`);

      expect(response.status).toBe(401);
    });
  });

  // ── GET /v1/viewer/sessions/:sessionId/pages/:pageNumber ──────────────

  describe('GET /v1/viewer/sessions/:sessionId/pages/:pageNumber', () => {
    it('AC-1: should return 200 with presigned URL for a valid session and page', async () => {
      mockS3Service.generatePresignedGetUrl.mockResolvedValue(
        'https://s3.example.com/bucket/pages/page-1.webp?X-Amz-Signature=e2e-test',
      );

      const response = await request(app.getHttpServer())
        .get(`/v1/viewer/sessions/${mockSessionId}/pages/1`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('expires_in', 60);
      expect(typeof response.body.url).toBe('string');
      expect(response.body.url).toContain('s3.example.com');
    });

    it('AC-2/AC-4: should return 403 for an invalid or expired session', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/viewer/sessions/nonexistent-session/pages/1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error?.code).toBe('SESSION_INVALID');
    });

    it('should return 400 for page number 0 (invalid)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/viewer/sessions/${mockSessionId}/pages/0`)
        .set('Authorization', `Bearer ${validToken}`);

      // ParseIntPipe returns 400 for invalid pageNumber, or controller returns 403 for < 1
      expect([400, 403]).toContain(response.status);
    });

    it('should return 400 for non-numeric page number', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/viewer/sessions/${mockSessionId}/pages/abc`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
    });

    it('AC-3: should return 404 when pageNumber exceeds document page count', async () => {
      mockPrismaService.documentVersion.findFirst.mockResolvedValue({
        pageCount: 5,
      });

      const response = await request(app.getHttpServer())
        .get(`/v1/viewer/sessions/${mockSessionId}/pages/99`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error?.code).toBe('PAGE_NOT_FOUND');
    });

    it('should return 401 without Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/viewer/sessions/${mockSessionId}/pages/1`);

      expect(response.status).toBe(401);
    });
  });
});
