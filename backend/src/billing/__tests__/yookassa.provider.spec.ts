import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { YooKassaPaymentProvider } from '../providers/yookassa.provider';

describe('YooKassaPaymentProvider', () => {
  let provider: YooKassaPaymentProvider;

  const mockConfig = {
    YOOKASSA_SHOP_ID: 'test-shop-id',
    YOOKASSA_SECRET_KEY: 'test-secret-key',
    YOOKASSA_WEBHOOK_SECRET: 'test-webhook-secret',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YooKassaPaymentProvider,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const value = mockConfig[key as keyof typeof mockConfig];
              if (!value) throw new Error(`Missing config: ${key}`);
              return value;
            }),
            get: jest.fn((key: string) => mockConfig[key as keyof typeof mockConfig]),
          },
        },
      ],
    }).compile();

    provider = module.get<YooKassaPaymentProvider>(YooKassaPaymentProvider);
  });

  describe('getProviderName', () => {
    it('should return provider name', () => {
      expect(provider.getProviderName()).toBe('YooKassa');
    });
  });

  describe('createPayment', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create payment and return confirmation URL', async () => {
      const mockResponse = {
        id: 'tx-123',
        status: 'pending',
        confirmation: {
          type: 'redirect',
          confirmationUrl: 'https://yoomoney.ru/payment/123',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.createPayment({
        amount: 99000,
        currency: 'RUB',
        workspaceId: 'ws-1',
        description: 'Pro Subscription',
        returnUrl: 'http://localhost:3001/success',
      });

      expect(result.confirmationUrl).toBe(
        mockResponse.confirmation.confirmationUrl,
      );
      expect(result.providerTransactionId).toBe('tx-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.yookassa.ru/v3/payments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.any(String),
            'Idempotence-Key': expect.any(String),
          }),
        }),
      );
    });

    it('should throw when API returns error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '{"error": "invalid_amount"}',
      });

      await expect(
        provider.createPayment({
          amount: 99000,
          currency: 'RUB',
          workspaceId: 'ws-1',
          description: 'Pro Subscription',
          returnUrl: 'http://localhost:3001/success',
        }),
      ).rejects.toThrow('YooKassa payment creation failed');
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct signature', () => {
      const payload = '{"event":"payment.succeeded"}';
      const validSignature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(payload)
        .digest('hex');

      const result = provider.validateWebhookSignature(payload, validSignature);

      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '{"event":"payment.succeeded"}';
      const result = provider.validateWebhookSignature(
        payload,
        'invalid-signature',
      );

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const result = provider.validateWebhookSignature('', '');
      expect(result).toBe(false);
    });
  });

  describe('createRecurringPayment', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create recurring payment with saved payment method', async () => {
      const mockResponse = {
        id: 'tx-recurring-1',
        status: 'succeeded',
        payment_method: { id: 'pm-123', type: 'bank_card' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.createRecurringPayment({
        amount: 99000,
        currency: 'RUB',
        workspaceId: 'ws-1',
        description: 'Pro Subscription — auto-renewal',
        paymentMethodId: 'pm-123',
      });

      expect(result.providerTransactionId).toBe('tx-recurring-1');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.yookassa.ru/v3/payments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.any(String),
            'Idempotence-Key': expect.any(String),
          }),
        }),
      );

      // Verify the request body includes payment_method_id
      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(requestBody.payment_method_id).toBe('pm-123');
      expect(requestBody.amount.value).toBe('990.00');
      expect(requestBody.metadata.paymentType).toBe('recurring');
    });

    it('should throw when API returns error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '{"error": "payment_method_not_found"}',
      });

      await expect(
        provider.createRecurringPayment({
          amount: 99000,
          currency: 'RUB',
          workspaceId: 'ws-1',
          description: 'Auto-renewal',
          paymentMethodId: 'pm-invalid',
        }),
      ).rejects.toThrow('YooKassa recurring payment failed');
    });
  });

  describe('getPaymentMethods', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return payment methods list', async () => {
      const mockResponse = {
        items: [
          {
            id: 'pm-111',
            type: 'bank_card',
            card: { last4: '1234', expiry_month: 12, expiry_year: 2027 },
          },
          {
            id: 'pm-222',
            type: 'yoo_money',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.getPaymentMethods('customer-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('pm-111');
      expect(result[0].type).toBe('bank_card');
      expect(result[0].last4).toBe('1234');
      expect(result[1].type).toBe('yoo_money');
    });

    it('should return empty array on error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await provider.getPaymentMethods('customer-1');
      expect(result).toEqual([]);
    });
  });

  describe('parseWebhookEvent', () => {
    it('should parse payment.succeeded event', () => {
      const payload = {
        event: 'payment.succeeded',
        object: {
          id: 'tx-123',
          amount: { value: '990.00', currency: 'RUB' },
          metadata: { workspaceId: 'ws-1' },
        },
      };

      const result = provider.parseWebhookEvent(payload);

      expect(result.eventType).toBe('payment.succeeded');
      expect(result.providerTransactionId).toBe('tx-123');
      expect(result.workspaceId).toBe('ws-1');
      expect(result.amount).toBe('990.00');
      expect(result.currency).toBe('RUB');
    });

    it('should parse payment.canceled event', () => {
      const payload = {
        event: 'payment.canceled',
        object: {
          id: 'tx-456',
          amount: { value: '990.00', currency: 'RUB' },
          metadata: { workspaceId: 'ws-2' },
        },
      };

      const result = provider.parseWebhookEvent(payload);

      expect(result.eventType).toBe('payment.canceled');
      expect(result.providerTransactionId).toBe('tx-456');
      expect(result.workspaceId).toBe('ws-2');
    });

    it('should default to canceled for unknown events', () => {
      const payload = {
        event: 'payment.waiting_for_capture',
        object: {
          id: 'tx-789',
          amount: { value: '100.00', currency: 'RUB' },
          metadata: { workspaceId: 'ws-3' },
        },
      };

      const result = provider.parseWebhookEvent(payload);

      expect(result.eventType).toBe('payment.canceled');
    });

    it('should handle missing metadata', () => {
      const payload = {
        event: 'payment.succeeded',
        object: {
          id: 'tx-000',
          amount: { value: '500.00', currency: 'USD' },
        },
      };

      const result = provider.parseWebhookEvent(payload);

      expect(result.workspaceId).toBe('');
      expect(result.amount).toBe('500.00');
      expect(result.currency).toBe('USD');
    });
  });
});
