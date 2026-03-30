import { createClerkClient, verifyToken } from '@clerk/backend';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/common/constants';
import { AuthProvider, SocialProvider } from '@/common/enums';

import { ClerkAdapter } from './clerk.adapter';

const getMockGetUser = (): jest.Mock =>
  (createClerkClient as jest.Mock).mock.results[0]?.value.users.getUser;

const mockVerifyToken = verifyToken as jest.Mock;

// ─── helpers ─────────────────────────────────────────────────────────────────

interface ClerkExternalAccount {
  provider: string;
  providerUserId: string;
  verification?: { status: string };
}

interface ClerkEmailAddress {
  emailAddress: string;
  verification?: { status: string };
}

const makeClerkUser = (
  overrides: Partial<{
    id: string;
    firstName: string;
    lastName: string;
    externalAccounts: ClerkExternalAccount[];
    primaryEmailAddress: { emailAddress: string; verification: { status: string } } | null;
    emailAddresses: ClerkEmailAddress[];
  }> = {},
) => ({
  id: `user_${faker.string.alphanumeric(20)}`,
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  externalAccounts: [
    {
      provider: 'oauth_google',
      providerUserId: faker.string.numeric(10),
      verification: { status: 'verified' },
    },
  ],
  primaryEmailAddress: {
    emailAddress: faker.internet.email(),
    verification: { status: 'verified' },
  },
  emailAddresses: [],
  ...overrides,
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockLogger = {
  setContext: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} satisfies Partial<jest.Mocked<PinoLogger>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('ClerkAdapter', () => {
  let adapter: ClerkAdapter;
  let mockGetUser: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ClerkAdapter(mockLogger as unknown as PinoLogger);
    mockGetUser = getMockGetUser();
  });

  it('should have provider set to Clerk', () => {
    expect(adapter.provider).toBe(AuthProvider.Clerk);
  });

  // ── doVerifyToken (via verifyToken) ───────────────────────────────────────

  describe('verifyToken', () => {
    it('should verify token and return profile via getUserProfile', async () => {
      const token = faker.string.alphanumeric(40);
      const clerkUser = makeClerkUser();
      mockVerifyToken.mockResolvedValue({ sub: clerkUser.id });
      mockGetUser.mockResolvedValue(clerkUser);

      const result = await adapter.verifyToken(token);

      expect(mockVerifyToken).toHaveBeenCalledWith(token, expect.any(Object));
      expect(mockGetUser).toHaveBeenCalledWith(clerkUser.id);
      expect(result.providerId).toBe(clerkUser.id);
    });

    it('should throw UnauthorizedException when verifyToken returns no sub', async () => {
      const token = faker.string.alphanumeric(40);
      mockVerifyToken.mockResolvedValue({ sub: null });

      await expect(adapter.verifyToken(token)).rejects.toThrow(UnauthorizedException);
      await expect(adapter.verifyToken(token)).rejects.toThrow(MESSAGES.INVALID_TOKEN);
    });

    it('should throw UnauthorizedException when verifyToken throws', async () => {
      const token = faker.string.alphanumeric(40);
      mockVerifyToken.mockRejectedValue(new Error('jwt expired'));

      await expect(adapter.verifyToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getUserProfile ────────────────────────────────────────────────────────

  describe('getUserProfile', () => {
    it('should return profile with Google social provider', async () => {
      const clerkUser = makeClerkUser();
      mockGetUser.mockResolvedValue(clerkUser);

      const result = await adapter.getUserProfile(clerkUser.id);

      expect(result.providerId).toBe(clerkUser.id);
      expect(result.socialProvider).toBe(SocialProvider.Google);
      expect(result.email).toBe(clerkUser.primaryEmailAddress!.emailAddress);
    });

    it('should return profile with GitHub social provider', async () => {
      const clerkUser = makeClerkUser({
        externalAccounts: [
          {
            provider: 'oauth_github',
            providerUserId: faker.string.numeric(10),
            verification: { status: 'verified' },
          },
        ],
      });
      mockGetUser.mockResolvedValue(clerkUser);

      const result = await adapter.getUserProfile(clerkUser.id);

      expect(result.socialProvider).toBe(SocialProvider.Github);
    });

    it('should prioritize supported provider over unsupported verified account', async () => {
      const googleAccount: ClerkExternalAccount = {
        provider: 'oauth_google',
        providerUserId: faker.string.numeric(10),
        verification: { status: 'verified' },
      };
      const unknownAccount: ClerkExternalAccount = {
        provider: 'oauth_twitter',
        providerUserId: faker.string.numeric(10),
        verification: { status: 'verified' },
      };
      const clerkUser = makeClerkUser({
        externalAccounts: [unknownAccount, googleAccount],
      });
      mockGetUser.mockResolvedValue(clerkUser);

      const result = await adapter.getUserProfile(clerkUser.id);

      expect(result.socialProvider).toBe(SocialProvider.Google);
    });

    it('should fallback to verified account when no supported provider found', async () => {
      const verifiedUnknown: ClerkExternalAccount = {
        provider: 'oauth_twitter',
        providerUserId: faker.string.numeric(10),
        verification: { status: 'verified' },
      };
      const clerkUser = makeClerkUser({ externalAccounts: [verifiedUnknown] });
      mockGetUser.mockResolvedValue(clerkUser);

      await expect(adapter.getUserProfile(clerkUser.id)).rejects.toThrow(UnauthorizedException);
    });

    it('should fallback to first account when none are supported or verified', async () => {
      const unverifiedGoogle: ClerkExternalAccount = {
        provider: 'oauth_google',
        providerUserId: faker.string.numeric(10),
        verification: { status: 'unverified' },
      };
      const clerkUser = makeClerkUser({ externalAccounts: [unverifiedGoogle] });
      mockGetUser.mockResolvedValue(clerkUser);

      const result = await adapter.getUserProfile(clerkUser.id);

      expect(result.socialProvider).toBe(SocialProvider.Google);
    });

    it('should throw UnauthorizedException when no external accounts', async () => {
      const clerkUser = makeClerkUser({ externalAccounts: [] });
      mockGetUser.mockResolvedValue(clerkUser);

      await expect(adapter.getUserProfile(clerkUser.id)).rejects.toThrow(UnauthorizedException);
      await expect(adapter.getUserProfile(clerkUser.id)).rejects.toThrow(
        MESSAGES.INVALID_SOCIAL_ACCOUNT,
      );
    });

    it('should throw UnauthorizedException when social provider is unsupported', async () => {
      const clerkUser = makeClerkUser({
        externalAccounts: [
          {
            provider: 'oauth_facebook',
            providerUserId: faker.string.numeric(10),
            verification: { status: 'verified' },
          },
        ],
      });
      mockGetUser.mockResolvedValue(clerkUser);

      await expect(adapter.getUserProfile(clerkUser.id)).rejects.toThrow(UnauthorizedException);
      await expect(adapter.getUserProfile(clerkUser.id)).rejects.toThrow(
        'Unsupported social provider',
      );
    });

    it('should throw UnauthorizedException when providerUserId is missing', async () => {
      const clerkUser = makeClerkUser({
        externalAccounts: [
          {
            provider: 'oauth_google',
            providerUserId: '',
            verification: { status: 'verified' },
          },
        ],
      });
      mockGetUser.mockResolvedValue(clerkUser);

      await expect(adapter.getUserProfile(clerkUser.id)).rejects.toThrow(UnauthorizedException);
      await expect(adapter.getUserProfile(clerkUser.id)).rejects.toThrow(
        MESSAGES.INVALID_EXTERNAL_ACCOUNT,
      );
    });

    it('should use fallback verified email when primary email is unverified', async () => {
      const fallbackEmail = faker.internet.email();
      const clerkUser = makeClerkUser({
        primaryEmailAddress: {
          emailAddress: faker.internet.email(),
          verification: { status: 'unverified' },
        },
        emailAddresses: [{ emailAddress: fallbackEmail, verification: { status: 'verified' } }],
      });
      mockGetUser.mockResolvedValue(clerkUser);

      const result = await adapter.getUserProfile(clerkUser.id);

      expect(result.email).toBe(fallbackEmail);
    });

    it('should throw UnauthorizedException when no verified email found', async () => {
      const clerkUser = makeClerkUser({
        primaryEmailAddress: null,
        emailAddresses: [
          { emailAddress: faker.internet.email(), verification: { status: 'unverified' } },
        ],
      });
      mockGetUser.mockResolvedValue(clerkUser);

      await expect(adapter.getUserProfile(clerkUser.id)).rejects.toThrow(UnauthorizedException);
      await expect(adapter.getUserProfile(clerkUser.id)).rejects.toThrow(
        MESSAGES.INVALID_EMAIL_ADDRESS,
      );
    });

    it('should build full name from firstName and lastName', async () => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const clerkUser = makeClerkUser({ firstName, lastName });
      mockGetUser.mockResolvedValue(clerkUser);

      const result = await adapter.getUserProfile(clerkUser.id);

      expect(result.name).toBe(`${firstName} ${lastName}`);
    });

    it('should use email as name when both firstName and lastName are empty', async () => {
      const clerkUser = makeClerkUser({ firstName: '', lastName: '' });
      mockGetUser.mockResolvedValue(clerkUser);

      const result = await adapter.getUserProfile(clerkUser.id);

      expect(result.name).toBe(result.email);
    });

    it('should propagate error when getUser throws', async () => {
      mockGetUser.mockRejectedValue(new Error('Clerk API error'));

      await expect(adapter.getUserProfile(faker.string.alphanumeric(20))).rejects.toThrow(
        'Clerk API error',
      );
    });
  });
});
