import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from '../providers/mock.provider';
import type { CreatePaymentParams } from '../interfaces/payment-provider.interface';
import * as crypto from 'crypto';

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockPaymentProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
          },
        },
      ],
    }).compile();

    provider = module.get<MockPaymentProvider>(MockPaymentProvider);
  });

  describe('getProviderName', () => {
    it('should return "mock"', () => {
      expect(provider.getProviderName()).toBe('mock');
    });
  });

  describe('createPayment', () => {
    const mockParams: CreatePaymentParams = {
      amount: 99000,
      currency: 'RUB',
      workspaceId: 'workspace-uuid-123',
      description: 'Pro Subscription — 1 month',
      returnUrl: 'https://example.com/return',
      savePaymentMethod: true,
    };

    it('should return payment response with mock_* paymentId', async () => {
      const result = await provider.createPayment(mockParams);

      expect(result.providerTransactionId).toMatch(/^mock_/);
      expect(result.confirmationUrl).toContain('mock-payment.example.com');
      expect(result.confirmationUrl).toContain(result.providerTransactionId);
      expect(result.raw).toBeDefined();
      expect(result.raw!.workspaceId).toBe('workspace-uuid-123');
      expect(result.raw!.amount).toBe(99000);
    });

    it('should generate unique payment IDs for each call', async () => {
      const result1 = await provider.createPayment(mockParams);
      const result2 = await provider.createPayment(mockParams);

      expect(result1.providerTransactionId).not.toBe(
        result2.providerTransactionId,
      );
    });
  });

  describe('createRecurringPayment', () => {
    it('should return recurring payment response', async () => {
      const result = await provider.createRecurringPayment({
        workspaceId: 'ws-1',
        amount: 99000,
        currency: 'RUB',
        description: 'Auto-renewal',
        paymentMethodId: 'mock_method_abc123',
      });

      expect(result.providerTransactionId).toMatch(/^mock_recurring_/);
      expect(result.confirmationUrl).toBe('');
    });
  });

  describe('cancelSubscription', () => {
    it('should complete without error', async () => {
      await expect(
        provider.cancelSubscription({ workspaceId: 'ws-1' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getPaymentMethods', () => {
    it('should return mock payment methods', async () => {
      const methods = await provider.getPaymentMethods('customer-1');

      expect(Array.isArray(methods)).toBe(true);
      expect(methods.length).toBeGreaterThan(0);
      expect(methods[0].id).toMatch(/^mock_method_/);
      expect(methods[0].type).toBe('bank_card');
      expect(methods[0].last4).toBe('4242');
    });
  });

  describe('validateWebhookSignature', () => {
    it('should always return true', () => {
      expect(provider.validateWebhookSignature('{}', 'any-signature')).toBe(
        true,
      );
      expect(provider.validateWebhookSignature('{invalid}', '')).toBe(true);
    });
  });

  describe('parseWebhookEvent', () => {
    it('should parse mock payment.succeeded payload', () => {
      const paymentId = `mock_${crypto.randomUUID()}`;
      const payload: Record<string, unknown> = {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: paymentId,
          status: 'succeeded',
          amount: { value: '990.00', currency: 'RUB' },
          metadata: { workspaceId: 'ws-123' },
        },
      };

      const event = provider.parseWebhookEvent(payload);

      expect(event.eventType).toBe('payment.succeeded');
      expect(event.providerTransactionId).toBe(paymentId);
      expect(event.workspaceId).toBe('ws-123');
      expect(event.amount).toBe('990.00');
      expect(event.currency).toBe('RUB');
    });

    it('should handle payloads without event wrapper', () => {
      const payload: Record<string, unknown> = {
        id: 'mock_direct',
        metadata: { workspaceId: 'ws-456' },
        amount: { value: '500.00', currency: 'USD' },
      };

      const event = provider.parseWebhookEvent(payload);

      expect(event.eventType).toBe('payment.succeeded');
      expect(event.providerTransactionId).toBe('mock_direct');
      expect(event.workspaceId).toBe('ws-456');
      expect(event.amount).toBe('500.00');
      expect(event.currency).toBe('USD');
    });
  });
});
