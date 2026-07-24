import { Module } from '@nestjs/common';
import { WatermarkService } from './services/watermark.service';
import { AccessService } from './services/access.service';

/**
 * AccessModule manages document access, DRM enforcement,
 * session validation, session termination, and watermark generation.
 *
 * @module AccessModule
 */
@Module({
  providers: [WatermarkService, AccessService],
  exports: [WatermarkService, AccessService],
})
export class AccessModule {}
