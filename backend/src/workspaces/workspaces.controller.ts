import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Req,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceOwnerGuard } from '../auth/guards/workspace-owner.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import type { WorkspaceDetailsDto } from './dto/workspace-details.dto';

@ApiTags('Workspaces')
@Controller('v1/workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  /**
   * Get the current user's default workspace.
   *
   * This is the primary entry point for the frontend settings page,
   * avoiding the chicken-and-egg problem of needing a workspace ID
   * before being able to call workspace endpoints.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user workspace',
    description:
      'Returns the current user\'s default workspace details. ' +
      'No workspace ID needed — it is resolved from the JWT token.',
  })
  async getMyWorkspace(
    @Req() req: { user: { sub: string } },
  ): Promise<WorkspaceDetailsDto> {
    return this.workspacesService.findUserWorkspace(req.user.sub);
  }

  /**
   * Get workspace details with owner info and document count.
   *
   * AC-1: Returns workspace name, owner email, and document count.
   */
  /**
   * Get workspace details with owner info and document count.
   *
   * The WorkspaceOwnerGuard validates the X-Workspace-Id header against the
   * JWT payload. We ensure the header value matches the route param to
   * prevent any mismatch between guard validation and controller execution.
   *
   * AC-1: Returns workspace name, owner email, and document count.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get workspace details',
    description:
      'Returns workspace metadata including name, owner email, and document count.',
  })
  async getWorkspaceDetails(
    @Param('id') id: string,
    @Headers('x-workspace-id') workspaceId: string,
  ): Promise<WorkspaceDetailsDto> {
    if (!workspaceId) {
      throw new BadRequestException('X-Workspace-Id header is required');
    }
    if (workspaceId !== id) {
      throw new BadRequestException('X-Workspace-Id header does not match the workspace ID in the URL');
    }
    return this.workspacesService.getWorkspaceDetails(workspaceId);
  }

  /**
   * Update workspace properties (currently only name).
   *
   * AC-2: Updates workspace name.
   * AC-3: Validates name length (3–50 characters).
   * AC-4: Protected by WorkspaceOwnerGuard (403 for non-owners).
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, WorkspaceOwnerGuard)
  @ApiBearerAuth('access-token')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Update workspace',
    description: 'Update workspace properties (currently only name).',
  })
  async updateWorkspace(
    @Param('id') id: string,
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDetailsDto> {
    if (!workspaceId) {
      throw new BadRequestException('X-Workspace-Id header is required');
    }
    if (workspaceId !== id) {
      throw new BadRequestException('X-Workspace-Id header does not match the workspace ID in the URL');
    }
    return this.workspacesService.updateWorkspace(workspaceId, dto);
  }
}
