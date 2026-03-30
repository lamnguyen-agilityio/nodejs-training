import { faker } from '@faker-js/faker';

import { AuthProvider, SocialProvider } from '@/common/enums';
import type { User } from '@/modules/users/entities/user.entity';

import type { UserIdentity, UserIdentityWithUser } from './entities/user-identity.entity';
import type { UpsertIdentity } from './interfaces';
import { UserIdentitiesRepository } from './user-identities.repository';
import { UserIdentitiesService } from './user-identities.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    ...overrides,
  }) as User;

const makeIdentity = (overrides: Partial<UserIdentity> = {}): UserIdentity =>
  ({
    id: faker.string.uuid(),
    provider: AuthProvider.Clerk,
    providerId: faker.string.alphanumeric(20),
    socialProvider: SocialProvider.Google,
    socialProviderSub: faker.string.numeric(20),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }) as UserIdentity;

const makeIdentityWithUser = (
  overrides: Partial<UserIdentityWithUser> = {},
): UserIdentityWithUser =>
  ({
    ...makeIdentity(),
    user: makeUser(),
    ...overrides,
  }) as UserIdentityWithUser;

const makeUpsertData = (overrides: Partial<UpsertIdentity> = {}): UpsertIdentity => ({
  user: makeUser(),
  provider: AuthProvider.Clerk,
  providerId: faker.string.alphanumeric(20),
  socialProvider: SocialProvider.Google,
  socialProviderSub: faker.string.numeric(20),
  ...overrides,
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockUserIdentitiesRepository = {
  findByProviderAndId: jest.fn(),
  findAllByUser: jest.fn(),
  findByUserAndProvider: jest.fn(),
  upsert: jest.fn(),
  create: jest.fn(),
} satisfies Partial<jest.Mocked<UserIdentitiesRepository>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('UserIdentitiesService', () => {
  let service: UserIdentitiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserIdentitiesService(
      mockUserIdentitiesRepository as unknown as UserIdentitiesRepository,
    );
  });

  // ── findByProviderAndId ────────────────────────────────────────────────────

  describe('findByProviderAndId', () => {
    it('should return identity with user when found', async () => {
      const identity = makeIdentityWithUser();
      mockUserIdentitiesRepository.findByProviderAndId.mockResolvedValue(identity);

      const result = await service.findByProviderAndId(identity.provider, identity.providerId);

      expect(mockUserIdentitiesRepository.findByProviderAndId).toHaveBeenCalledWith(
        identity.provider,
        identity.providerId,
      );
      expect(result).toBe(identity);
    });

    it('should return null when identity not found', async () => {
      mockUserIdentitiesRepository.findByProviderAndId.mockResolvedValue(null);

      const result = await service.findByProviderAndId(
        AuthProvider.Clerk,
        faker.string.alphanumeric(20),
      );

      expect(result).toBeNull();
    });
  });

  // ── hasIdentityForProvider ─────────────────────────────────────────────────

  describe('hasIdentityForProvider', () => {
    it('should return true when identity exists for provider', async () => {
      const user = makeUser();
      mockUserIdentitiesRepository.findByUserAndProvider.mockResolvedValue(makeIdentity());

      const result = await service.hasIdentityForProvider(user, AuthProvider.Auth0);

      expect(mockUserIdentitiesRepository.findByUserAndProvider).toHaveBeenCalledWith(
        user,
        AuthProvider.Auth0,
      );
      expect(result).toBe(true);
    });

    it('should return false when identity does not exist for provider', async () => {
      const user = makeUser();
      mockUserIdentitiesRepository.findByUserAndProvider.mockResolvedValue(null);

      const result = await service.hasIdentityForProvider(user, AuthProvider.Auth0);

      expect(result).toBe(false);
    });
  });

  // ── findAllByUser ──────────────────────────────────────────────────────────

  describe('findAllByUser', () => {
    it('should return all identities for a user', async () => {
      const user = makeUser();
      const identities = [makeIdentity(), makeIdentity()];
      mockUserIdentitiesRepository.findAllByUser.mockResolvedValue(identities);

      const result = await service.findAllByUser(user);

      expect(mockUserIdentitiesRepository.findAllByUser).toHaveBeenCalledWith(user);
      expect(result).toBe(identities);
    });

    it('should return empty array when user has no identities', async () => {
      const user = makeUser();
      mockUserIdentitiesRepository.findAllByUser.mockResolvedValue([]);

      const result = await service.findAllByUser(user);

      expect(result).toEqual([]);
    });
  });

  // ── upsert ─────────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('should return existing identity with created=false', async () => {
      const data = makeUpsertData();
      const identity = makeIdentity();
      mockUserIdentitiesRepository.upsert.mockResolvedValue({ identity, created: false });

      const result = await service.upsert(data);

      expect(mockUserIdentitiesRepository.upsert).toHaveBeenCalledWith(data);
      expect(result).toEqual({ identity, created: false });
    });

    it('should return new identity with created=true', async () => {
      const data = makeUpsertData();
      const identity = makeIdentity();
      mockUserIdentitiesRepository.upsert.mockResolvedValue({ identity, created: true });

      const result = await service.upsert(data);

      expect(result).toEqual({ identity, created: true });
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a new identity', async () => {
      const data = makeUpsertData();
      const identity = makeIdentity();
      mockUserIdentitiesRepository.create.mockResolvedValue(identity);

      const result = await service.create(data);

      expect(mockUserIdentitiesRepository.create).toHaveBeenCalledWith(data);
      expect(result).toBe(identity);
    });

    it('should propagate error when repository create fails', async () => {
      const data = makeUpsertData();
      mockUserIdentitiesRepository.create.mockRejectedValue(new Error('create failed'));

      await expect(service.create(data)).rejects.toThrow('create failed');
    });
  });
});
