import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { S3Service } from '../shared/utils/s3.service';
import { JobsBridgeModule } from '../jobs-bridge/jobs-bridge.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, JobsBridgeModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, S3Service],
  exports: [DocumentsService],
})
export class DocumentsModule {}
