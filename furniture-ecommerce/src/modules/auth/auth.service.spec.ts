import { faker } from '@faker-js/faker';
import { PinoLogger } from 'nestjs-pino';

import { AuthProvider, Role, SocialProvider } from '@/common/enums';
import type { UserIdentityWithUser } from '@/modules/user-identities/entities/user-identity.entity';
import { UserIdentitiesService } from '@/modules/user-identities/user-identities.service';
import type { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { AuthProviderFactory } from './auth-provider.factory';
import { AuthService } from './auth.service';
import type { AuthProviderProfile } from './interfaces';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeProfile = (overrides: Partial<AuthProviderProfile> = {}): AuthProviderProfile => ({
  providerId: faker.string.alphanumeric(20),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  socialProvider: SocialProvider.Google,
  socialProviderSub: faker.string.numeric(10),
  ...overrides,
});

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: Role.User,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }) as User;

const makeIdentityWithUser = (user: User): UserIdentityWithUser =>
  ({
    id: faker.string.uuid(),
    provider: AuthProvider.Clerk,
    providerId: faker.string.alphanumeric(20),
    socialProvider: SocialProvider.Google,
    socialProviderSub: faker.string.numeric(10),
    user,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  }) as unknown as UserIdentityWithUser;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockUsersService = {
  findOrCreate: jest.fn(),
} satisfies Partial<jest.Mocked<UsersService>>;

const mockUserIdentitiesService = {
  findByProviderAndId: jest.fn(),
  upsert: jest.fn(),
} satisfies Partial<jest.Mocked<UserIdentitiesService>>;

const mockAuthProviderFactory = {
  getActiveProvider: jest.fn(),
} satisfies Partial<jest.Mocked<AuthProviderFactory>>;

const mockLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} satisfies Partial<jest.Mocked<PinoLogger>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthProviderFactory.getActiveProvider.mockReturnValue(AuthProvider.Clerk);
    service = new AuthService(
      mockUsersService as unknown as UsersService,
      mockUserIdentitiesService as unknown as UserIdentitiesService,
      mockAuthProviderFactory as unknown as AuthProviderFactory,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── resolveUserFromProfile ─────────────────────────────────────────────────

  describe('resolveUserFromProfile', () => {
    describe('hot path — existing identity', () => {
      it('should return user from existing identity without creating new records', async () => {
        const user = makeUser();
        const identity = makeIdentityWithUser(user);
        const profile = makeProfile({ providerId: identity.providerId });

        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(identity);

        const result = await service.resolveUserFromProfile(profile);

        expect(mockUserIdentitiesService.findByProviderAndId).toHaveBeenCalledWith(
          AuthProvider.Clerk,
          profile.providerId,
        );
        expect(mockUsersService.findOrCreate).not.toHaveBeenCalled();
        expect(mockUserIdentitiesService.upsert).not.toHaveBeenCalled();
        expect(result.userId).toBe(user.id);
        expect(result.email).toBe(user.email);
        expect(result.role).toBe(user.role);
      });

      it('should use Auth0 provider when factory returns Auth0', async () => {
        mockAuthProviderFactory.getActiveProvider.mockReturnValue(AuthProvider.Auth0);
        const user = makeUser();
        const identity = makeIdentityWithUser(user);
        const profile = makeProfile();

        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(identity);

        await service.resolveUserFromProfile(profile);

        expect(mockUserIdentitiesService.findByProviderAndId).toHaveBeenCalledWith(
          AuthProvider.Auth0,
          profile.providerId,
        );
      });
    });

    describe('first login — new identity', () => {
      it('should create user and identity when neither exists', async () => {
        const profile = makeProfile();
        const user = makeUser({ email: profile.email, name: profile.name });

        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(null);
        mockUsersService.findOrCreate.mockResolvedValue({ user, created: true });
        mockUserIdentitiesService.upsert.mockResolvedValue({
          identity: makeIdentityWithUser(user),
          created: true,
        });

        const result = await service.resolveUserFromProfile(profile);

        expect(mockUsersService.findOrCreate).toHaveBeenCalledWith({
          email: profile.email,
          name: profile.name,
        });
        expect(mockUserIdentitiesService.upsert).toHaveBeenCalledWith({
          user,
          provider: AuthProvider.Clerk,
          providerId: profile.providerId,
          socialProvider: profile.socialProvider,
          socialProviderSub: profile.socialProviderSub,
        });
        expect(result.userId).toBe(user.id);
      });

      it('should find existing user and create new identity on first login with new provider', async () => {
        const profile = makeProfile();
        const user = makeUser({ email: profile.email });

        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(null);
        mockUsersService.findOrCreate.mockResolvedValue({ user, created: false });
        mockUserIdentitiesService.upsert.mockResolvedValue({
          identity: makeIdentityWithUser(user),
          created: true,
        });

        const result = await service.resolveUserFromProfile(profile);

        expect(mockUsersService.findOrCreate).toHaveBeenCalled();
        expect(mockUserIdentitiesService.upsert).toHaveBeenCalled();
        expect(result.userId).toBe(user.id);
      });

      it('should log when new user is created', async () => {
        const profile = makeProfile();
        const user = makeUser({ email: profile.email });

        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(null);
        mockUsersService.findOrCreate.mockResolvedValue({ user, created: true });
        mockUserIdentitiesService.upsert.mockResolvedValue({
          identity: makeIdentityWithUser(user),
          created: true,
        });

        await service.resolveUserFromProfile(profile);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({ userId: user.id }),
          'New user created',
        );
      });

      it('should not log new user when user already existed', async () => {
        const profile = makeProfile();
        const user = makeUser({ email: profile.email });

        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(null);
        mockUsersService.findOrCreate.mockResolvedValue({ user, created: false });
        mockUserIdentitiesService.upsert.mockResolvedValue({
          identity: makeIdentityWithUser(user),
          created: false,
        });

        await service.resolveUserFromProfile(profile);

        const newUserLogCall = mockLogger.info.mock.calls.find(
          (call) => call[1] === 'New user created',
        );
        expect(newUserLogCall).toBeUndefined();
      });

      it('should log when new identity is created', async () => {
        const profile = makeProfile();
        const user = makeUser({ email: profile.email });

        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(null);
        mockUsersService.findOrCreate.mockResolvedValue({ user, created: false });
        mockUserIdentitiesService.upsert.mockResolvedValue({
          identity: makeIdentityWithUser(user),
          created: true,
        });

        await service.resolveUserFromProfile(profile);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({ userId: user.id, provider: AuthProvider.Clerk }),
          'New identity created',
        );
      });

      it('should not log new identity when identity already existed', async () => {
        const profile = makeProfile();
        const user = makeUser({ email: profile.email });

        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(null);
        mockUsersService.findOrCreate.mockResolvedValue({ user, created: false });
        mockUserIdentitiesService.upsert.mockResolvedValue({
          identity: makeIdentityWithUser(user),
          created: false,
        });

        await service.resolveUserFromProfile(profile);

        const newIdentityLogCall = mockLogger.info.mock.calls.find(
          (call) => call[1] === 'New identity created',
        );
        expect(newIdentityLogCall).toBeUndefined();
      });

      it('should propagate error when findOrCreate throws', async () => {
        const profile = makeProfile();
        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(null);
        mockUsersService.findOrCreate.mockRejectedValue(new Error('DB error'));

        await expect(service.resolveUserFromProfile(profile)).rejects.toThrow('DB error');
      });

      it('should propagate error when upsert throws', async () => {
        const profile = makeProfile();
        const user = makeUser({ email: profile.email });

        mockUserIdentitiesService.findByProviderAndId.mockResolvedValue(null);
        mockUsersService.findOrCreate.mockResolvedValue({ user, created: true });
        mockUserIdentitiesService.upsert.mockRejectedValue(new Error('upsert failed'));

        await expect(service.resolveUserFromProfile(profile)).rejects.toThrow('upsert failed');
      });
    });
  });
});
