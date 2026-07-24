import { Injectable, Logger } from '@nestjs/common';
import { BillingService } from './billing.service';

/**
 * Webhook processing service with audit logging.
 *
 * Thin wrapper around BillingService.processWebhookEvent that adds
 * request-level audit logging for compliance and debugging.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly billingService: BillingService) {}

  /**
   * Process a webhook event with full audit logging.
   *
   * @param payload - Parsed JSON body of the webhook request
   * @param signature - Raw signature header value for validation
   * @returns Processing result with audit trail
   */
  async processEvent(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<{ handled: boolean; message: string }> {
    const startTime = Date.now();

    this.logger.log(
      `Webhook received: event=${(payload.event as string) ?? 'unknown'}, signature=${signature.slice(0, 8)}...`,
    );

    try {
      const result = await this.billingService.processWebhookEvent(
        payload,
        signature,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Webhook processed: handled=${result.handled}, message="${result.message}", duration=${duration}ms`,
      );

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Webhook failed: ${(error as Error).message}, duration=${duration}ms`,
      );
      return { handled: false, message: 'Internal processing error' };
    }
  }
}
