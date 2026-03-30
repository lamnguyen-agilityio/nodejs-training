import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AuthProvider, SocialProvider } from '@/common/enums';
import { verifyJwt, buildProfile, splitSub } from '@/common/utils';

import type { AuthProviderProfile } from '../interfaces';
import { Auth0Adapter } from './auth0.adapter';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeProfile = (overrides: Partial<AuthProviderProfile> = {}): AuthProviderProfile => ({
  providerId: `google-oauth2|${faker.string.numeric(10)}`,
  email: faker.internet.email(),
  name: faker.person.fullName(),
  socialProvider: SocialProvider.Google,
  socialProviderSub: faker.string.numeric(10),
  ...overrides,
});

const makePayload = () => ({
  sub: `google-oauth2|${faker.string.numeric(10)}`,
  email: faker.internet.email(),
  name: faker.person.fullName(),
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockLogger = {
  setContext: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} satisfies Partial<jest.Mocked<PinoLogger>>;

const mockVerifyJwt = verifyJwt as jest.Mock;
const mockBuildProfile = buildProfile as jest.Mock;
const mockSplitSub = splitSub as jest.Mock;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('Auth0Adapter', () => {
  let adapter: Auth0Adapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new Auth0Adapter(mockLogger as unknown as PinoLogger);
  });

  it('should have provider set to Auth0', () => {
    expect(adapter.provider).toBe(AuthProvider.Auth0);
  });

  // ── doVerifyToken (via verifyToken) ───────────────────────────────────────

  describe('verifyToken', () => {
    it('should verify JWT and return profile', async () => {
      const token = faker.string.alphanumeric(40);
      const payload = makePayload();
      const profile = makeProfile();

      mockVerifyJwt.mockResolvedValue(payload);
      mockBuildProfile.mockReturnValue(profile);

      const result = await adapter.verifyToken(token);

      expect(mockVerifyJwt).toHaveBeenCalledWith(token, expect.anything());
      expect(mockBuildProfile).toHaveBeenCalledWith(payload, expect.any(Object));
      expect(result).toBe(profile);
    });

    it('should throw UnauthorizedException when verifyJwt fails', async () => {
      const token = faker.string.alphanumeric(40);
      mockVerifyJwt.mockRejectedValue(new Error('invalid signature'));

      await expect(adapter.verifyToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when buildProfile throws', async () => {
      const token = faker.string.alphanumeric(40);
      mockVerifyJwt.mockResolvedValue(makePayload());
      mockBuildProfile.mockImplementation(() => {
        throw new UnauthorizedException('Unsupported connection');
      });

      await expect(adapter.verifyToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getUserProfile ────────────────────────────────────────────────────────

  describe('getUserProfile', () => {
    it('should return profile for Google connection', async () => {
      const sub = faker.string.numeric(10);
      const providerId = `google-oauth2|${sub}`;
      mockSplitSub.mockReturnValue(['google-oauth2', sub]);

      const result = await adapter.getUserProfile(providerId);

      expect(mockSplitSub).toHaveBeenCalledWith(providerId);
      expect(result).toEqual({
        providerId,
        email: '',
        name: '',
        socialProvider: SocialProvider.Google,
        socialProviderSub: sub,
      });
    });

    it('should return profile for GitHub connection', async () => {
      const sub = faker.string.numeric(10);
      const providerId = `github|${sub}`;
      mockSplitSub.mockReturnValue(['github', sub]);

      const result = await adapter.getUserProfile(providerId);

      expect(result.socialProvider).toBe(SocialProvider.Github);
      expect(result.socialProviderSub).toBe(sub);
    });

    it('should throw UnauthorizedException for unsupported connection', async () => {
      const providerId = `facebook|${faker.string.numeric(10)}`;
      mockSplitSub.mockReturnValue(['facebook', faker.string.numeric(10)]);

      await expect(adapter.getUserProfile(providerId)).rejects.toThrow(UnauthorizedException);
      await expect(adapter.getUserProfile(providerId)).rejects.toThrow(
        'Unsupported Auth0 connection: facebook',
      );
    });

    it('should throw UnauthorizedException when splitSub throws', async () => {
      const providerId = 'invalid-format';
      mockSplitSub.mockImplementation(() => {
        throw new UnauthorizedException('Unexpected Auth0 sub format');
      });

      await expect(adapter.getUserProfile(providerId)).rejects.toThrow(UnauthorizedException);
    });
  });
});
