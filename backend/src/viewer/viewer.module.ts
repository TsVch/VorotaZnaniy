import { Module } from '@nestjs/common';
import { ViewerController } from './viewer.controller';
import { ViewerService } from './viewer.service';
import { S3Service } from '../shared/utils/s3.service';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';

/**
 * ViewerModule handles secure document viewing sessions,
 * page URL generation, and session lifecycle management.
 *
 * @module ViewerModule
 */
@Module({
  imports: [AuthModule, AccessModule],
  controllers: [ViewerController],
  providers: [ViewerService, S3Service],
  exports: [ViewerService],
})
export class ViewerModule {}
