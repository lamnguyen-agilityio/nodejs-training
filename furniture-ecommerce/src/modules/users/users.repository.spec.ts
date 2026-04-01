import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PinoLogger } from 'nestjs-pino';

import { Role } from '@/common/enums';

import type { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';

// ─── helpers ─────────────────────────────────────────────────────────────────

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

const makeCreateData = (): Pick<User, 'email' | 'name' | 'role'> => ({
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockEm = {
  findOne: jest.fn(),
  create: jest.fn(),
  persist: jest.fn(),
  flush: jest.fn(),
  assign: jest.fn(),
  clear: jest.fn(),
} satisfies Partial<jest.Mocked<EntityManager>>;

const mockLogger = {
  setContext: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} satisfies Partial<jest.Mocked<PinoLogger>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('UsersRepository', () => {
  let repository: UsersRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new UsersRepository(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should find a user by id', async () => {
      const user = makeUser();
      mockEm.findOne.mockResolvedValue(user);

      const result = await repository.findOne({ id: user.id });

      expect(mockEm.findOne).toHaveBeenCalledWith(expect.anything(), {
        id: user.id,
        deletedAt: null,
      });
      expect(result).toBe(user);
    });

    it('should find a user by email', async () => {
      const user = makeUser();
      mockEm.findOne.mockResolvedValue(user);

      const result = await repository.findOne({ email: user.email });

      expect(mockEm.findOne).toHaveBeenCalledWith(expect.anything(), {
        email: user.email,
        deletedAt: null,
      });
      expect(result).toBe(user);
    });

    it('should return null when user not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.findOne({ id: faker.string.uuid() });

      expect(result).toBeNull();
    });

    it('should throw when neither id nor email is provided', async () => {
      await expect(repository.findOne({})).rejects.toThrow('Must provide either id or email');
      expect(mockEm.findOne).not.toHaveBeenCalled();
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a new user', async () => {
      const data = makeCreateData();
      const user = makeUser(data);

      mockEm.create.mockReturnValue(user);
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.create(data);

      expect(mockEm.create).toHaveBeenCalledWith(expect.anything(), data);
      expect(mockEm.persist).toHaveBeenCalledWith(user);
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it('should propagate error when flush fails', async () => {
      const data = makeCreateData();
      mockEm.create.mockReturnValue(makeUser(data));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.create(data)).rejects.toThrow('flush failed');
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should assign data and flush', async () => {
      const user = makeUser();
      const newName = faker.person.fullName();
      mockEm.assign.mockImplementation((u: User, data: Partial<User>) => Object.assign(u, data));
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.update(user, { name: newName });

      expect(mockEm.assign).toHaveBeenCalledWith(user, { name: newName });
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result.name).toBe(newName);
    });

    it('should propagate error when flush fails', async () => {
      const user = makeUser();
      mockEm.assign.mockImplementation((u: User, data: Partial<User>) => Object.assign(u, data));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.update(user, { name: faker.person.fullName() })).rejects.toThrow(
        'flush failed',
      );
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should set deletedAt and flush', async () => {
      const user = makeUser();
      mockEm.assign.mockImplementation((u: User, data: Partial<User>) => Object.assign(u, data));
      mockEm.flush.mockResolvedValue(undefined);

      await repository.softDelete(user);

      expect(mockEm.assign).toHaveBeenCalledWith(
        user,
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should propagate error when flush fails', async () => {
      const user = makeUser();
      mockEm.clear.mockReturnValue(undefined);
      mockEm.assign.mockImplementation((u: User, data: Partial<User>) => Object.assign(u, data));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.softDelete(user)).rejects.toThrow('flush failed');
    });
  });
});
