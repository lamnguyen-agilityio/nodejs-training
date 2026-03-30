import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/common/constants';
import { AuthProvider, SocialProvider } from '@/common/enums';

import type { AuthProviderProfile } from '../interfaces';
import { AuthProviderAdapter } from './auth-provider.adapter';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeProfile = (overrides: Partial<AuthProviderProfile> = {}): AuthProviderProfile => ({
  providerId: faker.string.alphanumeric(20),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  socialProvider: SocialProvider.Google,
  socialProviderSub: faker.string.numeric(20),
  ...overrides,
});

// ─── concrete subclass for testing abstract class ────────────────────────────

class TestAdapter extends AuthProviderAdapter {
  readonly provider = AuthProvider.Clerk;

  doVerifyTokenFn: jest.Mock = jest.fn();
  getUserProfileFn: jest.Mock = jest.fn();

  protected async doVerifyToken(token: string): Promise<AuthProviderProfile> {
    return this.doVerifyTokenFn(token);
  }

  async getUserProfile(providerId: string): Promise<AuthProviderProfile> {
    return this.getUserProfileFn(providerId);
  }
}

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockLogger = {
  setContext: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} satisfies Partial<jest.Mocked<PinoLogger>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('AuthProviderAdapter', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new TestAdapter(mockLogger as unknown as PinoLogger);
  });

  // ── verifyToken ────────────────────────────────────────────────────────────

  describe('verifyToken', () => {
    it('should return profile when doVerifyToken succeeds', async () => {
      const token = faker.string.alphanumeric(40);
      const profile = makeProfile();
      adapter.doVerifyTokenFn.mockResolvedValue(profile);

      const result = await adapter.verifyToken(token);

      expect(adapter.doVerifyTokenFn).toHaveBeenCalledWith(token);
      expect(result).toBe(profile);
    });

    it('should throw UnauthorizedException when doVerifyToken throws', async () => {
      const token = faker.string.alphanumeric(40);
      adapter.doVerifyTokenFn.mockRejectedValue(new Error('jwt expired'));

      await expect(adapter.verifyToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(adapter.verifyToken(token)).rejects.toThrow(MESSAGES.INVALID_TOKEN);
    });

    it('should log warning when doVerifyToken throws', async () => {
      const token = faker.string.alphanumeric(40);
      const error = new Error('jwt malformed');
      adapter.doVerifyTokenFn.mockRejectedValue(error);

      await expect(adapter.verifyToken(token)).rejects.toThrow(UnauthorizedException);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Token verification failed'),
      );
    });

    it('should convert any error type to UnauthorizedException', async () => {
      const token = faker.string.alphanumeric(40);
      adapter.doVerifyTokenFn.mockRejectedValue(new TypeError('unexpected type error'));

      await expect(adapter.verifyToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should not expose original error message to caller', async () => {
      const token = faker.string.alphanumeric(40);
      adapter.doVerifyTokenFn.mockRejectedValue(new Error('internal secret details'));

      await expect(adapter.verifyToken(token)).rejects.toThrow(MESSAGES.INVALID_TOKEN);
    });
  });
});
