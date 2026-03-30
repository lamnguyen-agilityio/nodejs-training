import { PinoLogger } from 'nestjs-pino';

import { AuthProvider } from '@/common/enums';

import { Auth0Adapter } from './adapters/auth0.adapter';
import { ClerkAdapter } from './adapters/clerk.adapter';
import { AuthProviderFactory } from './auth-provider.factory';

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockClerkAdapter = {
  provider: AuthProvider.Clerk,
  verifyToken: jest.fn(),
  getUserProfile: jest.fn(),
} satisfies Partial<jest.Mocked<ClerkAdapter>>;

const mockAuth0Adapter = {
  provider: AuthProvider.Auth0,
  verifyToken: jest.fn(),
  getUserProfile: jest.fn(),
} satisfies Partial<jest.Mocked<Auth0Adapter>>;

const mockLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} satisfies Partial<jest.Mocked<PinoLogger>>;

// ─── helpers ─────────────────────────────────────────────────────────────────

const createFactory = (): AuthProviderFactory =>
  new AuthProviderFactory(
    mockClerkAdapter as unknown as ClerkAdapter,
    mockAuth0Adapter as unknown as Auth0Adapter,
    mockLogger as unknown as PinoLogger,
  );

// ─── suite ───────────────────────────────────────────────────────────────────

describe('AuthProviderFactory', () => {
  let factory: AuthProviderFactory;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AUTH_PROVIDER;
    factory = createFactory();
  });

  afterEach(() => {
    delete process.env.AUTH_PROVIDER;
  });

  // ── onModuleInit ───────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should default to Clerk when AUTH_PROVIDER env var is not set', () => {
      factory.onModuleInit();

      expect(factory.getActiveProvider()).toBe(AuthProvider.Clerk);
    });

    it('should set active provider to Clerk when AUTH_PROVIDER=clerk', () => {
      process.env.AUTH_PROVIDER = AuthProvider.Clerk;
      factory.onModuleInit();

      expect(factory.getActiveProvider()).toBe(AuthProvider.Clerk);
    });

    it('should set active provider to Auth0 when AUTH_PROVIDER=auth0', () => {
      process.env.AUTH_PROVIDER = AuthProvider.Auth0;
      factory.onModuleInit();

      expect(factory.getActiveProvider()).toBe(AuthProvider.Auth0);
    });

    it('should default to Clerk when AUTH_PROVIDER is an unknown value', () => {
      process.env.AUTH_PROVIDER = 'unknown_provider';
      factory.onModuleInit();

      expect(factory.getActiveProvider()).toBe(AuthProvider.Clerk);
    });

    it('should register both Clerk and Auth0 adapters', () => {
      factory.onModuleInit();

      expect(factory.getRegisteredProviders()).toEqual(
        expect.arrayContaining([AuthProvider.Clerk, AuthProvider.Auth0]),
      );
    });

    it('should set logger context', () => {
      factory.onModuleInit();

      expect(mockLogger.setContext).toHaveBeenCalledWith(AuthProviderFactory.name);
    });

    it('should log initialised provider', () => {
      factory.onModuleInit();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(AuthProvider.Clerk));
    });
  });

  // ── getActiveAdapter ───────────────────────────────────────────────────────

  describe('getActiveAdapter', () => {
    it('should return ClerkAdapter when active provider is Clerk', () => {
      factory.onModuleInit();

      const adapter = factory.getActiveAdapter();

      expect(adapter).toBe(mockClerkAdapter);
    });

    it('should return Auth0Adapter when active provider is Auth0', () => {
      process.env.AUTH_PROVIDER = AuthProvider.Auth0;
      factory.onModuleInit();

      const adapter = factory.getActiveAdapter();

      expect(adapter).toBe(mockAuth0Adapter);
    });
  });

  // ── getActiveProvider ──────────────────────────────────────────────────────

  describe('getActiveProvider', () => {
    it('should return the currently active provider', () => {
      factory.onModuleInit();

      expect(factory.getActiveProvider()).toBe(AuthProvider.Clerk);
    });
  });

  // ── switchProvider ─────────────────────────────────────────────────────────

  describe('switchProvider', () => {
    beforeEach(() => {
      factory.onModuleInit();
    });

    it('should switch active provider from Clerk to Auth0', () => {
      factory.switchProvider(AuthProvider.Auth0);

      expect(factory.getActiveProvider()).toBe(AuthProvider.Auth0);
    });

    it('should switch active provider back to Clerk from Auth0', () => {
      factory.switchProvider(AuthProvider.Auth0);
      factory.switchProvider(AuthProvider.Clerk);

      expect(factory.getActiveProvider()).toBe(AuthProvider.Clerk);
    });

    it('should return Auth0 adapter after switching to Auth0', () => {
      factory.switchProvider(AuthProvider.Auth0);

      expect(factory.getActiveAdapter()).toBe(mockAuth0Adapter);
    });

    it('should log warning when switching provider', () => {
      factory.switchProvider(AuthProvider.Auth0);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(AuthProvider.Auth0));
    });

    it('should throw when switching to unknown provider', () => {
      expect(() => factory.switchProvider('unknown' as AuthProvider)).toThrow(
        'Unknown auth provider: unknown',
      );
    });
  });

  // ── getRegisteredProviders ─────────────────────────────────────────────────

  describe('getRegisteredProviders', () => {
    it('should return all registered providers', () => {
      factory.onModuleInit();

      const providers = factory.getRegisteredProviders();

      expect(providers).toHaveLength(2);
      expect(providers).toContain(AuthProvider.Clerk);
      expect(providers).toContain(AuthProvider.Auth0);
    });
  });
});
