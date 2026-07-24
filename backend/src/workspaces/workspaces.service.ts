import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { WorkspaceDetailsDto } from './dto/workspace-details.dto';
import type { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a default workspace for a newly registered user.
   *
   * AC-1: Automatically creates a workspace named after the user's email
   * and sets it as the user's default workspace.
   *
   * @returns The created workspace ID
   */
  async createDefaultWorkspace(userId: string, email: string): Promise<string> {
    const slug = this.slugify(email, userId);

    const workspace = await this.prisma.workspace.create({
      data: {
        ownerId: userId,
        name: `${email.split('@')[0]}'s Workspace`,
        slug,
      },
      select: { id: true },
    });

    // Set this workspace as the user's default
    await this.prisma.user.update({
      where: { id: userId },
      data: { defaultWorkspaceId: workspace.id },
    });

    this.logger.log(
      `Default workspace created: id=${workspace.id}, userId=${userId}`,
    );

    return workspace.id;
  }

  /**
   * Check if a user owns a specific workspace.
   */
  async isOwner(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    return workspace?.ownerId === userId;
  }

  /**
   * Find the current user's default workspace.
   * Used internally by the `/me` endpoint.
   */
  async findUserWorkspace(userId: string): Promise<WorkspaceDetailsDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultWorkspaceId: true },
    });

    if (!user?.defaultWorkspaceId) {
      throw new NotFoundException('User has no workspace');
    }

    return this.getWorkspaceDetails(user.defaultWorkspaceId);
  }

  /**
   * Get workspace details with owner info and document count.
   *
   * AC-1: Returns workspace name, owner email, and document count.
   */
  async getWorkspaceDetails(workspaceId: string): Promise<WorkspaceDetailsDto> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: { email: true, name: true },
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      owner: workspace.owner,
      documentCount: workspace._count.documents,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  /**
   * Update workspace properties (currently only name).
   *
   * AC-2: Updates workspace name and returns updated details.
   */
  async updateWorkspace(
    workspaceId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDetailsDto> {
    try {
      const workspace = await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { name: dto.name },
        include: {
          owner: {
            select: { email: true, name: true },
          },
          _count: {
            select: { documents: true },
          },
        },
      });

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        owner: workspace.owner,
        documentCount: workspace._count.documents,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Record<string, unknown>).code === 'P2025'
      ) {
        throw new NotFoundException('Workspace not found');
      }
      if (error instanceof Error) {
        this.logger.error(`Error updating workspace: ${error.message}`);
      }
      throw new BadRequestException('Could not update workspace');
    }
  }

  private slugify(email: string, userId: string): string {
    const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const shortId = userId.slice(0, 8);
    return `${prefix}-${shortId}`;
  }
}
