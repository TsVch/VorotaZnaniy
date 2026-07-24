import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { InternalApiKeyGuard } from '../auth/guards/internal-api-key.guard';
import { JobsBridgeService } from './jobs-bridge.service';
import { SaveEmbeddingsDto } from './dto/save-embeddings.dto';

/**
 * JobsBridgeController — Internal HTTP API for the ADR-004 HTTP Bridge.
 *
 * These endpoints are ONLY accessible from within the private network/VPC.
 * They are excluded from public Swagger documentation.
 *
 * Endpoints:
 *   GET /internal/jobs/pending — AI Worker polls this to fetch pending jobs
 *   POST /internal/jobs/:id/result — AI Worker submits results (TBD)
 *   POST /internal/jobs/:id/failure — AI Worker reports failures (TBD)
 */
@Controller('internal/jobs')
export class JobsBridgeController {
  constructor(
    private readonly jobsBridgeService: JobsBridgeService,
  ) {}

  @Get('pending')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalApiKeyGuard)
  @ApiExcludeEndpoint()
  async getPendingJobs(
    @Query('limit') limit?: string,
  ): Promise<{
    jobs: {
      id: string;
      type: string;
      payload: Record<string, unknown>;
      created_at: string;
    }[];
  }> {
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 10, 50) : 10;
    const jobs = await this.jobsBridgeService.getPendingAiJobs(
      limitNum,
    );

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        type: job.jobType,
        payload: job.payload,
        created_at: job.createdAt.toISOString(),
      })),
    };
  }

  @Post(':id/result')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalApiKeyGuard)
  @ApiExcludeEndpoint()
  async submitResult(
    @Param('id') id: string,
    @Body()
    body: {
      page_count: number;
      extracted_text: string;
      status: string;
    },
  ): Promise<{ success: boolean }> {
    await this.jobsBridgeService.markJobCompleted(id, body);
    return { success: true };
  }

  @Post(':id/failure')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalApiKeyGuard)
  @ApiExcludeEndpoint()
  async submitFailure(
    @Param('id') id: string,
    @Body() body: { error: string },
  ): Promise<{ success: boolean }> {
    await this.jobsBridgeService.markJobFailed(id, body.error);
    return { success: true };
  }

  @Post(':id/embeddings')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalApiKeyGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiExcludeEndpoint()
  async saveEmbeddings(
    @Param('id') id: string,
    @Body() dto: SaveEmbeddingsDto,
  ): Promise<{ success: boolean; count: number }> {
    const count = await this.jobsBridgeService.saveEmbeddings(
      id,
      dto.documentId,
      dto.embeddings,
    );
    return { success: true, count };
  }
}
