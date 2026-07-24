import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../guards/roles.guard';
function createMockContext(user?: {
  role?: string;
  sub?: string;
} | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: user ?? null,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  // ── AC-1: Access allowed ──────────────────────────────────────────────

  it('AC-1: should allow access when user role matches required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['CREATOR']);

    const context = createMockContext({ role: 'CREATOR', sub: 'user-1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has one of multiple allowed roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['ADMIN', 'CREATOR']);

    const context = createMockContext({ role: 'CREATOR', sub: 'user-1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  // ── AC-2: Access denied ───────────────────────────────────────────────

  it('AC-2: should deny access when user role does not match', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['CREATOR']);

    const context = createMockContext({ role: 'VIEWER', sub: 'user-2' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Access denied. Required role: CREATOR',
    );
  });

  it('should deny access with correct error message for multiple roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['ADMIN', 'CREATOR']);

    const context = createMockContext({ role: 'VIEWER', sub: 'user-2' });

    expect(() => guard.canActivate(context)).toThrow(
      'Access denied. Required role: ADMIN or CREATOR',
    );
  });

  // ── AC-3: No user ─────────────────────────────────────────────────────

  it('AC-3: should deny access when user is not on request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['CREATOR']);

    const context = createMockContext(null);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(
      'Authentication required',
    );
  });

  it('should deny access when user object has no role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['CREATOR']);

    const context = createMockContext({ sub: 'user-3' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  // ── No metadata (permissive fallback) ─────────────────────────────────

  it('should allow access when no @Roles() decorator is present', () => {
    // Reflector returns undefined when no metadata is set
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext({ role: 'VIEWER' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when @Roles() has empty array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

    const context = createMockContext({ role: 'VIEWER' });

    expect(guard.canActivate(context)).toBe(true);
  });
});
