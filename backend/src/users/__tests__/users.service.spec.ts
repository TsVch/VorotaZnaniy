import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_SERVICE_TOKEN } from '../../shared/utils/email.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedhash1234567890abcdefghijklmnopqrstuvw'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

// ── Mock EmailService ─────────────────────────────────────────────────────

const mockEmailService = {
  sendMagicLink: jest.fn(),
  sendPurchaseConfirmation: jest.fn(),
  sendSessionTerminated: jest.fn(),
  sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
  sendNewDeviceLogin: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: EMAIL_SERVICE_TOKEN,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-uuid',
    email: 'user@example.com',
    passwordHash: '$2b$12$hashedpassword1234567890abcdefghijklmnopqrstuvw',
  };

  // ── changePassword ─────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('AC-1: should change password and send notification', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.changePassword('user-uuid', 'oldPass123', 'newPass456');

      // Should update password hash
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
        data: { passwordHash: expect.any(String) },
      });

      // Should send notification
      expect(mockEmailService.sendPasswordChanged).toHaveBeenCalledWith(
        'user@example.com',
        'password',
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', 'oldPass', 'newPass'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject wrong current password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-uuid', 'wrongPass', 'newPass'),
      ).rejects.toThrow('Current password is incorrect');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordChanged).not.toHaveBeenCalled();
    });

    it('should reject OAuth-only accounts', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      await expect(
        service.changePassword('user-uuid', 'anyPass', 'newPass'),
      ).rejects.toThrow('Cannot change password for OAuth-only account');
    });
  });

  // ── changeEmail ────────────────────────────────────────────────────────

  describe('changeEmail', () => {
    it('AC-1: should change email and send notification to old email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      // No other user with this email
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);

      await service.changeEmail('user-uuid', 'newemail@example.com');

      // Should update email
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
        data: { email: 'newemail@example.com' },
      });

      // Should send notification to OLD email
      expect(mockEmailService.sendPasswordChanged).toHaveBeenCalledWith(
        'user@example.com',
        'email',
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.changeEmail('nonexistent', 'new@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if email already in use', async () => {
      // First findUnique returns the current user, second returns another user with the new email
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ id: 'other-user-id' });

      await expect(
        service.changeEmail('user-uuid', 'existing@example.com'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
