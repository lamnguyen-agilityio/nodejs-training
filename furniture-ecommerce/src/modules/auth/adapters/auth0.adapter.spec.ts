import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/common/constants';
import { AuthProvider, SocialProvider } from '@/common/enums';

import { Auth0Adapter } from './auth0.adapter';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeGoogleSub = (): string => `google-oauth2|${faker.string.numeric(10)}`;

const makeGithubSub = (): string => `github|${faker.string.numeric(10)}`;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockLogger = {
  setContext: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} satisfies Partial<jest.Mocked<PinoLogger>>;

const mockJwtVerify = jwt.verify as jest.Mock;

// helper: make jwt.verify call the callback with a payload (happy path)
const resolveJwt = (payload: Record<string, unknown>): void => {
  mockJwtVerify.mockImplementation(
    (_token: string, _getKey: unknown, _opts: unknown, callback: Function) => {
      callback(null, payload);
    },
  );
};

// helper: make jwt.verify call the callback with an error
const rejectJwt = (error: Error): void => {
  mockJwtVerify.mockImplementation(
    (_token: string, _getKey: unknown, _opts: unknown, callback: Function) => {
      callback(error, undefined);
    },
  );
};

// helper: make jwt.verify return a non-object decoded value
const resolveJwtWith = (decoded: unknown): void => {
  mockJwtVerify.mockImplementation(
    (_token: string, _getKey: unknown, _opts: unknown, callback: Function) => {
      callback(null, decoded);
    },
  );
};

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

  // ── verifyToken (via doVerifyToken) ────────────────────────────────────────

  describe('verifyToken', () => {
    it('should return profile for Google connection', async () => {
      const sub = makeGoogleSub();
      const email = faker.internet.email();
      const name = faker.person.fullName();
      resolveJwt({ sub, email, name });

      const result = await adapter.verifyToken(faker.string.alphanumeric(40));

      expect(result.providerId).toBe(sub);
      expect(result.email).toBe(email);
      expect(result.name).toBe(name);
      expect(result.socialProvider).toBe(SocialProvider.Google);
      expect(result.socialProviderSub).toBe(sub.split('|')[1]);
    });

    it('should return profile for GitHub connection', async () => {
      const sub = makeGithubSub();
      resolveJwt({ sub, email: faker.internet.email(), name: faker.person.fullName() });

      const result = await adapter.verifyToken(faker.string.alphanumeric(40));

      expect(result.socialProvider).toBe(SocialProvider.Github);
    });

    it('should use nickname as name when name is missing', async () => {
      const sub = makeGoogleSub();
      const nickname = faker.internet.userName();
      resolveJwt({ sub, email: faker.internet.email(), nickname });

      const result = await adapter.verifyToken(faker.string.alphanumeric(40));

      expect(result.name).toBe(nickname);
    });

    it('should use email as name when name and nickname are missing', async () => {
      const sub = makeGoogleSub();
      const email = faker.internet.email();
      resolveJwt({ sub, email });

      const result = await adapter.verifyToken(faker.string.alphanumeric(40));

      expect(result.name).toBe(email);
    });

    it('should throw UnauthorizedException when jwt.verify returns error', async () => {
      rejectJwt(new Error('invalid signature'));

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when decoded payload is null', async () => {
      resolveJwtWith(null);

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when decoded payload is an array', async () => {
      resolveJwtWith([]);

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when decoded payload has no sub', async () => {
      resolveJwt({ email: faker.internet.email() });

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when sub is not a string', async () => {
      resolveJwt({ sub: 12345, email: faker.internet.email() });

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when email is missing from payload', async () => {
      resolveJwt({ sub: makeGoogleSub() });

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        MESSAGES.INVALID_TOKEN,
      );
    });

    it('should throw UnauthorizedException for unsupported connection in sub', async () => {
      resolveJwt({
        sub: `facebook|${faker.string.numeric(10)}`,
        email: faker.internet.email(),
      });

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when sub has no pipe separator', async () => {
      resolveJwt({ sub: 'nopipeseparator', email: faker.internet.email() });

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when sub has empty connection', async () => {
      resolveJwt({ sub: `|${faker.string.numeric(10)}`, email: faker.internet.email() });

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when sub has empty id', async () => {
      resolveJwt({ sub: 'google-oauth2|', email: faker.internet.email() });

      await expect(adapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── getUserProfile ────────────────────────────────────────────────────────

  describe('getUserProfile', () => {
    it('should return profile with empty email and name for Google connection', async () => {
      const socialProviderSub = faker.string.numeric(10);
      const providerId = `google-oauth2|${socialProviderSub}`;

      const result = await adapter.getUserProfile(providerId);

      expect(result).toEqual({
        providerId,
        email: '',
        name: '',
        socialProvider: SocialProvider.Google,
        socialProviderSub,
      });
    });

    it('should return profile for GitHub connection', async () => {
      const socialProviderSub = faker.string.numeric(10);
      const providerId = `github|${socialProviderSub}`;

      const result = await adapter.getUserProfile(providerId);

      expect(result.socialProvider).toBe(SocialProvider.Github);
      expect(result.socialProviderSub).toBe(socialProviderSub);
    });

    it('should throw UnauthorizedException for unsupported connection', async () => {
      const providerId = `facebook|${faker.string.numeric(10)}`;

      await expect(adapter.getUserProfile(providerId)).rejects.toThrow(UnauthorizedException);
      await expect(adapter.getUserProfile(providerId)).rejects.toThrow(
        'Unsupported Auth0 connection: facebook',
      );
    });

    it('should throw UnauthorizedException when providerId has no pipe separator', async () => {
      await expect(adapter.getUserProfile('nopipeseparator')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when connection part is empty', async () => {
      await expect(adapter.getUserProfile(`|${faker.string.numeric(10)}`)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when id part is empty', async () => {
      await expect(adapter.getUserProfile('google-oauth2|')).rejects.toThrow(UnauthorizedException);
    });
  });
});

// ── getKey callback (jwksClient.getSigningKey) ─────────────────────────────

describe('getKey callback', () => {
  it('should propagate error from getSigningKey to jwt.verify callback', async () => {
    const signingKeyError = new Error('signing key not found');
    const mockGetSigningKey = jest.fn((_kid: unknown, cb: Function) => {
      cb(signingKeyError, undefined);
    });

    (JwksClient as jest.Mock).mockImplementationOnce(() => ({
      getSigningKey: mockGetSigningKey,
    }));

    // re-create adapter so it picks up the new JwksClient mock
    const freshAdapter = new Auth0Adapter(mockLogger as unknown as PinoLogger);

    // jwt.verify calls getKey — simulate that by capturing and invoking it
    mockJwtVerify.mockImplementation(
      (_token: string, getKey: Function, _opts: unknown, callback: Function) => {
        // invoke getKey with a fake header
        getKey({ kid: 'test-kid' }, (err: Error | null) => {
          if (err) {
            callback(err, undefined);
          } else {
            callback(null, { sub: makeGoogleSub(), email: faker.internet.email() });
          }
        });
      },
    );

    await expect(freshAdapter.verifyToken(faker.string.alphanumeric(40))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should pass public key from signing key to jwt.verify callback', async () => {
    const publicKey = 'mock-public-key';
    const mockGetSigningKey = jest.fn((_kid: unknown, cb: Function) => {
      cb(null, { getPublicKey: () => publicKey });
    });

    (JwksClient as jest.Mock).mockImplementationOnce(() => ({
      getSigningKey: mockGetSigningKey,
    }));

    const freshAdapter = new Auth0Adapter(mockLogger as unknown as PinoLogger);

    const sub = makeGoogleSub();
    const email = faker.internet.email();

    mockJwtVerify.mockImplementation(
      (_token: string, getKey: Function, _opts: unknown, callback: Function) => {
        getKey({ kid: 'test-kid' }, (err: Error | null, key: string | undefined) => {
          // verify public key was passed correctly then resolve
          expect(key).toBe(publicKey);
          callback(null, { sub, email });
        });
      },
    );

    const result = await freshAdapter.verifyToken(faker.string.alphanumeric(40));

    expect(result.email).toBe(email);
  });
});
