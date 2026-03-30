import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { MESSAGES } from '@/common/constants';
import { Role } from '@/common/enums';

import type { AuthenticatedUser } from '../interfaces';
import { ROLES_KEY, RolesGuard } from './roles.guard';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthenticatedUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  userId: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
  ...overrides,
});

const makeContext = (user?: AuthenticatedUser): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockReflector = {
  getAllAndOverride: jest.fn(),
} satisfies Partial<jest.Mocked<Reflector>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(mockReflector as unknown as Reflector);
  });

  // ── canActivate ────────────────────────────────────────────────────────────

  describe('canActivate', () => {
    it('should return true when no @Roles() decorator is present', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const ctx = makeContext(makeAuthenticatedUser());

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should return true when @Roles() is present with empty array', () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);
      const ctx = makeContext(makeAuthenticatedUser());

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should return true when user role matches required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.Admin]);
      const ctx = makeContext(makeAuthenticatedUser({ role: Role.Admin }));

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should return true when user role is one of multiple required roles', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.Admin, Role.User]);
      const ctx = makeContext(makeAuthenticatedUser({ role: Role.User }));

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user role does not match required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.Admin]);
      const ctx = makeContext(makeAuthenticatedUser({ role: Role.User }));

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(ctx)).toThrow(MESSAGES.FORBIDDEN);
    });

    it('should throw ForbiddenException when user is not present on request', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.Admin]);
      const ctx = makeContext(undefined);

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should read roles from both handler and class via reflector', () => {
      mockReflector.getAllAndOverride.mockReturnValue([Role.Admin]);
      const ctx = makeContext(makeAuthenticatedUser({ role: Role.Admin }));

      guard.canActivate(ctx);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
    });
  });
});
