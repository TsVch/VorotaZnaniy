import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingService } from './services/billing.service';
import { WebhookService } from './services/webhook.service';
import { WebhookController } from './webhooks/webhook.controller';
import { YooKassaPaymentProvider } from './providers/yookassa.provider';
import { MockPaymentProvider } from './providers/mock.provider';
import { PAYMENT_PROVIDER_TOKEN } from './interfaces/payment-provider.interface';

/**
 * Billing module with Strategy Pattern (ADR-005).
 *
 * The active payment provider is bound via DI token PAYMENT_PROVIDER.
 * Switch between providers by setting `PAYMENT_PROVIDER_ACTIVE` env var:
 *   - "yookassa" (default, production-ready)
 *   - "mock"       (for internal testing without a real payment account)
 *
 * 🔐 Mock provider is BLOCKED in NODE_ENV=production.
 */
@Module({
  imports: [ConfigModule],
  controllers: [BillingController, WebhookController],
  providers: [
    BillingService,
    WebhookService,
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>(
          'PAYMENT_PROVIDER_ACTIVE',
          'yookassa',
        );

        // Safety: never allow mock in production
        if (
          provider === 'mock' &&
          configService.get<string>('NODE_ENV') === 'production'
        ) {
          throw new Error(
            'MockPaymentProvider cannot be used in production. ' +
              'Set PAYMENT_PROVIDER_ACTIVE=yookassa or remove the variable.',
          );
        }

        return provider === 'mock'
          ? new MockPaymentProvider()
          : new YooKassaPaymentProvider(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
