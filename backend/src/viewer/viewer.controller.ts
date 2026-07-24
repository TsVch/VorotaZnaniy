import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceOwnerGuard } from '../auth/guards/workspace-owner.guard';
import {
  ViewerService,
  type CreateSessionResponse,
  type HeartbeatResponse,
  type PageUrlResponse,
} from './viewer.service';
import { CreateSessionDto } from './dto/create-session.dto';

interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role: string;
    [key: string]: unknown;
  };
}

@ApiTags('Viewer')
@Controller('viewer')
export class ViewerController {
  constructor(private readonly viewerService: ViewerService) {}

  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Initialize a secure viewing session',
    description:
      'Validates access rights and concurrent session limits, creates a new ' +
      'viewing session, and returns document metadata with watermark data for ' +
      'the frontend. This is the first step in the secure viewer flow.',
  })
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({
    status: 200,
    description:
      'Session created successfully. Returns session ID, document metadata, and watermark data.',
    schema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', format: 'uuid' },
        document: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            page_count: { type: 'number', nullable: true },
            protection_config: { type: 'object' },
          },
        },
        watermark_data: {
          type: 'object',
          properties: {
            userEmail: { type: 'string' },
            sessionIdShort: { type: 'string' },
            timestamp: { type: 'string' },
          },
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
    description:
      'Access denied (ACCESS_DENIED, CONCURRENT_SESSION_LIMIT, or DOCUMENT_NOT_AVAILABLE)',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  async createSession(
    @Body() dto: CreateSessionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CreateSessionResponse> {
    const user = req.user!;

    return this.viewerService.createSession(
      user.sub,
      user.email,
      dto.documentId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  @Post('sessions/:sessionId/heartbeat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Send session heartbeat',
    description:
      'Keeps the viewing session alive. Must be called every 60 seconds. ' +
      'Updates lastActivity timestamp. If the session was terminated (e.g., ' +
      'concurrent session limit exceeded on another device), returns ' +
      '{ valid: false } and the frontend should show the termination modal.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session UUID returned from session creation',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Heartbeat processed. Check valid flag for session status.',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        nextHeartbeatIn: { type: 'number', description: 'Seconds until next heartbeat (only if valid=true)' },
        reason: { type: 'string', description: 'Termination reason (only if valid=false)' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT token',
  })
  async heartbeat(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<HeartbeatResponse> {
    const user = req.user!;
    return this.viewerService.heartbeat(sessionId, user.sub);
  }

  @Get('sessions/:sessionId/pages/:pageNumber')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get presigned URL for a document page',
    description:
      'Returns a short-lived (60s) presigned GET URL for a specific page image. ' +
      'The session must be active and valid. Page numbers are 1-indexed. ' +
      'The URL expires in 60 seconds and must be fetched immediately by the frontend.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session UUID returned from session creation',
    required: true,
  })
  @ApiParam({
    name: 'pageNumber',
    description: 'Page number (1-indexed)',
    required: true,
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned GET URL for the requested page.',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Presigned GET URL (expires in 60s)' },
        expires_in: { type: 'number', example: 60 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Session invalid, inactive, or expired',
  })
  async getPageUrl(
    @Param('sessionId') sessionId: string,
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<PageUrlResponse> {
    const user = req.user!;

    if (pageNumber < 1) {
      throw new BadRequestException({
        statusCode: 400,
        error: {
          code: 'INVALID_PAGE_NUMBER',
          message: 'Page number must be 1 or greater.',
        },
      });
    }

    return this.viewerService.getPageUrl(
      sessionId,
      user.sub,
      pageNumber,
    );
  }
}
