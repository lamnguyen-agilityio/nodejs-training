import { faker } from '@faker-js/faker';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { MESSAGES } from '@/common/constants';

import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';
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

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockCategoriesRepository = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  existsBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
} satisfies Partial<jest.Mocked<CategoriesRepository>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CategoriesService(mockCategoriesRepository as unknown as CategoriesRepository);
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all categories', async () => {
      const categories = [makeCategory(), makeCategory()];
      mockCategoriesRepository.findAll.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(mockCategoriesRepository.findAll).toHaveBeenCalled();
      expect(result).toBe(categories);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return category when found by id', async () => {
      const category = makeCategory();
      mockCategoriesRepository.findOne.mockResolvedValue(category);

      const result = await service.findOne({ id: category.id });

      expect(result).toBe(category);
    });

    it('should return category when found by slug', async () => {
      const category = makeCategory();
      mockCategoriesRepository.findOne.mockResolvedValue(category);

      const result = await service.findOne({ slug: category.slug });

      expect(result).toBe(category);
    });

    it('should throw NotFoundException when not found by id', async () => {
      const id = faker.string.uuid();
      mockCategoriesRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne({ id })).rejects.toThrow(NotFoundException);
      await expect(service.findOne({ id })).rejects.toThrow(id);
    });

    it('should throw NotFoundException when not found by slug', async () => {
      const slug = 'non-existent-slug';
      mockCategoriesRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne({ slug })).rejects.toThrow(NotFoundException);
      await expect(service.findOne({ slug })).rejects.toThrow(slug);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a category', async () => {
      const dto = { name: 'Living Room', description: 'Sofas and chairs' };
      const category = makeCategory({ name: dto.name, slug: 'living-room' });

      mockCategoriesRepository.existsBySlug.mockResolvedValue(false);
      mockCategoriesRepository.create.mockResolvedValue(category);

      const result = await service.create(dto);

      expect(mockCategoriesRepository.existsBySlug).toHaveBeenCalledWith('living-room');
      expect(mockCategoriesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: dto.name, slug: 'living-room' }),
      );
      expect(result).toBe(category);
    });

    it('should generate correct slug from name', async () => {
      const dto = { name: 'Dining  Room & Kitchen!' };
      mockCategoriesRepository.existsBySlug.mockResolvedValue(false);
      mockCategoriesRepository.create.mockResolvedValue(makeCategory());

      await service.create(dto);

      expect(mockCategoriesRepository.existsBySlug).toHaveBeenCalledWith('dining-room-kitchen');
    });

    it('should throw ConflictException when slug already exists', async () => {
      const dto = { name: 'Living Room' };
      mockCategoriesRepository.existsBySlug.mockResolvedValue(true);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow(MESSAGES.CATEGORY_SLUG_CONFLICT);
      expect(mockCategoriesRepository.create).not.toHaveBeenCalled();
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return category', async () => {
      const category = makeCategory();
      const dto = { name: 'Updated Name', description: 'New description' };
      const updated = { ...category, ...dto, slug: 'updated-name' } as Category;

      mockCategoriesRepository.findOne.mockResolvedValue(category);
      mockCategoriesRepository.existsBySlug.mockResolvedValue(false);
      mockCategoriesRepository.update.mockResolvedValue(updated);

      const result = await service.update(category.id, dto);

      expect(mockCategoriesRepository.existsBySlug).toHaveBeenCalledWith(
        'updated-name',
        category.id,
      );
      expect(mockCategoriesRepository.update).toHaveBeenCalledWith(
        category,
        expect.objectContaining({ slug: 'updated-name' }),
      );
      expect(result).toBe(updated);
    });

    it('should not check slug when name is not updated', async () => {
      const category = makeCategory();
      const dto = { description: 'New description only' };

      mockCategoriesRepository.findOne.mockResolvedValue(category);
      mockCategoriesRepository.update.mockResolvedValue(category);

      await service.update(category.id, dto);

      expect(mockCategoriesRepository.existsBySlug).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category not found', async () => {
      const id = faker.string.uuid();
      mockCategoriesRepository.findOne.mockResolvedValue(null);

      await expect(service.update(id, { name: 'New Name' })).rejects.toThrow(NotFoundException);
      expect(mockCategoriesRepository.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when new slug already exists', async () => {
      const category = makeCategory();
      mockCategoriesRepository.findOne.mockResolvedValue(category);
      mockCategoriesRepository.existsBySlug.mockResolvedValue(true);

      await expect(service.update(category.id, { name: 'Conflicting Name' })).rejects.toThrow(
        ConflictException,
      );
      expect(mockCategoriesRepository.update).not.toHaveBeenCalled();
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should find and soft delete a category', async () => {
      const category = makeCategory();
      mockCategoriesRepository.findOne.mockResolvedValue(category);
      mockCategoriesRepository.softDelete.mockResolvedValue(undefined);

      await service.softDelete(category.id);

      expect(mockCategoriesRepository.findOne).toHaveBeenCalledWith({ id: category.id });
      expect(mockCategoriesRepository.softDelete).toHaveBeenCalledWith(category);
    });

    it('should throw NotFoundException when category not found', async () => {
      const id = faker.string.uuid();
      mockCategoriesRepository.findOne.mockResolvedValue(null);

      await expect(service.softDelete(id)).rejects.toThrow(NotFoundException);
      expect(mockCategoriesRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
