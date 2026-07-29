import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceOwnerGuard } from '../auth/guards/workspace-owner.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { UploadInitDto } from './dto/upload-init.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { DocumentAnalyticsDto } from './dto/document-analytics.dto';
import { QaRequestDto } from './dto/qa-request.dto';
import type { QaResponseDto } from './dto/qa-response.dto';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload-init')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.CREATOR)
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Initialize document upload',
    description:
      'Validates file metadata and returns a presigned S3 PUT URL for direct upload. ' +
      'The client must upload the file to the returned URL within the expiry window. ' +
      'After successful upload, call POST /v1/documents/:id/upload-complete.',
  })
  @ApiHeader({
    name: 'X-Workspace-Id',
    description: 'Workspace UUID (required for creator-scoped requests)',
    required: true,
  })
  @ApiBody({ type: UploadInitDto })
  @ApiResponse({
    status: 200,
    description: 'Upload initialized successfully',
    schema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', format: 'uuid' },
        upload_url: { type: 'string', description: 'Presigned S3 PUT URL' },
        expires_in: { type: 'number', description: 'URL expiry in seconds' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (invalid file type, size exceeded, etc.)',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Workspace ownership verification failed',
  })
  async uploadInit(
    @Body() dto: UploadInitDto,
    @Headers('x-workspace-id') workspaceId?: string,
  ): Promise<{
    document_id: string;
    upload_url: string;
    expires_in: number;
  }> {
    return this.documentsService.initUpload(workspaceId ?? '', dto);
  }

  @Post(':id/upload-complete')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.CREATOR)
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Complete document upload',
    description:
      'Confirms that the file has been uploaded to S3. Verifies file existence via ' +
      'HeadObject and dispatches AI processing (parsing, embedding) to the AI Worker.',
  })
  @ApiParam({
    name: 'id',
    description: 'Document UUID returned from upload-init',
    required: true,
  })
  @ApiHeader({
    name: 'X-Workspace-Id',
    description: 'Workspace UUID (required for creator-scoped requests)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Upload completed and AI processing dispatched',
    schema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'PROCESSING' },
        message: {
          type: 'string',
          example: 'Document queued for parsing and AI embedding.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'File not found in storage or validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Workspace ownership verification failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  async completeUpload(
    @Param('id') id: string,
    @Headers('x-workspace-id') workspaceId?: string,
  ): Promise<{
    document_id: string;
    status: string;
    message: string;
  }> {
    return this.documentsService.completeUpload(id, workspaceId ?? '');
  }

  @Post(':id/summary')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Generate AI summary for document',
    description:
      'Triggers AI-powered summary generation using the first 5 chunks of the document. ' +
      'Returns the generated summary or null if summarisation is unavailable.',
  })
  @ApiParam({
    name: 'id',
    description: 'Document UUID',
    required: true,
  })
  @ApiHeader({
    name: 'X-Workspace-Id',
    description: 'Workspace UUID (required for creator-scoped requests)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Summary generated successfully',
    schema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', format: 'uuid' },
        summary: {
          type: 'string',
          nullable: true,
          description: 'Generated AI summary, or null if unavailable',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Workspace ownership verification failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  async generateSummary(
    @Param('id') id: string,
  ): Promise<{ document_id: string; summary: string | null }> {
    const summary =
      await this.documentsService.generateAndSaveSummary(id);
    return { document_id: id, summary };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List user documents',
    description:
      'Returns a paginated list of documents for the authenticated user ' +
      'with optional status filter and title search.',
  })
  @ApiResponse({
    status: 200,
    description: 'Documents retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['PROCESSING', 'READY', 'ERROR'] },
              fileSize: { type: 'integer' },
              pageCount: { type: 'integer', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'integer', description: 'Total number of documents matching the query' },
        page: { type: 'integer', description: 'Current page number' },
        limit: { type: 'integer', description: 'Number of items per page' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async findAll(
    @Query() query: QueryDocumentsDto,
    @Req() req: { user?: { sub: string; workspaceId?: string } },
  ) {
    const userId = req.user?.sub ?? '';
    return this.documentsService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get document details',
    description: 'Fetch a single document by ID with all metadata and DRM config.',
  })
  @ApiParam({
    name: 'id',
    description: 'Document UUID',
    required: true,
  })
  @ApiHeader({
    name: 'X-Workspace-Id',
    description: 'Workspace UUID (required for creator-scoped requests)',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Document details' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Workspace ownership verification failed' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocument(
    @Param('id') id: string,
  ): Promise<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    fileSize: number;
    pageCount: number | null;
    fileType: string;
    fileName: string;
    protectionConfig: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    return this.documentsService.getDocument(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.CREATOR)
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update document metadata and DRM settings',
    description:
      'Partially updates document fields (title, description, protection_config). ' +
      'Only provided fields are changed. Critical fields like status and s3Key cannot be modified.',
  })
  @ApiParam({
    name: 'id',
    description: 'Document UUID',
    required: true,
  })
  @ApiHeader({
    name: 'X-Workspace-Id',
    description: 'Workspace UUID (required for creator-scoped requests)',
    required: true,
  })
  @ApiBody({ type: UpdateDocumentDto })
  @ApiResponse({ status: 200, description: 'Document updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Workspace ownership verification failed' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async updateDocument(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    fileSize: number;
    protectionConfig: Record<string, unknown>;
    updatedAt: Date;
  }> {
    return this.documentsService.updateDocument(id, dto);
  }

  @Get(':id/analytics')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get document analytics',
    description:
      'Returns aggregated analytics for a document: total views, unique viewers, AI queries, and recent sessions.',
  })
  @ApiParam({ name: 'id', description: 'Document UUID', required: true })
  @ApiHeader({
    name: 'X-Workspace-Id',
    description: 'Workspace UUID (required for creator-scoped requests)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics data',
    type: DocumentAnalyticsDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Workspace ownership verification failed' })
  async getDocumentAnalytics(
    @Param('id') id: string,
  ): Promise<DocumentAnalyticsDto> {
    return this.documentsService.getDocumentAnalytics(id);
  }

  @Post(':id/qa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Ask a question about a document (RAG)',
    description:
      'Answers a question using the full RAG pipeline: embeds the question, ' +
      'performs semantic search over document chunks, and generates an answer ' +
      'with source citations via gpt-4o-mini.',
  })
  @ApiParam({
    name: 'id',
    description: 'Document UUID',
    required: true,
  })
  @ApiBody({ type: QaRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Answer generated successfully',
    schema: {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              chunkIndex: { type: 'number' },
              text: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid question or AI unavailable' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Access denied to this document' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async askQuestion(
    @Param('id') id: string,
    @Body() dto: QaRequestDto,
    @Req() req: { user?: { sub: string } },
  ): Promise<QaResponseDto> {
    const userId = req.user?.sub ?? '';
    return this.documentsService.askQuestion(
      id,
      userId,
      dto.question,
    );
  }
}
