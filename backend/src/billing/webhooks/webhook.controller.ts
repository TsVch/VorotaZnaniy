import {
  Controller,
  Post,
  Get,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';
import { WebhookService } from '../services/webhook.service';

/**
 * Payment provider webhook endpoint.
 *
 * Uses a distinct path prefix to avoid route conflicts with BillingController.
 * NO auth guards — the provider cannot send JWT tokens.
 * Security relies entirely on cryptographic signature validation.
 */
@Controller('v1/billing/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Receive payment provider webhook',
    description:
      'Validates HMAC-SHA256 signature, processes payment.succeeded/canceled events idempotently. Returns 400 for invalid signatures.',
  })
  async handleWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers('authorization') authHeader?: string,
  ): Promise<{ handled: boolean; message: string }> {
    const signature = authHeader ?? '';

    this.logger.log(
      `Webhook received: event=${(payload.event as string) ?? 'unknown'}, tx=${(payload.object as Record<string, unknown>)?.id ?? 'unknown'}`,
    );

    const result = await this.webhookService.processEvent(payload, signature);

    // Return 400 for invalid signatures per spec (AC-3)
    if (!result.handled && result.message === 'Invalid signature') {
      throw new BadRequestException('Invalid webhook signature');
    }

    return result;
  }

  /**
   * YooKassa may send a GET request to verify the webhook URL.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  verifyWebhook(): { status: string } {
    return { status: 'ok' };
  }
}
