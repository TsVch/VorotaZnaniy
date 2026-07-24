import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BillingService } from '../services/billing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYMENT_PROVIDER_TOKEN } from '../interfaces/payment-provider.interface';
import { EMAIL_SERVICE_TOKEN } from '../../shared/utils/email.service';

describe('BillingService (Subscription Management)', () => {
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
      createRecurringPayment: jest.fn(),
      cancelSubscription: jest.fn(),
      getPaymentMethods: jest.fn(),
      validateWebhookSignature: jest.fn(),
      parseWebhookEvent: jest.fn(),
    };

    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PAYMENT_PROVIDER_TOKEN, useValue: mockPaymentProvider },
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

  describe('cancelSubscription', () => {
    it('should cancel active subscription', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'user-1',
        subscriptionStatus: 'ACTIVE',
      });

      await service.cancelSubscription('ws-1', 'user-1');

      expect(mockPaymentProvider.cancelSubscription).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
      });
      expect(
        (mockPrisma.workspace as Record<string, jest.Mock>).update,
      ).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { subscriptionStatus: 'CANCELLED' },
      });
    });

    it('should throw NotFoundException for non-existent workspace', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue(null);

      await expect(
        service.cancelSubscription('ws-nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'user-other',
        subscriptionStatus: 'ACTIVE',
      });

      await expect(
        service.cancelSubscription('ws-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if not active', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'user-1',
        subscriptionStatus: 'FREE',
      });

      await expect(
        service.cancelSubscription('ws-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSubscriptionHistory', () => {
    it('should return payment history', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: new Date('2026-08-23'),
        providerPaymentMethodId: 'pm-123',
      });

      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
        {
          providerTransactionId: 'tx-1',
          eventType: 'payment.succeeded',
          workspaceId: 'ws-1',
          processedAt: new Date('2026-07-23'),
        },
        {
          providerTransactionId: 'tx-2',
          eventType: 'payment.succeeded',
          workspaceId: 'ws-1',
          processedAt: new Date('2026-06-23'),
        },
      ]);

      const result = await service.getSubscriptionHistory('ws-1');

      expect(result.payments).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.subscriptionStatus).toBe('ACTIVE');
      expect(result.paymentMethod).toBeDefined();
    });

    it('should handle missing processed_payments table', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        subscriptionStatus: 'FREE',
        subscriptionExpiresAt: null,
        providerPaymentMethodId: null,
      });

      (mockPrisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('relation does not exist'),
      );

      const result = await service.getSubscriptionHistory('ws-1');

      expect(result.payments).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.paymentMethod).toBeUndefined();
    });

    it('should throw NotFoundException for non-existent workspace', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue(null);

      await expect(
        service.getSubscriptionHistory('ws-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('processWebhookEvent — recurring payment', () => {
    const webhookPayload = {
      event: 'payment.succeeded',
      object: {
        id: 'tx-recurring-1',
        amount: { value: '990.00', currency: 'RUB' },
        metadata: { workspaceId: 'ws-1', paymentType: 'recurring' },
        payment_method: { id: 'pm-456', saved: true, type: 'bank_card' },
      },
    };

    beforeEach(() => {
      mockPaymentProvider.validateWebhookSignature.mockReturnValue(true);
      mockPaymentProvider.parseWebhookEvent.mockReturnValue({
        eventType: 'payment.succeeded',
        providerTransactionId: 'tx-recurring-1',
        workspaceId: 'ws-1',
        amount: '990.00',
        currency: 'RUB',
        isRecurring: true,
        paymentMethodId: 'pm-456',
        raw: webhookPayload,
      });
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);
      (mockPrisma.workspace as Record<string, jest.Mock>).update.mockResolvedValue({});
      (mockPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue([]);
    });

    it('should extend subscription from current expiry for recurring payment', async () => {
      const currentExpiry = new Date('2026-08-20');
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        subscriptionExpiresAt: currentExpiry,
        subscriptionStatus: 'ACTIVE',
        providerPaymentMethodId: 'pm-123',
      });

      const result = await service.processWebhookEvent(webhookPayload, 'valid-sig');

      expect(result.handled).toBe(true);
      expect(
        (mockPrisma.workspace as Record<string, jest.Mock>).update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-1' },
          data: expect.objectContaining({
            subscriptionStatus: 'ACTIVE',
            subscriptionPlan: 'PRO',
          }),
        }),
      );

      // Verify the new expiry is currentExpiry + 30 days
      const updateCall = (mockPrisma.workspace as Record<string, jest.Mock>).update.mock.calls[0][0];
      const newExpiry = updateCall.data.subscriptionExpiresAt as Date;
      const expectedExpiry = new Date(currentExpiry);
      expectedExpiry.setDate(expectedExpiry.getDate() + 30);
      expect(newExpiry.getTime()).toBeCloseTo(expectedExpiry.getTime(), -2);
    });

    it('should handle recurring payment when subscription already expired', async () => {
      const pastExpiry = new Date('2026-06-01');
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        subscriptionExpiresAt: pastExpiry,
        subscriptionStatus: 'ACTIVE',
        providerPaymentMethodId: null,
      });

      const result = await service.processWebhookEvent(webhookPayload, 'valid-sig');

      expect(result.handled).toBe(true);
      expect(
        (mockPrisma.workspace as Record<string, jest.Mock>).update,
      ).toHaveBeenCalled();

      // New expiry should be 30 days from now (not from past)
      const updateCall = (mockPrisma.workspace as Record<string, jest.Mock>).update.mock.calls[0][0];
      const newExpiry = updateCall.data.subscriptionExpiresAt as Date;
      const expected = new Date();
      expected.setDate(expected.getDate() + 30);
      expect(newExpiry.getTime()).toBeCloseTo(expected.getTime(), -2);
    });

    it('should save new payment method ID from recurring webhook', async () => {
      (mockPrisma.workspace as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        subscriptionExpiresAt: new Date('2026-08-20'),
        subscriptionStatus: 'ACTIVE',
        providerPaymentMethodId: 'pm-old',
      });

      await service.processWebhookEvent(webhookPayload, 'valid-sig');

      const updateCall = (mockPrisma.workspace as Record<string, jest.Mock>).update.mock.calls[0][0];
      expect(updateCall.data.providerPaymentMethodId).toBe('pm-456');
    });
  });
});
