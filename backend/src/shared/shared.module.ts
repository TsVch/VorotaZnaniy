import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  EMAIL_SERVICE_TOKEN,
  ResendEmailService,
} from './utils/email.service';

/**
 * SharedModule provides cross-cutting infrastructure services
 * that are consumed by multiple feature modules.
 *
 * Registered as @Global so that EMAIL_SERVICE_TOKEN is available
 * to all modules without explicit imports.
 *
 * Currently provides:
 * - EmailService (ResendEmailService — falls back to console logging
 *   when RESEND_API_KEY is not configured)
 *
 * @module SharedModule
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EMAIL_SERVICE_TOKEN,
      useClass: ResendEmailService,
    },
  ],
  exports: [EMAIL_SERVICE_TOKEN],
})
export class SharedModule {}
