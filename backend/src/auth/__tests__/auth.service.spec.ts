import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { EMAIL_SERVICE_TOKEN } from '../../shared/utils/email.service';

// ── Mock bcrypt (C++ native module — jest.spyOn won't work) ──────────────
// IMPORTANT: mock factory must not reference outer scope variables —
// jest.mock() is hoisted before all declarations, causing TDZ errors.
jest.mock('bcrypt', () => ({
  hash: jest
    .fn()
    .mockResolvedValue('$2b$12$hashedpassword1234567890abcdefghijklmnopqrstuvw'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

const MOCK_HASH = '$2b$12$hashedpassword1234567890abcdefghijklmnopqrstuvw';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let workspacesService: WorkspacesService;

  const mockJwtSecret = 'test-jwt-secret-for-unit-tests';

  const mockUser = {
    id: 'user-uuid-123',
    email: 'newuser@example.com',
    role: 'CREATOR',
    passwordHash: MOCK_HASH,
    defaultWorkspaceId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                JWT_SECRET: mockJwtSecret,
              };
              return config[key];
            }),
          },
        },
        {
          provide: WorkspacesService,
          useValue: {
            createDefaultWorkspace: jest.fn().mockResolvedValue('ws-mock-id'),
          },
        },
        {
          provide: EMAIL_SERVICE_TOKEN,
          useValue: {
            sendMagicLink: jest.fn(),
            sendPurchaseConfirmation: jest.fn(),
            sendSessionTerminated: jest.fn(),
            sendPasswordChanged: jest.fn(),
            sendNewDeviceLogin: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    workspacesService = module.get<WorkspacesService>(WorkspacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Register ───────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      email: '  NewUser@Example.com  ',
      password: 'SecurePass123',
    };

    it('AC-1: should create user, hash password, and return tokens', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('newuser@example.com');
      expect(result.user.role).toBe('CREATOR');

      // AC-1 (TASK-012.14): default workspace is exposed in the auth
      // response so the frontend can attach X-Workspace-Id automatically
      expect(result.user.defaultWorkspaceId).toBe('ws-mock-id');

      // New users are created with the CREATOR role (can upload documents)
      const createCall = (prisma.user.create as jest.Mock).mock
        .calls[0][0].data;
      expect(createCall.email).toBe('newuser@example.com');
      expect(createCall.role).toBe('CREATOR');
      expect(createCall.passwordHash).not.toBe('SecurePass123');
      expect(createCall.passwordHash).toBe(MOCK_HASH);

      // Default workspace should be created (AC-1)
      expect(workspacesService.createDefaultWorkspace).toHaveBeenCalledWith(
        mockUser.id,
        'newuser@example.com',
      );

      // Generated tokens should be valid JWTs
      const accessPayload = jwt.verify(
        result.accessToken,
        mockJwtSecret,
      ) as jwt.JwtPayload;
      expect(accessPayload.sub).toBe(mockUser.id);
      expect(accessPayload.email).toBe('newuser@example.com');
    });

    it('AC-4: should throw ConflictException when email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-uuid',
      });

      await expect(
        service.register(registerDto),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await service.register(registerDto);

      const findCall = (prisma.user.findUnique as jest.Mock).mock
        .calls[0][0];
      expect(findCall.where.email).toBe('newuser@example.com');
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123',
    };

    const loginMockUser = {
      ...mockUser,
      email: 'test@example.com',
    };

    it('AC-2: should return tokens for valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(loginMockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(loginMockUser.email);
      expect(result.user.role).toBe(loginMockUser.role);
    });

    it('AC-3: should throw UnauthorizedException for wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(loginMockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      let error: UnauthorizedException | undefined;
      try {
        await service.login(loginDto);
      } catch (e) {
        error = e as UnauthorizedException;
      }

      expect(error).toBeDefined();
      expect(error?.message).toBe('Invalid email or password');
    });

    it('AC-3: should throw UnauthorizedException for non-existent email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      let error: UnauthorizedException | undefined;
      try {
        await service.login(loginDto);
      } catch (e) {
        error = e as UnauthorizedException;
      }

      expect(error).toBeDefined();
      expect(error?.message).toBe('Invalid email or password');
    });

    it('should throw UnauthorizedException when user has no password hash', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...loginMockUser,
        passwordHash: null,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should normalize email to lowercase during login', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(loginMockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({ ...loginDto, email: '  Test@Example.com  ' });

      const findCall = (prisma.user.findUnique as jest.Mock).mock
        .calls[0][0];
      expect(findCall.where.email).toBe('test@example.com');
    });
  });

  // ── Refresh ─────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('AC-5: should return new access token for valid refresh token', async () => {
      const refreshToken = jwt.sign(
        { sub: mockUser.id },
        mockJwtSecret,
        { expiresIn: '7d' },
      );

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.refresh(refreshToken);

      expect(result).toHaveProperty('accessToken');

      const payload = jwt.verify(
        result.accessToken,
        mockJwtSecret,
      ) as jwt.JwtPayload;
      expect(payload.sub).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { sub: mockUser.id },
        mockJwtSecret,
        { expiresIn: '0s' },
      );

      await expect(service.refresh(expiredToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      await expect(
        service.refresh('invalid-token-string'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is deleted', async () => {
      const refreshToken = jwt.sign(
        { sub: 'deleted-user-uuid' },
        mockJwtSecret,
        { expiresIn: '7d' },
      );

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
