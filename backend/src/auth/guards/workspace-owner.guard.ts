import {
  BadRequestException,
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkspaceOwnerGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceOwnerGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { sub: string; workspaceId?: string; [key: string]: unknown };
      [key: string]: unknown;
    }>();

    const user = request.user;

    if (!user?.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract workspace ID from header (X-Workspace-Id) or JWT payload
    const workspaceId =
      request.headers['x-workspace-id'] ?? user.workspaceId;

    if (!workspaceId) {
      throw new BadRequestException('Workspace ID is required');
    }

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, ownerId: true },
      });

      if (!workspace) {
        throw new ForbiddenException('Workspace not found');
      }

      if (workspace.ownerId !== user.sub) {
        this.logger.warn(
          `User ${user.sub} attempted to access workspace ${workspaceId} without ownership`,
        );
        throw new ForbiddenException('You do not own this workspace');
      }

      // Attach workspace ID to request for downstream use
      request.workspaceId = workspaceId;

      return true;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(
        `Error verifying workspace ownership: ${(error as Error).message}`,
      );
      throw new ForbiddenException('Could not verify workspace ownership');
    }
  }
}
