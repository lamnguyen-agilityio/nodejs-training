import { faker } from '@faker-js/faker';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { MESSAGES } from '@/common/constants';
import { CategoriesService } from '@/modules/categories/categories.service';
import type { Category } from '@/modules/categories/entities/category.entity';

import type { Product } from './entities/product.entity';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeCategory = (overrides: Partial<Category> = {}): Category =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.department(),
    slug: faker.helpers.slugify(faker.commerce.department()).toLowerCase(),
    deletedAt: null,
    ...overrides,
  }) as Category;

const makeProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    slug: faker.helpers.slugify(faker.commerce.productName()).toLowerCase(),
    description: faker.commerce.productDescription(),
    price: faker.commerce.price(),
    image: faker.internet.url(),
    quantityInStock: faker.number.int({ min: 1, max: 100 }),
    category: makeCategory(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }) as Product;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockProductsRepository = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  existsBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
} satisfies Partial<jest.Mocked<ProductsRepository>>;

const mockCategoriesService = {
  findOne: jest.fn(),
} satisfies Partial<jest.Mocked<CategoriesService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(
      mockProductsRepository as unknown as ProductsRepository,
      mockCategoriesService as unknown as CategoriesService,
    );
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should delegate to repository and return paginated products', async () => {
      const paginated = { items: [makeProduct()], total: 1, page: 1, limit: 20 };
      mockProductsRepository.findAll.mockResolvedValue(paginated);

      const result = await service.findAll({});

      expect(mockProductsRepository.findAll).toHaveBeenCalledWith({});
      expect(result).toBe(paginated);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return product when found by id', async () => {
      const product = makeProduct();
      mockProductsRepository.findOne.mockResolvedValue(product);

      const result = await service.findOne({ id: product.id });

      expect(result).toBe(product);
    });

    it('should return product when found by slug', async () => {
      const product = makeProduct();
      mockProductsRepository.findOne.mockResolvedValue(product);

      const result = await service.findOne({ slug: product.slug });

      expect(result).toBe(product);
    });

    it('should throw NotFoundException when product not found by id', async () => {
      const id = faker.string.uuid();
      mockProductsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne({ id })).rejects.toThrow(NotFoundException);
      await expect(service.findOne({ id })).rejects.toThrow(id);
    });

    it('should throw NotFoundException when product not found by slug', async () => {
      const slug = 'non-existent-slug';
      mockProductsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne({ slug })).rejects.toThrow(NotFoundException);
      await expect(service.findOne({ slug })).rejects.toThrow(slug);
    });
  });

  // ── findCategoryById ───────────────────────────────────────────────────────

  describe('findCategoryById', () => {
    it('should return category when found', async () => {
      const category = makeCategory();
      mockCategoriesService.findOne.mockResolvedValue(category);

      const result = await service.findCategoryById(category.id);

      expect(mockCategoriesService.findOne).toHaveBeenCalledWith({ id: category.id });
      expect(result).toBe(category);
    });

    it('should return undefined when category not found', async () => {
      mockCategoriesService.findOne.mockResolvedValue(undefined);

      const result = await service.findCategoryById(faker.string.uuid());

      expect(result).toBeUndefined();
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return product with generated slug', async () => {
      const category = makeCategory();
      const dto = {
        name: 'Modern Sofa',
        price: 1299.99,
        quantityInStock: 10,
        image: faker.internet.url(),
      };
      const product = makeProduct({ name: dto.name, slug: 'modern-sofa' });

      mockProductsRepository.existsBySlug.mockResolvedValue(false);
      mockProductsRepository.create.mockResolvedValue(product);

      const result = await service.create(dto, category);

      expect(mockProductsRepository.existsBySlug).toHaveBeenCalledWith('modern-sofa');
      expect(mockProductsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          slug: 'modern-sofa',
          category,
          price: String(dto.price),
        }),
      );
      expect(result).toBe(product);
    });

    it('should throw ConflictException when slug already exists', async () => {
      const category = makeCategory();
      mockProductsRepository.existsBySlug.mockResolvedValue(true);

      await expect(
        service.create({ name: 'Modern Sofa', price: 100, image: 'url' }, category),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create({ name: 'Modern Sofa', price: 100, image: 'url' }, category),
      ).rejects.toThrow(MESSAGES.PRODUCT_SLUG_CONFLICT);
      expect(mockProductsRepository.create).not.toHaveBeenCalled();
    });

    it('should convert price to string', async () => {
      const category = makeCategory();
      const dto = { name: 'Sofa', price: 1299.99, image: 'url' };
      mockProductsRepository.existsBySlug.mockResolvedValue(false);
      mockProductsRepository.create.mockResolvedValue(makeProduct());

      await service.create(dto, category);

      expect(mockProductsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ price: '1299.99' }),
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update product with new name and regenerated slug', async () => {
      const product = makeProduct();
      const category = makeCategory();
      const dto = { name: 'Updated Sofa', price: 999, quantityInStock: 99 };
      const updated = { ...product, name: dto.name } as Product;

      mockProductsRepository.findOne.mockResolvedValue(product);
      mockProductsRepository.existsBySlug.mockResolvedValue(false);
      mockProductsRepository.update.mockResolvedValue(updated);

      const result = await service.update(product.id, dto, category);

      expect(mockProductsRepository.existsBySlug).toHaveBeenCalledWith('updated-sofa', product.id);
      expect(mockProductsRepository.update).toHaveBeenCalledWith(
        product,
        expect.objectContaining({
          name: dto.name,
          slug: 'updated-sofa',
          price: '999',
          quantityInStock: 99,
        }),
      );
      expect(result).toBe(updated);
    });

    it('should not check slug when name is not updated', async () => {
      const product = makeProduct();
      const category = makeCategory();
      mockProductsRepository.findOne.mockResolvedValue(product);
      mockProductsRepository.update.mockResolvedValue(product);

      await service.update(product.id, { description: 'New desc' }, category);

      expect(mockProductsRepository.existsBySlug).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when product not found', async () => {
      mockProductsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(faker.string.uuid(), { name: 'New' }, makeCategory()),
      ).rejects.toThrow(NotFoundException);
      expect(mockProductsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when new slug already exists', async () => {
      const product = makeProduct();
      mockProductsRepository.findOne.mockResolvedValue(product);
      mockProductsRepository.existsBySlug.mockResolvedValue(true);

      await expect(
        service.update(product.id, { name: 'Conflicting' }, makeCategory()),
      ).rejects.toThrow(ConflictException);
      expect(mockProductsRepository.update).not.toHaveBeenCalled();
    });

    it('should update image when provided', async () => {
      const product = makeProduct();
      const newImage = faker.internet.url();
      mockProductsRepository.findOne.mockResolvedValue(product);
      mockProductsRepository.update.mockResolvedValue(product);

      await service.update(product.id, { image: newImage }, makeCategory());

      expect(mockProductsRepository.update).toHaveBeenCalledWith(
        product,
        expect.objectContaining({ image: newImage }),
      );
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should find and soft delete product', async () => {
      const product = makeProduct();
      mockProductsRepository.findOne.mockResolvedValue(product);
      mockProductsRepository.softDelete.mockResolvedValue(undefined);

      await service.softDelete(product.id);

      expect(mockProductsRepository.findOne).toHaveBeenCalledWith({ id: product.id });
      expect(mockProductsRepository.softDelete).toHaveBeenCalledWith(product);
    });

    it('should throw NotFoundException when product not found', async () => {
      mockProductsRepository.findOne.mockResolvedValue(null);

      await expect(service.softDelete(faker.string.uuid())).rejects.toThrow(NotFoundException);
      expect(mockProductsRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
