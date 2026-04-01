import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PinoLogger } from 'nestjs-pino';

import { AuthProvider, SocialProvider } from '@/common/enums';
import type { User } from '@/modules/users/entities/user.entity';
import { createMockEm, createMockLogger } from '@/test';

import type { UserIdentity, UserIdentityWithUser } from './entities/user-identity.entity';
import type { UpsertIdentity } from './interfaces';
import { UserIdentitiesRepository } from './user-identities.repository';

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

const mockEm = createMockEm();
const mockLogger = createMockLogger();

// ─── suite ───────────────────────────────────────────────────────────────────

describe('UserIdentitiesRepository', () => {
  let repository: UserIdentitiesRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new UserIdentitiesRepository(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── findByProviderAndId ────────────────────────────────────────────────────

  describe('findByProviderAndId', () => {
    it('should return identity with user when found', async () => {
      const identity = makeIdentityWithUser();
      mockEm.findOne.mockResolvedValue(identity);

      const result = await repository.findByProviderAndId(identity.provider, identity.providerId);

      expect(mockEm.findOne).toHaveBeenCalledWith(
        expect.anything(),
        { provider: identity.provider, providerId: identity.providerId },
        { populate: ['user'] },
      );
      expect(result).toBe(identity);
    });

    it('should return null when identity not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.findByProviderAndId(
        AuthProvider.Clerk,
        faker.string.alphanumeric(20),
      );

      expect(result).toBeNull();
    });
  });

  // ── findAllByUser ──────────────────────────────────────────────────────────

  describe('findAllByUser', () => {
    it('should return all identities for a user', async () => {
      const user = makeUser();
      const identities = [makeIdentity(), makeIdentity()];
      mockEm.find.mockResolvedValue(identities);

      const result = await repository.findAllByUser(user);

      expect(mockEm.find).toHaveBeenCalledWith(expect.anything(), { user });
      expect(result).toBe(identities);
    });

    it('should return empty array when user has no identities', async () => {
      const user = makeUser();
      mockEm.find.mockResolvedValue([]);

      const result = await repository.findAllByUser(user);

      expect(result).toEqual([]);
    });
  });

  // ── findByUserAndProvider ──────────────────────────────────────────────────

  describe('findByUserAndProvider', () => {
    it('should return identity when found', async () => {
      const user = makeUser();
      const identity = makeIdentity({ provider: AuthProvider.Auth0 });
      mockEm.findOne.mockResolvedValue(identity);

      const result = await repository.findByUserAndProvider(user, AuthProvider.Auth0);

      expect(mockEm.findOne).toHaveBeenCalledWith(expect.anything(), {
        user,
        provider: AuthProvider.Auth0,
      });
      expect(result).toBe(identity);
    });

    it('should return null when identity not found for provider', async () => {
      const user = makeUser();
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.findByUserAndProvider(user, AuthProvider.Auth0);

      expect(result).toBeNull();
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a new identity', async () => {
      const data = makeUpsertData();
      const identity = makeIdentity();

      mockEm.create.mockReturnValue(identity);
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.create(data);

      expect(mockEm.create).toHaveBeenCalledWith(expect.anything(), data);
      expect(mockEm.persist).toHaveBeenCalledWith(identity);
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result).toBe(identity);
    });

    it('should propagate error when flush fails', async () => {
      const data = makeUpsertData();
      mockEm.create.mockReturnValue(makeIdentity());
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.create(data)).rejects.toThrow('flush failed');
    });
  });

  // ── upsert ─────────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('should update existing identity and return created=false', async () => {
      const data = makeUpsertData();
      const existing = makeIdentityWithUser({
        provider: data.provider,
        providerId: data.providerId,
      });

      mockEm.findOne.mockResolvedValue(existing);
      mockEm.assign.mockImplementation((identity: UserIdentity, updates: Partial<UserIdentity>) =>
        Object.assign(identity, updates),
      );
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.upsert(data);

      expect(mockEm.assign).toHaveBeenCalledWith(existing, {
        socialProvider: data.socialProvider,
        socialProviderSub: data.socialProviderSub,
      });
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result).toEqual({ identity: existing, created: false });
    });

    it('should create new identity and return created=true when not found', async () => {
      const data = makeUpsertData();
      const newIdentity = makeIdentity();

      mockEm.findOne.mockResolvedValue(null);
      mockEm.create.mockReturnValue(newIdentity);
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.upsert(data);

      expect(mockEm.create).toHaveBeenCalledWith(expect.anything(), data);
      expect(result).toEqual({ identity: newIdentity, created: true });
    });

    it('should propagate error when flush fails on update', async () => {
      const data = makeUpsertData();
      const existing = makeIdentityWithUser({
        provider: data.provider,
        providerId: data.providerId,
      });

      mockEm.findOne.mockResolvedValue(existing);
      mockEm.assign.mockImplementation((identity: UserIdentity, updates: Partial<UserIdentity>) =>
        Object.assign(identity, updates),
      );
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.upsert(data)).rejects.toThrow('flush failed');
    });

    it('should propagate error when flush fails on create', async () => {
      const data = makeUpsertData();
      mockEm.clear.mockReturnValue(undefined);
      mockEm.findOne.mockResolvedValue(null);
      mockEm.create.mockReturnValue(makeIdentity());
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.upsert(data)).rejects.toThrow('flush failed');
    });
  });
});
