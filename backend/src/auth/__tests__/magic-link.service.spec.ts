import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, BadRequestException } from '@nestjs/common';
import { MagicLinkService } from '../services/magic-link.service';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import {
  EMAIL_SERVICE_TOKEN,
  type EmailService,
} from '../../shared/utils/email.service';

// ── Mock EmailService ─────────────────────────────────────────────────────

const mockEmailService: EmailService = {
  sendMagicLink: jest.fn().mockResolvedValue(undefined),
  sendPurchaseConfirmation: jest.fn().mockResolvedValue(undefined),
  sendSessionTerminated: jest.fn().mockResolvedValue(undefined),
  sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
  sendNewDeviceLogin: jest.fn().mockResolvedValue(undefined),
};

// ── Mock AuthService ──────────────────────────────────────────────────────

const mockAuthService = {
  generateTokens: jest.fn().mockReturnValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  }),
};

describe('MagicLinkService', () => {
  let service: MagicLinkService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MagicLinkService,
        {
          provide: PrismaService,
          useValue: {
            verificationToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                MAGIC_LINK_EXPIRY_MINUTES: 15,
                FRONTEND_URL: 'http://localhost:3001',
              };
              return config[key];
            }),
          },
        },
        {
          provide: WorkspacesService,
          useValue: {
            createDefaultWorkspace: jest.fn().mockResolvedValue('ws-mock-magic'),
          },
        },
        {
          provide: EMAIL_SERVICE_TOKEN,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<MagicLinkService>(MagicLinkService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Request (Anti-enumeration) ──────────────────────────────────────────

  describe('request', () => {
    const testEmail = 'test@example.com';
    const neutralMessage =
      'If an account with this email exists, we have sent a magic link. Please check your inbox.';

    it('AC-1/AC-2: should return neutral message on success', async () => {
      (prisma.verificationToken.create as jest.Mock).mockResolvedValue({
        id: 'token-uuid',
      });

      const result = await service.request(testEmail);

      expect(result).toEqual({ message: neutralMessage });
      expect(prisma.verificationToken.create).toHaveBeenCalled();
      expect(mockEmailService.sendMagicLink).toHaveBeenCalled();
    });

    it('AC-1/AC-2: should return neutral message even on DB error (anti-enumeration)', async () => {
      (prisma.verificationToken.create as jest.Mock).mockRejectedValue(
        new Error('DB connection failed'),
      );

      const result = await service.request(testEmail);

      // Must return same message, NOT throw an error — prevents user enumeration
      expect(result).toEqual({ message: neutralMessage });
    });

    it('should enforce rate limit: max 3 requests per hour per email', async () => {
      (prisma.verificationToken.create as jest.Mock).mockResolvedValue({
        id: 'token-uuid',
      });

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const result = await service.request(testEmail);
        expect(result).toEqual({ message: neutralMessage });
      }

      // 4th request should throw 429
      await expect(service.request(testEmail)).rejects.toThrow(
        HttpException,
      );
      await expect(service.request(testEmail)).rejects.toThrow(
        'Too many requests',
      );
    });

    it('should normalize email to lowercase', async () => {
      (prisma.verificationToken.create as jest.Mock).mockResolvedValue({
        id: 'token-uuid',
      });

      await service.request('  Test@Example.COM  ');

      const createCall = (prisma.verificationToken.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.data.email).toBe('test@example.com');
    });
  });

  // ── Verify ──────────────────────────────────────────────────────────────

  describe('verify', () => {
    const validToken = 'a'.repeat(64);
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);

    const mockTokenRecord = {
      id: 'record-uuid',
      email: 'user@example.com',
      token: validToken,
      expiresAt: futureDate,
    };

    it('AC-3: should verify valid token, delete it, and return JWT tokens', async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(
        mockTokenRecord,
      );
      (prisma.verificationToken.delete as jest.Mock).mockResolvedValue(
        mockTokenRecord,
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-uuid',
        email: 'user@example.com',
        role: 'CREATOR',
        defaultWorkspaceId: null,
      });

      const result = await service.verify(validToken);

      // Token should be deleted
      expect(prisma.verificationToken.delete).toHaveBeenCalledWith({
        where: { id: mockTokenRecord.id },
      });

      // Should return tokens
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('user@example.com');

      // Should NOT create a new user (existing one found)
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('AC-3: should create new user if email not found', async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(
        mockTokenRecord,
      );
      (prisma.verificationToken.delete as jest.Mock).mockResolvedValue(
        mockTokenRecord,
      );
      // No existing user
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'new-user-uuid',
        email: 'user@example.com',
        role: 'CREATOR',
        defaultWorkspaceId: 'ws-mock-magic',
      });

      const result = await service.verify(validToken);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'user@example.com', role: 'CREATOR' },
        select: { id: true, email: true, role: true, defaultWorkspaceId: true },
      });
      expect(result.user.email).toBe('user@example.com');
    });

    it('AC-4: should reject expired token and delete it', async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue({
        ...mockTokenRecord,
        expiresAt: pastDate,
      });
      // delete must return a Promise — service uses .catch() on it
      (prisma.verificationToken.delete as jest.Mock).mockResolvedValue(
        mockTokenRecord,
      );

      await expect(service.verify(validToken)).rejects.toThrow(
        BadRequestException,
      );

      // Expired token should be cleaned up
      expect(prisma.verificationToken.delete).toHaveBeenCalled();
    });

    it('AC-4: should reject already-used (missing) token', async () => {
      (prisma.verificationToken.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.verify(validToken)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.verificationToken.delete).not.toHaveBeenCalled();
    });

    it('AC-4: should reject replay attack (token already deleted)', async () => {
      // First call — token exists and is valid
      (prisma.verificationToken.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockTokenRecord)
        .mockResolvedValueOnce(null); // Second call — token is gone
      (prisma.verificationToken.delete as jest.Mock).mockResolvedValue(
        mockTokenRecord,
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-uuid',
        email: 'user@example.com',
        role: 'CREATOR',
      });

      // First verify succeeds
      await service.verify(validToken);

      // Second verify with same token should fail
      await expect(service.verify(validToken)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
