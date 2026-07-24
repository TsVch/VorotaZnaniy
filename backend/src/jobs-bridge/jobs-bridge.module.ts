import { Module } from '@nestjs/common';
import { JobsBridgeController } from './jobs-bridge.controller';
import { SemanticSearchController } from './semantic-search.controller';
import { JobsBridgeService } from './jobs-bridge.service';
import { InternalApiKeyGuard } from '../auth/guards/internal-api-key.guard';

@Module({
  controllers: [JobsBridgeController, SemanticSearchController],
  providers: [JobsBridgeService, InternalApiKeyGuard],
  exports: [JobsBridgeService],
})
export class JobsBridgeModule {}
