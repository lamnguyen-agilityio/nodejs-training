import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { MESSAGES } from '@/common/constants';
import { Role, SocialProvider } from '@/common/enums';

import type { AuthProviderAdapter } from '../adapters/auth-provider.adapter';
import { AuthProviderFactory } from '../auth-provider.factory';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser, AuthProviderProfile } from '../interfaces';
import { AuthGuard } from './auth.guard';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeProfile = (overrides: Partial<AuthProviderProfile> = {}): AuthProviderProfile => ({
  providerId: faker.string.alphanumeric(20),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  socialProvider: SocialProvider.Google,
  socialProviderSub: faker.string.numeric(20),
  ...overrides,
});

const makeAuthenticatedUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  userId: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
  ...overrides,
});

const makeRequest = (authHeader?: string): Record<string, unknown> => ({
  headers: { authorization: authHeader },
  user: undefined,
});

const makeContext = (
  request: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({ metadata }),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockAdapter = {
  verifyToken: jest.fn(),
} satisfies Partial<jest.Mocked<AuthProviderAdapter>>;

const mockAuthProviderFactory = {
  getActiveAdapter: jest.fn(),
} satisfies Partial<jest.Mocked<AuthProviderFactory>>;

const mockAuthService = {
  resolveUserFromProfile: jest.fn(),
} satisfies Partial<jest.Mocked<AuthService>>;

const mockReflector = {
  getAllAndOverride: jest.fn(),
} satisfies Partial<jest.Mocked<Reflector>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();

    // default: route is not public
    mockReflector.getAllAndOverride.mockReturnValue(false);
    mockAuthProviderFactory.getActiveAdapter.mockReturnValue(
      mockAdapter as unknown as AuthProviderAdapter,
    );

    guard = new AuthGuard(
      mockAuthProviderFactory as unknown as AuthProviderFactory,
      mockAuthService as unknown as AuthService,
      mockReflector as unknown as Reflector,
    );
  });

  // ── public routes ─────────────────────────────────────────────────────────

  describe('@Public() routes', () => {
    it('should return true without checking token when route is public', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const request = makeRequest(undefined);

      const result = await guard.canActivate(makeContext(request));

      expect(result).toBe(true);
      expect(mockAdapter.verifyToken).not.toHaveBeenCalled();
      expect(mockAuthService.resolveUserFromProfile).not.toHaveBeenCalled();
    });

    it('should check IS_PUBLIC_KEY on handler and class', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const ctx = makeContext(makeRequest(undefined));

      await guard.canActivate(ctx);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
    });
  });

  // ── canActivate — happy path ───────────────────────────────────────────────

  describe('canActivate', () => {
    it('should return true and attach user to request when token is valid', async () => {
      const token = faker.string.alphanumeric(40);
      const profile = makeProfile();
      const user = makeAuthenticatedUser();
      const request = makeRequest(`Bearer ${token}`);

      mockAdapter.verifyToken.mockResolvedValue(profile);
      mockAuthService.resolveUserFromProfile.mockResolvedValue(user);

      const result = await guard.canActivate(makeContext(request));

      expect(mockAuthProviderFactory.getActiveAdapter).toHaveBeenCalled();
      expect(mockAdapter.verifyToken).toHaveBeenCalledWith(token);
      expect(mockAuthService.resolveUserFromProfile).toHaveBeenCalledWith(profile);
      expect(request.user).toBe(user);
      expect(result).toBe(true);
    });

    it('should use Auth0 adapter when factory returns Auth0 adapter', async () => {
      const token = faker.string.alphanumeric(40);
      const profile = makeProfile({ providerId: `google-oauth2|${faker.string.numeric(10)}` });
      const user = makeAuthenticatedUser();
      const request = makeRequest(`Bearer ${token}`);

      const auth0Adapter = { verifyToken: jest.fn().mockResolvedValue(profile) };
      mockAuthProviderFactory.getActiveAdapter.mockReturnValue(
        auth0Adapter as unknown as AuthProviderAdapter,
      );
      mockAuthService.resolveUserFromProfile.mockResolvedValue(user);

      const result = await guard.canActivate(makeContext(request));

      expect(auth0Adapter.verifyToken).toHaveBeenCalledWith(token);
      expect(result).toBe(true);
    });
  });

  // ── token extraction ──────────────────────────────────────────────────────

  describe('token extraction', () => {
    it('should throw UnauthorizedException when authorization header is missing', async () => {
      const request = makeRequest(undefined);

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(MESSAGES.INVALID_TOKEN);
      expect(mockAdapter.verifyToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when scheme is not bearer', async () => {
      const request = makeRequest(`Basic ${faker.string.alphanumeric(40)}`);

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
      expect(mockAdapter.verifyToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token is missing after bearer scheme', async () => {
      const request = makeRequest('Bearer ');

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
      expect(mockAdapter.verifyToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when bearer scheme has no space', async () => {
      const request = makeRequest('BearerNoSpace');

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
      expect(mockAdapter.verifyToken).not.toHaveBeenCalled();
    });
  });

  // ── downstream errors ─────────────────────────────────────────────────────

  describe('downstream errors', () => {
    it('should propagate UnauthorizedException when adapter verifyToken fails', async () => {
      const token = faker.string.alphanumeric(40);
      const request = makeRequest(`Bearer ${token}`);

      mockAdapter.verifyToken.mockRejectedValue(new UnauthorizedException(MESSAGES.INVALID_TOKEN));

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.resolveUserFromProfile).not.toHaveBeenCalled();
    });

    it('should propagate error when resolveUserFromProfile fails', async () => {
      const token = faker.string.alphanumeric(40);
      const request = makeRequest(`Bearer ${token}`);

      mockAdapter.verifyToken.mockResolvedValue(makeProfile());
      mockAuthService.resolveUserFromProfile.mockRejectedValue(new Error('resolve failed'));

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow('resolve failed');
    });
  });
});
