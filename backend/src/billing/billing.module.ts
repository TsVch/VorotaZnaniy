import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingService } from './services/billing.service';
import { WebhookService } from './services/webhook.service';
import { WebhookController } from './webhooks/webhook.controller';
import { YooKassaPaymentProvider } from './providers/yookassa.provider';
import { PAYMENT_PROVIDER_TOKEN } from './interfaces/payment-provider.interface';

/**
 * Billing module with Strategy Pattern (ADR-005).
 *
 * The active payment provider is bound via DI token PAYMENT_PROVIDER.
 * To switch providers (e.g., to T-Bank in Phase 2):
 *   1. Implement TBankPaymentProvider
 *   2. Change `useClass` below
 *   3. No other code changes needed
 */
@Module({
  imports: [ConfigModule],
  controllers: [BillingController, WebhookController],
  providers: [
    BillingService,
    WebhookService,
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      useClass: YooKassaPaymentProvider,
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
