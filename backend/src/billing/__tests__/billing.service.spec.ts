import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BillingService } from '../services/billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYMENT_PROVIDER_TOKEN } from '../interfaces/payment-provider.interface';
import { EMAIL_SERVICE_TOKEN } from '../../shared/utils/email.service';

describe('BillingService', () => {
  let service: BillingService;
  let mockPrisma: Record<string, unknown>;
  let mockPaymentProvider: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockPrisma = {
      workspace: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };

    mockPaymentProvider = {
      getProviderName: jest.fn().mockReturnValue('YooKassa'),
      createPayment: jest.fn(),
      validateWebhookSignature: jest.fn(),
      parseWebhookEvent: jest.fn(),
    };

    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PAYMENT_PROVIDER_TOKEN,
          useValue: mockPaymentProvider,
        },
        {
          provide: EMAIL_SERVICE_TOKEN,
          useValue: {
            sendMagicLink: jest.fn(),
            sendPurchaseConfirmation: jest.fn().mockResolvedValue(undefined),
            sendSessionTerminated: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  describe('createPayment', () => {
    const createPaymentDto = {
      workspaceId: 'ws-1',
      amount: 99000,
      currency: 'RUB' as const,
      description: 'Pro Subscription',
      returnUrl: 'http://localhost:3001/success',
    };

    it('should create payment for workspace owner', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'user-1',
      });

      mockPaymentProvider.createPayment.mockResolvedValue({
        confirmationUrl: 'https://yoomoney.ru/payment/123',
        providerTransactionId: 'tx-123',
      });

      const result = await service.createPayment(createPaymentDto, 'user-1');

      expect(result.confirmationUrl).toBe('https://yoomoney.ru/payment/123');
      expect(result.providerTransactionId).toBe('tx-123');
      expect(mockPaymentProvider.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 99000,
          workspaceId: 'ws-1',
        }),
      );
    });

    it('should throw NotFoundException for non-existent workspace', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue(null);

      await expect(
        service.createPayment(createPaymentDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'user-other',
      });

      await expect(
        service.createPayment(createPaymentDto, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return FREE status for free workspace', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        subscriptionStatus: 'FREE',
        subscriptionPlan: 'FREE',
        subscriptionExpiresAt: null,
        activePaymentProvider: 'yookassa',
      });

      const result = await service.getSubscriptionStatus('ws-1');

      expect(result.status).toBe('FREE');
      expect(result.plan).toBe('FREE');
      expect(result.isActive).toBe(false);
      expect(result.daysRemaining).toBeUndefined();
    });

    it('should return ACTIVE status with days remaining', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 25);

      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: 'PRO',
        subscriptionExpiresAt: expiresAt,
        activePaymentProvider: 'yookassa',
      });

      const result = await service.getSubscriptionStatus('ws-1');

      expect(result.status).toBe('ACTIVE');
      expect(result.plan).toBe('PRO');
      expect(result.isActive).toBe(true);
      expect(result.daysRemaining).toBe(25);
    });

    it('should throw NotFoundException for non-existent workspace', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue(null);

      await expect(
        service.getSubscriptionStatus('ws-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('processWebhookEvent', () => {
    const webhookPayload = {
      event: 'payment.succeeded',
      object: {
        id: 'tx-123',
        amount: { value: '990.00', currency: 'RUB' },
        metadata: { workspaceId: 'ws-1' },
      },
    };

    const validSignature = 'valid-sig';

    beforeEach(() => {
      mockPaymentProvider.validateWebhookSignature.mockReturnValue(true);
      mockPaymentProvider.parseWebhookEvent.mockReturnValue({
        eventType: 'payment.succeeded',
        providerTransactionId: 'tx-123',
        workspaceId: 'ws-1',
        providerCustomerId: undefined,
        amount: '990.00',
        currency: 'RUB',
        raw: webhookPayload,
      });
      // handlePaymentSucceeded now does a findUnique first (for recurring check)
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        subscriptionExpiresAt: null,
        subscriptionStatus: 'FREE',
        providerPaymentMethodId: null,
      });
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);
      (mockPrisma.workspace as Record<string, jest.Mock>).update.mockResolvedValue({});
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue([]);
    });

    it('should process payment.succeeded and activate subscription', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const result = await service.processWebhookEvent(
        webhookPayload,
        validSignature,
      );

      expect(result.handled).toBe(true);
      expect(
        (mockPrisma.workspace as Record<string, jest.Mock>).update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-1' },
          data: expect.objectContaining({
            subscriptionStatus: 'ACTIVE',
          }),
        }),
      );
    });

    it('should reject invalid signature', async () => {
      mockPaymentProvider.validateWebhookSignature.mockReturnValue(false);

      const result = await service.processWebhookEvent(
        webhookPayload,
        'invalid-sig',
      );

      expect(result.handled).toBe(false);
      expect(result.message).toBe('Invalid signature');
      expect(
        (mockPrisma.workspace as Record<string, jest.Mock>).update,
      ).not.toHaveBeenCalled();
    });

    it('should skip duplicate events (idempotency)', async () => {
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
        { id: 'existing' },
      ]);

      const result = await service.processWebhookEvent(
        webhookPayload,
        validSignature,
      );

      expect(result.handled).toBe(true);
      expect(result.message).toBe('Already processed');
      expect(
        (mockPrisma.workspace as Record<string, jest.Mock>).update,
      ).not.toHaveBeenCalled();
    });

    it('should reject events with missing transaction ID', async () => {
      mockPaymentProvider.parseWebhookEvent.mockReturnValue({
        eventType: 'payment.succeeded',
        providerTransactionId: '',
        workspaceId: 'ws-1',
        providerCustomerId: undefined,
        amount: '990.00',
        currency: 'RUB',
        raw: webhookPayload,
      });

      const result = await service.processWebhookEvent(
        webhookPayload,
        validSignature,
      );

      expect(result.handled).toBe(false);
      expect(result.message).toBe('Missing transaction or workspace ID');
    });
  });
});
