import { faker } from '@faker-js/faker';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoryResponseDto } from './dtos';
import type { Category } from './entities/category.entity';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeCategory = (overrides: Partial<Category> = {}): Category =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.department(),
    slug: faker.helpers.slugify(faker.commerce.department()).toLowerCase(),
    image: faker.internet.url(),
    description: faker.lorem.sentence(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }) as Category;

const makeFile = (): Express.Multer.File =>
  ({
    fieldname: 'image',
    originalname: 'product.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from(''),
  }) as Express.Multer.File;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockCategoriesService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
} satisfies Partial<jest.Mocked<CategoriesService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CategoriesController(mockCategoriesService as unknown as CategoriesService);
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return array of CategoryResponseDto', async () => {
      const categories = [makeCategory(), makeCategory()];
      mockCategoriesService.findAll.mockResolvedValue(categories);

      const result = await controller.findAll();

      expect(mockCategoriesService.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(CategoryResponseDto);
    });

    it('should return empty array when no categories exist', async () => {
      mockCategoriesService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return CategoryResponseDto for given slug', async () => {
      const category = makeCategory();
      mockCategoriesService.findOne.mockResolvedValue(category);

      const result = await controller.findOne(category.slug);

      expect(mockCategoriesService.findOne).toHaveBeenCalledWith({ slug: category.slug });
      expect(result).toBeInstanceOf(CategoryResponseDto);
    });

    it('should propagate NotFoundException from service', async () => {
      mockCategoriesService.findOne.mockRejectedValue(new NotFoundException('Category not found'));

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should return CategoryResponseDto after creation', async () => {
      const dto = { name: faker.commerce.department() };
      const file = makeFile();
      const category = makeCategory({ name: dto.name });
      mockCategoriesService.create.mockResolvedValue(category);

      const result = await controller.create(dto, file);

      expect(mockCategoriesService.create).toHaveBeenCalledWith(dto, file);
      expect(result).toBeInstanceOf(CategoryResponseDto);
    });

    it('should propagate ConflictException from service', async () => {
      mockCategoriesService.create.mockRejectedValue(
        new ConflictException('Category name already exists'),
      );

      await expect(controller.create({ name: 'Duplicate' }, makeFile())).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should return CategoryResponseDto after update', async () => {
      const category = makeCategory();
      const dto = { name: faker.commerce.department() };
      const updated = { ...category, ...dto } as Category;
      mockCategoriesService.update.mockResolvedValue(updated);

      const result = await controller.update(category.id, dto, undefined);

      expect(mockCategoriesService.update).toHaveBeenCalledWith(
        category.id,
        expect.objectContaining({ name: dto.name }),
        undefined,
      );
      expect(result).toBeInstanceOf(CategoryResponseDto);
    });

    it('should propagate NotFoundException from service', async () => {
      mockCategoriesService.update.mockRejectedValue(new NotFoundException('Category not found'));

      await expect(controller.update(faker.string.uuid(), { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should call service softDelete with given id', async () => {
      const id = faker.string.uuid();
      mockCategoriesService.softDelete.mockResolvedValue(undefined);

      await controller.softDelete(id);

      expect(mockCategoriesService.softDelete).toHaveBeenCalledWith(id);
    });

    it('should propagate NotFoundException from service', async () => {
      mockCategoriesService.softDelete.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await expect(controller.softDelete(faker.string.uuid())).rejects.toThrow(NotFoundException);
    });
  });
});
