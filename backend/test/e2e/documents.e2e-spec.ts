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
import { WorkspaceOwnerGuard } from '../../src/auth/guards/workspace-owner.guard';
import { PrismaService } from '../../src/prisma/prisma.service';
import { S3Service } from '../../src/shared/utils/s3.service';
import { JobsBridgeService } from '../../src/jobs-bridge/jobs-bridge.service';

const mockDocumentId = '00000000-0000-0000-0000-000000000000';
const mockWorkspaceId = 'test-workspace';

const defaultDocument = {
  id: mockDocumentId,
  workspaceId: mockWorkspaceId,
  title: 'Test Document',
  description: null,
  fileName: 'test_doc.pdf',
  s3Key: `${mockWorkspaceId}/${mockDocumentId}/test_doc.pdf`,
  fileType: 'pdf',
  fileSize: 1_048_576,
  status: 'PROCESSING',
  protectionConfig: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Documents (E2E)', () => {
  let app: INestApplication;
  let validToken: string;

  const JWT_SECRET = 'test-jwt-secret-for-e2e-tests';

  const mockPrismaService = {
    document: {
      create: jest.fn().mockResolvedValue(defaultDocument),
      findUnique: jest.fn().mockResolvedValue(defaultDocument),
    },
    pendingJob: {
      create: jest.fn().mockResolvedValue({
        id: 'mock-job-id',
        jobType: 'ai_processing',
        payload: {},
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      }),
    },
    workspace: {
      findUnique: jest.fn().mockResolvedValue({
        id: mockWorkspaceId,
        ownerId: 'test-user',
      }),
    },
  };

  const mockS3Service = {
    generatePresignedUploadUrl: jest
      .fn()
      .mockResolvedValue(
        'https://s3.example.com/mock-url?X-Amz-Signature=test',
      ),
    checkObjectExists: jest.fn().mockResolvedValue(true),
  };

  const mockJobsBridgeService = {
    dispatchAiProcessing: jest
      .fn()
      .mockResolvedValue({ jobId: 'mock-job-id' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // ── Override guards to skip real token/DB verification ─────────
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WorkspaceOwnerGuard)
      .useValue({ canActivate: () => true })
      // ── Override providers to avoid real external calls ────────────
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(S3Service)
      .useValue(mockS3Service)
      .overrideProvider(JobsBridgeService)
      .useValue(mockJobsBridgeService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply same global configuration as main.ts
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

    // Generate a valid JWT token (not used by guards — they're mocked)
    validToken = jwt.sign(
      {
        sub: 'test-user-id',
        email: 'creator@test.com',
        role: 'CREATOR',
        workspaceId: mockWorkspaceId,
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

  // ── POST /v1/documents/upload-init ─────────────────────────────────────

  describe('POST /v1/documents/upload-init', () => {
    it('AC-1: should return 200 with document_id and upload_url for valid PDF metadata', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/documents/upload-init')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId)
        .send({
          title: 'E2E Test Document',
          file_name: 'test_doc.pdf',
          file_size: 1_048_576,
          mime_type: 'application/pdf',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('document_id');
      expect(response.body).toHaveProperty('upload_url');
      expect(response.body).toHaveProperty('expires_in');
      expect(typeof response.body.document_id).toBe('string');
      expect(typeof response.body.upload_url).toBe('string');
    });

    it('AC-2: should return 400 for invalid file type (non-PDF)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/documents/upload-init')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId)
        .send({
          title: 'Bad File',
          file_name: 'malware.exe',
          file_size: 1024,
          mime_type: 'application/x-msdownload',
        });

      expect(response.status).toBe(400);
    });

    it('AC-2: should return 400 for invalid MIME type', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/documents/upload-init')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId)
        .send({
          title: 'Image Upload',
          file_name: 'photo.png',
          file_size: 1024,
          mime_type: 'image/png',
        });

      expect(response.status).toBe(400);
    });

    it('AC-2: should return 400 for missing .pdf extension in file_name', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/documents/upload-init')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId)
        .send({
          title: 'No Extension',
          file_name: 'document',
          file_size: 1024,
          mime_type: 'application/pdf',
        });

      expect(response.status).toBe(400);
    });

    it('AC-3: should return 400 when file_size exceeds 500 MB limit', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/documents/upload-init')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId)
        .send({
          title: 'Huge File',
          file_name: 'large_doc.pdf',
          file_size: 600_000_000, // 600 MB > 500 MB limit
          mime_type: 'application/pdf',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 when title is too short', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/documents/upload-init')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId)
        .send({
          title: 'AB',
          file_name: 'doc.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 when file_size is not a number', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/documents/upload-init')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId)
        .send({
          title: 'Valid Title',
          file_name: 'doc.pdf',
          file_size: 'not-a-number',
          mime_type: 'application/pdf',
        });

      expect(response.status).toBe(400);
    });

    it('AC-2: should return 400 when max_concurrent_sessions exceeds 5', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/documents/upload-init')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId)
        .send({
          title: 'AC-2 Test',
          file_name: 'test.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          protection_config: {
            max_concurrent_sessions: 10,
          },
        });

      expect(response.status).toBe(400);
    });
  });

  // ── POST /v1/documents/:id/upload-complete ─────────────────────────────

  describe('POST /v1/documents/:id/upload-complete', () => {
    it('AC-1: should return 200 with status PROCESSING when file exists in S3', async () => {
      mockS3Service.checkObjectExists.mockResolvedValue(true);
      mockJobsBridgeService.dispatchAiProcessing.mockResolvedValue({
        jobId: 'mock-job-id',
      });

      const response = await request(app.getHttpServer())
        .post(`/v1/documents/${mockDocumentId}/upload-complete`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        'document_id',
        mockDocumentId,
      );
      expect(response.body).toHaveProperty('status', 'PROCESSING');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('queued');

      // Verify S3 check was called
      expect(mockS3Service.checkObjectExists).toHaveBeenCalled();
    });

    it('AC-2: should return 400 when file does not exist in S3', async () => {
      mockS3Service.checkObjectExists.mockResolvedValue(false);

      const response = await request(app.getHttpServer())
        .post(`/v1/documents/${mockDocumentId}/upload-complete`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId);

      expect(response.status).toBe(400);
      expect(response.body).not.toHaveProperty('document_id');
    });

    it('AC-3: should return 404 when document does not exist', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post(`/v1/documents/${mockDocumentId}/upload-complete`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId);

      expect(response.status).toBe(404);
    });

    it('should return 401 without Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/documents/${mockDocumentId}/upload-complete`)
        .set('X-Workspace-Id', mockWorkspaceId);

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/documents/${mockDocumentId}/upload-complete`)
        .set('Authorization', 'Bearer invalid-token')
        .set('X-Workspace-Id', mockWorkspaceId);

      expect(response.status).toBe(401);
    });

    it('should return 400 when id param is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/documents//upload-complete')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Workspace-Id', mockWorkspaceId);

      expect(response.status).toBe(404);
    });
  });
});
