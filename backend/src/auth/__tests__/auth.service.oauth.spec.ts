import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { EMAIL_SERVICE_TOKEN } from '../../shared/utils/email.service';
import type { OAuthProfile } from '../dto/oauth-profile';

describe('AuthService — validateOAuthUser', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockJwtSecret = 'test-jwt-secret-for-oauth-tests';

  const existingUser = {
    id: 'existing-user-uuid',
    email: 'existing@example.com',
    role: 'CREATOR',
  };

  const newProfile: OAuthProfile = {
    email: 'new-oauth@example.com',
    provider: 'google',
    providerId: 'google-id-123',
    name: 'New OAuth User',
    avatarUrl: 'https://example.com/avatar.png',
  };

  const existingProfile: OAuthProfile = {
    email: 'existing@example.com',
    provider: 'github',
    providerId: 'github-id-456',
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
            createDefaultWorkspace: jest.fn().mockResolvedValue('ws-mock-oauth'),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── New user creation ───────────────────────────────────────────────────

  it('should create a new user for first-time OAuth login', async () => {
    // No existing user with this email
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    // Mock user creation result
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'new-oauth-uuid',
      email: newProfile.email,
      role: 'CREATOR',
    });

    const result = await service.validateOAuthUser(newProfile);

    // Should create user without passwordHash
    const createCall = (prisma.user.create as jest.Mock).mock.calls[0][0]
      .data;
    expect(createCall.email).toBe(newProfile.email);
    expect(createCall.passwordHash).toBeUndefined();
    expect(createCall.role).toBe('CREATOR');
    expect(createCall.name).toBe(newProfile.name);
    expect(createCall.avatarUrl).toBe(newProfile.avatarUrl);

    // Should return tokens and user info
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.email).toBe(newProfile.email);
    expect(result.user.role).toBe('CREATOR');
  });

  // ── Existing user linking ───────────────────────────────────────────────

  it('AC-3: should return existing user when email matches', async () => {
    // User already exists (e.g., registered via email/password)
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);

    const result = await service.validateOAuthUser(existingProfile);

    // Should NOT create a new user
    expect(prisma.user.create).not.toHaveBeenCalled();

    // Should return tokens for the existing user
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.email).toBe(existingUser.email);
    expect(result.user.id).toBe(existingUser.id);

    // Token should contain correct user info
    const payload = jwt.verify(
      result.accessToken,
      mockJwtSecret,
    ) as jwt.JwtPayload;
    expect(payload.sub).toBe(existingUser.id);
    expect(payload.email).toBe(existingUser.email);
  });

  // ── Missing email rejection ────────────────────────────────────────────

  it('should reject OAuth profile without email', async () => {
    const badProfile: OAuthProfile = {
      email: '',
      provider: 'google',
      providerId: 'no-email-id',
    };

    await expect(
      service.validateOAuthUser(badProfile),
    ).rejects.toThrow(UnauthorizedException);

    // No DB writes should occur
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
