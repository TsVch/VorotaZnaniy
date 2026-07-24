import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from '../services/webhook.service';
import { BillingService } from '../services/billing.service';

describe('WebhookService', () => {
  let service: WebhookService;
  const mockBillingService = {
    processWebhookEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: BillingService,
          useValue: mockBillingService,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should delegate to BillingService and return result', async () => {
    mockBillingService.processWebhookEvent.mockResolvedValue({
      handled: true,
      message: 'Webhook processed successfully',
    });

    const payload = { event: 'payment.succeeded' };
    const signature = 'valid-sig';

    const result = await service.processEvent(payload, signature);

    expect(result.handled).toBe(true);
    expect(mockBillingService.processWebhookEvent).toHaveBeenCalledWith(
      payload,
      signature,
    );
  });

  it('should return error when BillingService throws', async () => {
    mockBillingService.processWebhookEvent.mockRejectedValue(
      new Error('DB connection failed'),
    );

    const result = await service.processEvent(
      { event: 'payment.succeeded' },
      'sig',
    );

    expect(result.handled).toBe(false);
    expect(result.message).toBe('Internal processing error');
  });
});
