import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Metadata key for the Roles decorator.
 */
export const ROLES_KEY = 'roles';

/**
 * Role-based access control decorator.
 *
 * Specifies which roles are allowed to access a route handler.
 * Must be used together with `@UseGuards(JwtAuthGuard, RolesGuard)`.
 *
 * Uses the Prisma-generated `Role` enum for type safety.
 *
 * @example
 * ```typescript
 * @Roles(Role.CREATOR)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async uploadInit() { ... }
 * ```
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
