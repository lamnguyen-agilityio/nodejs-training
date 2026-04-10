import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';

import { PHONE_NUMBER } from '@/common/constants';
import { Role } from '@/common/enums';

import type { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

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

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockUsersRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
} satisfies Partial<jest.Mocked<UsersRepository>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(mockUsersRepository as unknown as UsersRepository);
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a user when found by id', async () => {
      const user = makeUser();
      mockUsersRepository.findOne.mockResolvedValue(user);

      const result = await service.findOne({ id: user.id });

      expect(mockUsersRepository.findOne).toHaveBeenCalledWith({ id: user.id });
      expect(result).toBe(user);
    });

    it('should return a user when found by email', async () => {
      const user = makeUser();
      mockUsersRepository.findOne.mockResolvedValue(user);

      const result = await service.findOne({ email: user.email });

      expect(mockUsersRepository.findOne).toHaveBeenCalledWith({ email: user.email });
      expect(result).toBe(user);
    });

    it('should throw NotFoundException with id in message when not found by id', async () => {
      const id = faker.string.uuid();
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne({ id })).rejects.toThrow(NotFoundException);
      await expect(service.findOne({ id })).rejects.toThrow(id);
    });

    it('should throw NotFoundException with email in message when not found by email', async () => {
      const email = faker.internet.email();
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne({ email })).rejects.toThrow(NotFoundException);
      await expect(service.findOne({ email })).rejects.toThrow(email);
    });
  });

  // ── findOrCreate ───────────────────────────────────────────────────────────

  describe('findOrCreate', () => {
    it('should return existing user with created=false when email already exists', async () => {
      const user = makeUser();
      mockUsersRepository.findOne.mockResolvedValue(user);

      const result = await service.findOrCreate({ email: user.email, name: user.name });

      expect(mockUsersRepository.findOne).toHaveBeenCalledWith({ email: user.email });
      expect(mockUsersRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual({ user, created: false });
    });

    it('should create and return new user with created=true when email not found', async () => {
      const dto = { email: faker.internet.email(), name: faker.person.fullName() };
      const newUser = makeUser({ ...dto, role: Role.User });

      mockUsersRepository.findOne.mockResolvedValue(null);
      mockUsersRepository.create.mockResolvedValue(newUser);

      const result = await service.findOrCreate(dto);

      expect(mockUsersRepository.create).toHaveBeenCalledWith({
        email: dto.email,
        name: dto.name,
        role: Role.User,
        phoneNumber: PHONE_NUMBER,
      });
      expect(result).toEqual({ user: newUser, created: true });
    });

    it('should always assign Role.User as default role on create', async () => {
      const dto = { email: faker.internet.email(), name: faker.person.fullName() };
      mockUsersRepository.findOne.mockResolvedValue(null);
      mockUsersRepository.create.mockResolvedValue(makeUser(dto));

      await service.findOrCreate(dto);

      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.User }),
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should find user then delegate to repository update', async () => {
      const user = makeUser();
      const dto = { name: faker.person.fullName() };
      const updated = { ...user, ...dto } as User;

      mockUsersRepository.findOne.mockResolvedValue(user);
      mockUsersRepository.update.mockResolvedValue(updated);

      const result = await service.update(user.id, dto);

      expect(mockUsersRepository.findOne).toHaveBeenCalledWith({ id: user.id });
      expect(mockUsersRepository.update).toHaveBeenCalledWith(user, dto);
      expect(result).toBe(updated);
    });

    it('should throw NotFoundException and skip update when user not found', async () => {
      const id = faker.string.uuid();
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.update(id, { name: faker.person.fullName() })).rejects.toThrow(
        NotFoundException,
      );

      expect(mockUsersRepository.update).not.toHaveBeenCalled();
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should find user then delegate to repository softDelete', async () => {
      const user = makeUser();
      mockUsersRepository.findOne.mockResolvedValue(user);
      mockUsersRepository.softDelete.mockResolvedValue(undefined);

      await service.softDelete(user.id);

      expect(mockUsersRepository.findOne).toHaveBeenCalledWith({ id: user.id });
      expect(mockUsersRepository.softDelete).toHaveBeenCalledWith(user);
    });

    it('should throw NotFoundException and skip softDelete when user not found', async () => {
      const id = faker.string.uuid();
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.softDelete(id)).rejects.toThrow(NotFoundException);

      expect(mockUsersRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
