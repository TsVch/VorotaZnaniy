import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { InternalApiKeyGuard } from '../auth/guards/internal-api-key.guard';
import { JobsBridgeService } from './jobs-bridge.service';
import { SemanticSearchDto, type SearchResultItem } from './dto/semantic-search.dto';

/**
 * InternalSearchController — Semantic search endpoint for the RAG pipeline.
 *
 * These endpoints are ONLY accessible from within the private network/VPC.
 * They are excluded from public Swagger documentation.
 *
 * Endpoints:
 *   POST /internal/search/semantic — returns top-K most relevant chunks for a query embedding
 */
@Controller('internal/search')
export class SemanticSearchController {
  constructor(
    private readonly jobsBridgeService: JobsBridgeService,
  ) {}

  @Post('semantic')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalApiKeyGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @ApiExcludeEndpoint()
  async semanticSearch(
    @Body() dto: SemanticSearchDto,
  ): Promise<{ results: SearchResultItem[] }> {
    const results = await this.jobsBridgeService.semanticSearch(
      dto.documentId,
      dto.queryEmbedding,
      dto.topK,
    );
    return { results };
  }
}
