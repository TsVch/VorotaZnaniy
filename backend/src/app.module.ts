import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JobsBridgeModule } from './jobs-bridge/jobs-bridge.module';
import { AccessModule } from './access/access.module';
import { ViewerModule } from './viewer/viewer.module';
import { DocumentsModule } from './documents/documents.module';
import { BillingModule } from './billing/billing.module';
import { SharedModule } from './shared/shared.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Core infrastructure
    PrismaModule,
    SharedModule,
    // Feature modules
    HealthModule,
    AuthModule,
    JobsBridgeModule,
    AccessModule,
    ViewerModule,
    DocumentsModule,
    BillingModule,
    UsersModule,
  ],
})
export class AppModule {}
