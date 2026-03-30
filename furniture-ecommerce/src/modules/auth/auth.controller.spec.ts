import { faker } from '@faker-js/faker';

import { AuthProvider, Role } from '@/common/enums';

import { AuthProviderFactory } from './auth-provider.factory';
import { AuthController } from './auth.controller';
import type { AuthenticatedUser } from './interfaces';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthenticatedUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  userId: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
  ...overrides,
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockAuthProviderFactory = {
  getActiveProvider: jest.fn(),
  getRegisteredProviders: jest.fn(),
  switchProvider: jest.fn(),
} satisfies Partial<jest.Mocked<AuthProviderFactory>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthProviderFactory.getActiveProvider.mockReturnValue(AuthProvider.Clerk);
    mockAuthProviderFactory.getRegisteredProviders.mockReturnValue([
      AuthProvider.Clerk,
      AuthProvider.Auth0,
    ]);
    controller = new AuthController(mockAuthProviderFactory as unknown as AuthProviderFactory);
  });

  // ── getMe ──────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('should return the authenticated user', () => {
      const user = makeAuthenticatedUser();

      const result = controller.getMe(user);

      expect(result).toBe(user);
    });

    it('should return admin user correctly', () => {
      const user = makeAuthenticatedUser({ role: Role.Admin });

      const result = controller.getMe(user);

      expect(result.role).toBe(Role.Admin);
    });
  });

  // ── getProviderStatus ──────────────────────────────────────────────────────

  describe('getProviderStatus', () => {
    it('should return current provider status', () => {
      const result = controller.getProviderStatus();

      expect(mockAuthProviderFactory.getActiveProvider).toHaveBeenCalled();
      expect(mockAuthProviderFactory.getRegisteredProviders).toHaveBeenCalled();
      expect(result.active).toBe(AuthProvider.Clerk);
      expect(result.available).toContain(AuthProvider.Auth0);
    });

    it('should reflect Auth0 as active when factory returns Auth0', () => {
      mockAuthProviderFactory.getActiveProvider.mockReturnValue(AuthProvider.Auth0);

      const result = controller.getProviderStatus();

      expect(result.active).toBe(AuthProvider.Auth0);
    });
  });

  // ── switchProvider ─────────────────────────────────────────────────────────

  describe('switchProvider', () => {
    it('should call switchProvider on factory and return updated status', () => {
      mockAuthProviderFactory.switchProvider.mockImplementation(() => {
        mockAuthProviderFactory.getActiveProvider.mockReturnValue(AuthProvider.Auth0);
      });

      const result = controller.switchProvider({ provider: AuthProvider.Auth0 });

      expect(mockAuthProviderFactory.switchProvider).toHaveBeenCalledWith(AuthProvider.Auth0);
      expect(result.active).toBe(AuthProvider.Auth0);
    });

    it('should switch back to Clerk and return updated status', () => {
      mockAuthProviderFactory.getActiveProvider.mockReturnValue(AuthProvider.Auth0);
      mockAuthProviderFactory.switchProvider.mockImplementation(() => {
        mockAuthProviderFactory.getActiveProvider.mockReturnValue(AuthProvider.Clerk);
      });

      const result = controller.switchProvider({ provider: AuthProvider.Clerk });

      expect(result.active).toBe(AuthProvider.Clerk);
    });

    it('should propagate error when factory switchProvider throws', () => {
      mockAuthProviderFactory.switchProvider.mockImplementation(() => {
        throw new Error('Unknown auth provider: unknown');
      });

      expect(() => controller.switchProvider({ provider: 'unknown' as AuthProvider })).toThrow(
        'Unknown auth provider: unknown',
      );
    });
  });
});
