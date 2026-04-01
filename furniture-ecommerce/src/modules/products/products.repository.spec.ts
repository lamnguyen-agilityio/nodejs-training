import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PinoLogger } from 'nestjs-pino';

import type { Category } from '@/modules/categories/entities/category.entity';
import { createMockEm, createMockLogger } from '@/test';

import type { Product } from './entities/product.entity';
import type { CreateProductData } from './interfaces';
import { ProductsRepository } from './products.repository';

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

const makeCreateData = (category?: Category): CreateProductData => ({
  name: faker.commerce.productName(),
  slug: faker.helpers.slugify(faker.commerce.productName()).toLowerCase(),
  description: faker.commerce.productDescription(),
  price: faker.commerce.price(),
  image: faker.internet.url(),
  quantityInStock: faker.number.int({ min: 1, max: 100 }),
  category: category ?? makeCategory(),
});

// ─── suite ───────────────────────────────────────────────────────────────────

describe('ProductsRepository', () => {
  let repository: ProductsRepository;
  let mockEm: ReturnType<typeof createMockEm>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockEm = createMockEm();
    mockLogger = createMockLogger();
    repository = new ProductsRepository(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated products with default pagination', async () => {
      const products = [makeProduct(), makeProduct()];
      mockEm.findAndCount.mockResolvedValue([products, 2]);

      const result = await repository.findAll({});

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ deletedAt: null }),
        expect.objectContaining({ populate: ['category'], limit: 20, offset: 0 }),
      );
      expect(result.items).toBe(products);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by categorySlug when provided', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ categorySlug: 'living-room' });

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ category: { slug: 'living-room', deletedAt: null } }),
        expect.anything(),
      );
    });

    it('should filter by search term using $ilike', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ search: 'sofa' });

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: { $ilike: '%sofa%' } }),
        expect.anything(),
      );
    });

    it('should filter by minPrice', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ minPrice: 100 });

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ price: { $gte: 100 } }),
        expect.anything(),
      );
    });

    it('should filter by maxPrice', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ maxPrice: 500 });

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ price: { $lte: 500 } }),
        expect.anything(),
      );
    });

    it('should filter by both minPrice and maxPrice', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ minPrice: 100, maxPrice: 500 });

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ price: { $gte: 100, $lte: 500 } }),
        expect.anything(),
      );
    });

    it('should filter out zero-stock products by default', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({});

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ quantityInStock: { $gt: 0 } }),
        expect.anything(),
      );
    });

    it('should include hidden products when includeHidden is true', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ includeHidden: true });

      const where = mockEm.findAndCount.mock.calls[0][1] as Record<string, unknown>;
      expect(where['quantityInStock']).toBeUndefined();
    });

    it('should compute correct offset for page 2', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ page: 2, limit: 10 });

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ offset: 10 }),
      );
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should find product by id with category populated', async () => {
      const product = makeProduct();
      mockEm.findOne.mockResolvedValue(product);

      const result = await repository.findOne({ id: product.id });

      expect(mockEm.findOne).toHaveBeenCalledWith(
        expect.anything(),
        { id: product.id, deletedAt: null },
        { populate: ['category'] },
      );
      expect(result).toBe(product);
    });

    it('should find product by slug', async () => {
      const product = makeProduct();
      mockEm.findOne.mockResolvedValue(product);

      const result = await repository.findOne({ slug: product.slug });

      expect(mockEm.findOne).toHaveBeenCalledWith(
        expect.anything(),
        { slug: product.slug, deletedAt: null },
        expect.anything(),
      );
      expect(result).toBe(product);
    });

    it('should return null when product not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.findOne({ id: faker.string.uuid() });

      expect(result).toBeNull();
    });
  });

  // ── existsBySlug ───────────────────────────────────────────────────────────

  describe('existsBySlug', () => {
    it('should return true when slug exists', async () => {
      mockEm.findOne.mockResolvedValue(makeProduct());

      const result = await repository.existsBySlug('modern-sofa');

      expect(result).toBe(true);
    });

    it('should return false when slug does not exist', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.existsBySlug('non-existent');

      expect(result).toBe(false);
    });

    it('should return false when slug belongs to excluded id', async () => {
      const product = makeProduct();
      mockEm.findOne.mockResolvedValue(product);

      const result = await repository.existsBySlug(product.slug, product.id);

      expect(result).toBe(false);
    });

    it('should return true when slug belongs to different product', async () => {
      const product = makeProduct();
      mockEm.findOne.mockResolvedValue(product);

      const result = await repository.existsBySlug(product.slug, faker.string.uuid());

      expect(result).toBe(true);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a new product', async () => {
      const data = makeCreateData();
      const product = makeProduct();
      mockEm.create.mockReturnValue(product);
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.create(data);

      expect(mockEm.clear).toHaveBeenCalled();
      expect(mockEm.create).toHaveBeenCalledWith(expect.anything(), data);
      expect(mockEm.persist).toHaveBeenCalledWith(product);
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result).toBe(product);
    });

    it('should propagate error when flush fails', async () => {
      mockEm.create.mockReturnValue(makeProduct());
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.create(makeCreateData())).rejects.toThrow('flush failed');
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should assign changes and flush', async () => {
      const product = makeProduct();
      const changes = { name: faker.commerce.productName() };
      mockEm.assign.mockImplementation((p: Product, d: Partial<Product>) => Object.assign(p, d));
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.update(product, changes);

      expect(mockEm.assign).toHaveBeenCalledWith(product, changes);
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result.name).toBe(changes.name);
    });

    it('should propagate error when flush fails', async () => {
      const product = makeProduct();
      mockEm.assign.mockImplementation((p: Product, d: Partial<Product>) => Object.assign(p, d));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.update(product, {})).rejects.toThrow('flush failed');
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should set deletedAt and flush', async () => {
      const product = makeProduct({ deletedAt: null });
      mockEm.assign.mockImplementation((p: Product, d: Partial<Product>) => Object.assign(p, d));
      mockEm.flush.mockResolvedValue(undefined);

      await repository.softDelete(product);

      expect(mockEm.assign).toHaveBeenCalledWith(
        product,
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should propagate error when flush fails', async () => {
      const product = makeProduct();
      mockEm.assign.mockImplementation((p: Product, d: Partial<Product>) => Object.assign(p, d));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.softDelete(product)).rejects.toThrow('flush failed');
    });
  });
});
