import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PinoLogger } from 'nestjs-pino';

import { createMockEm, createMockLogger } from '@/test/mocks';

import { CategoriesRepository } from './categories.repository';
import type { Category } from './entities/category.entity';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeCategory = (overrides: Partial<Category> = {}): Category =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.department(),
    slug: faker.helpers.slugify(faker.commerce.department()).toLowerCase(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }) as Category;

const makeCreateData = () => ({
  name: faker.commerce.department(),
  slug: faker.helpers.slugify(faker.commerce.department()).toLowerCase(),
  description: faker.lorem.sentence(),
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockEm = createMockEm();
const mockLogger = createMockLogger();

// ─── suite ───────────────────────────────────────────────────────────────────

describe('CategoriesRepository', () => {
  let repository: CategoriesRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CategoriesRepository(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all non-deleted categories', async () => {
      const categories = [makeCategory(), makeCategory()];
      mockEm.find.mockResolvedValue(categories);

      const result = await repository.findAll();

      expect(mockEm.find).toHaveBeenCalledWith(expect.anything(), { deletedAt: null });
      expect(result).toBe(categories);
    });

    it('should return empty array when no categories exist', async () => {
      mockEm.find.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should find category by id', async () => {
      const category = makeCategory();
      mockEm.findOne.mockResolvedValue(category);

      const result = await repository.findOne({ id: category.id });

      expect(mockEm.findOne).toHaveBeenCalledWith(expect.anything(), {
        id: category.id,
        deletedAt: null,
      });
      expect(result).toBe(category);
    });

    it('should find category by slug', async () => {
      const category = makeCategory();
      mockEm.findOne.mockResolvedValue(category);

      const result = await repository.findOne({ slug: category.slug });

      expect(mockEm.findOne).toHaveBeenCalledWith(expect.anything(), {
        slug: category.slug,
        deletedAt: null,
      });
      expect(result).toBe(category);
    });

    it('should return null when category not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.findOne({ id: faker.string.uuid() });

      expect(result).toBeNull();
    });
  });

  // ── existsBySlug ───────────────────────────────────────────────────────────

  describe('existsBySlug', () => {
    it('should return true when slug exists', async () => {
      mockEm.findOne.mockResolvedValue(makeCategory());

      const result = await repository.existsBySlug('living-room');

      expect(result).toBe(true);
    });

    it('should return false when slug does not exist', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.existsBySlug('non-existent');

      expect(result).toBe(false);
    });

    it('should return false when slug belongs to the excluded id', async () => {
      const category = makeCategory();
      mockEm.findOne.mockResolvedValue(category);

      const result = await repository.existsBySlug(category.slug, category.id);

      expect(result).toBe(false);
    });

    it('should return true when slug exists on a different category', async () => {
      const existing = makeCategory();
      const otherId = faker.string.uuid();
      mockEm.findOne.mockResolvedValue(existing);

      const result = await repository.existsBySlug(existing.slug, otherId);

      expect(result).toBe(true);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a new category', async () => {
      const data = makeCreateData();
      const category = makeCategory(data);

      mockEm.create.mockReturnValue(category);
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.create(data);

      expect(mockEm.clear).toHaveBeenCalled();
      expect(mockEm.create).toHaveBeenCalledWith(expect.anything(), data);
      expect(mockEm.persist).toHaveBeenCalledWith(category);
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result).toBe(category);
    });

    it('should propagate error when flush fails', async () => {
      const data = makeCreateData();
      mockEm.create.mockReturnValue(makeCategory(data));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.create(data)).rejects.toThrow('flush failed');
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should assign data and flush', async () => {
      const category = makeCategory();
      const newName = faker.commerce.department();
      mockEm.assign.mockImplementation((c: Category, d: Partial<Category>) => Object.assign(c, d));
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.update(category, { name: newName });

      expect(mockEm.assign).toHaveBeenCalledWith(category, { name: newName });
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result.name).toBe(newName);
    });

    it('should propagate error when flush fails', async () => {
      const category = makeCategory();
      mockEm.assign.mockImplementation((c: Category, d: Partial<Category>) => Object.assign(c, d));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(
        repository.update(category, { name: faker.commerce.department() }),
      ).rejects.toThrow('flush failed');
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should set deletedAt and flush', async () => {
      const category = makeCategory({ deletedAt: null });
      mockEm.assign.mockImplementation((c: Category, d: Partial<Category>) => Object.assign(c, d));
      mockEm.flush.mockResolvedValue(undefined);

      await repository.softDelete(category);

      expect(mockEm.assign).toHaveBeenCalledWith(
        category,
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should propagate error when flush fails', async () => {
      const category = makeCategory();
      mockEm.assign.mockImplementation((c: Category, d: Partial<Category>) => Object.assign(c, d));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.softDelete(category)).rejects.toThrow('flush failed');
    });
  });
});
