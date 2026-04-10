import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { MESSAGES } from '@/common/constants';
import { Role } from '@/common/enums';
import { IS_PUBLIC_KEY } from '@/modules/auth/decorators/public.decorator';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import type { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { SKIP_MFA_KEY } from '../constants';
import { MfaService } from '../mfa.service';
import { MfaGuard } from './mfa.guard';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  userId: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
  ...overrides,
});

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    mfaVerifiedAt: null,
    ...overrides,
  }) as User;

const makeRequest = (authUser?: AuthenticatedUser): Record<string, unknown> => ({
  user: authUser,
});

const makeContext = (
  request: Record<string, unknown>,
  metadata: { isPublic?: boolean; skipMfa?: boolean } = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    // reflector reads metadata via getAllAndOverride — handled by mockReflector
    _meta: metadata,
  }) as unknown as ExecutionContext;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockReflector = {
  getAllAndOverride: jest.fn(),
} satisfies Partial<jest.Mocked<Reflector>>;

const mockUsersService = {
  findOne: jest.fn(),
} satisfies Partial<jest.Mocked<UsersService>>;

const mockMfaService = {
  isMfaSessionValid: jest.fn(),
} satisfies Partial<jest.Mocked<MfaService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('MfaGuard', () => {
  let guard: MfaGuard;

  const setupReflector = (isPublic = false, skipMfa = false) => {
    mockReflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === SKIP_MFA_KEY) return skipMfa;
      return false;
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupReflector();

    guard = new MfaGuard(
      mockReflector as unknown as Reflector,
      mockUsersService as unknown as UsersService,
      mockMfaService as unknown as MfaService,
    );
  });

  // ── @Public() routes ──────────────────────────────────────────────────────

  describe('@Public() routes', () => {
    it('should return true without checking MFA for public routes', async () => {
      setupReflector(true, false);
      const ctx = makeContext(makeRequest());

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockUsersService.findOne).not.toHaveBeenCalled();
      expect(mockMfaService.isMfaSessionValid).not.toHaveBeenCalled();
    });

    it('should check IS_PUBLIC_KEY before SKIP_MFA_KEY', async () => {
      setupReflector(true, false);
      const ctx = makeContext(makeRequest());

      await guard.canActivate(ctx);

      const firstCall = mockReflector.getAllAndOverride.mock.calls[0][0];
      expect(firstCall).toBe(IS_PUBLIC_KEY);
    });
  });

  // ── @SkipMfa() routes ─────────────────────────────────────────────────────

  describe('@SkipMfa() routes', () => {
    it('should return true without checking MFA for skipMfa routes', async () => {
      setupReflector(false, true);
      const ctx = makeContext(makeRequest());

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockUsersService.findOne).not.toHaveBeenCalled();
      expect(mockMfaService.isMfaSessionValid).not.toHaveBeenCalled();
    });

    it('should check SKIP_MFA_KEY when route is not public', async () => {
      setupReflector(false, true);
      const ctx = makeContext(makeRequest());

      await guard.canActivate(ctx);

      const keys = mockReflector.getAllAndOverride.mock.calls.map(
        (c: Parameters<typeof mockReflector.getAllAndOverride>) => c[0],
      );
      expect(keys).toContain(SKIP_MFA_KEY);
    });
  });

  // ── no auth context ───────────────────────────────────────────────────────

  describe('protected route without auth context', () => {
    it('should throw UnauthorizedException when request has no user', async () => {
      const ctx = makeContext(makeRequest(undefined));

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(MESSAGES.INVALID_TOKEN);
    });

    it('should not call usersService when no auth user', async () => {
      const ctx = makeContext(makeRequest(undefined));

      await expect(guard.canActivate(ctx)).rejects.toThrow();

      expect(mockUsersService.findOne).not.toHaveBeenCalled();
    });
  });

  // ── MFA session validation ────────────────────────────────────────────────

  describe('MFA session validation', () => {
    it('should return true when MFA session is valid', async () => {
      const authUser = makeAuthUser();
      const user = makeUser({ id: authUser.userId });
      const ctx = makeContext(makeRequest(authUser));

      mockUsersService.findOne.mockResolvedValue(user);
      mockMfaService.isMfaSessionValid.mockReturnValue(true);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should call usersService.findOne with authUser.userId', async () => {
      const authUser = makeAuthUser();
      const user = makeUser({ id: authUser.userId });
      const ctx = makeContext(makeRequest(authUser));

      mockUsersService.findOne.mockResolvedValue(user);
      mockMfaService.isMfaSessionValid.mockReturnValue(true);

      await guard.canActivate(ctx);

      expect(mockUsersService.findOne).toHaveBeenCalledWith({ id: authUser.userId });
    });

    it('should pass the loaded user to isMfaSessionValid', async () => {
      const authUser = makeAuthUser();
      const user = makeUser({ id: authUser.userId });
      const ctx = makeContext(makeRequest(authUser));

      mockUsersService.findOne.mockResolvedValue(user);
      mockMfaService.isMfaSessionValid.mockReturnValue(true);

      await guard.canActivate(ctx);

      expect(mockMfaService.isMfaSessionValid).toHaveBeenCalledWith(user);
    });

    it('should throw UnauthorizedException when MFA session is not valid', async () => {
      const authUser = makeAuthUser();
      const user = makeUser({ id: authUser.userId });
      const ctx = makeContext(makeRequest(authUser));

      mockUsersService.findOne.mockResolvedValue(user);
      mockMfaService.isMfaSessionValid.mockReturnValue(false);

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(MESSAGES.MFA_REQUIRED);
    });

    it('should throw UnauthorizedException when mfaVerifiedAt is null', async () => {
      const authUser = makeAuthUser();
      const user = makeUser({ mfaVerifiedAt: null });
      const ctx = makeContext(makeRequest(authUser));

      mockUsersService.findOne.mockResolvedValue(user);
      mockMfaService.isMfaSessionValid.mockReturnValue(false);

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });
});
