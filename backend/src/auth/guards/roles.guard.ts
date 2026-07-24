import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from './jwt-auth.guard';

/**
 * RolesGuard — enforces role-based access control.
 *
 * Must be placed AFTER JwtAuthGuard in the @UseGuards() array so that
 * request.user is populated before this guard runs.
 *
 * Behaviour:
 * - If no @Roles() decorator is present → access is **allowed** (permissive fallback).
 * - If @Roles() is present → request.user.role must be in the allowed set.
 *
 * @throws ForbiddenException if the user's role is not in the allowed roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ── Read required roles from metadata ───────────────────────────────
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access (permissive for existing routes)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // ── Extract user from request ───────────────────────────────────────
    const request = context.switchToHttp().getRequest<{
      user?: JwtPayload;
    }>();
    const user = request.user;

    if (!user) {
      this.logger.warn('RolesGuard: no user found on request');
      throw new ForbiddenException('Authentication required');
    }

    // ── Check role ─────────────────────────────────────────────────────
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      this.logger.warn(
        `RolesGuard: user ${user.sub} with role "${user.role}" ` +
          `tried to access a resource requiring [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Access denied. Required role: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
