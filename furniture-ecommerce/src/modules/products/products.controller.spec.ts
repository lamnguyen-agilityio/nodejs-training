import { faker } from '@faker-js/faker';
import { ConflictException, NotFoundException } from '@nestjs/common';

import type { Category } from '@/modules/categories/entities/category.entity';
import { ImageUploadService } from '@/modules/upload/image-upload.service';

import { ProductResponseDto, PaginatedProductsDto, CreateProductDto } from './dtos';
import type { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeCategory = (): Category =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.department(),
    slug: faker.helpers.slugify(faker.commerce.department()).toLowerCase(),
    deletedAt: null,
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

const mockProductsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findCategoryById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
} satisfies Partial<jest.Mocked<ProductsService>>;

const mockImageUploadService = {
  upload: jest.fn(),
} satisfies Partial<jest.Mocked<ImageUploadService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProductsController(
      mockProductsService as unknown as ProductsService,
      mockImageUploadService as unknown as ImageUploadService,
    );
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return PaginatedProductsDto', async () => {
      const products = [makeProduct()];
      mockProductsService.findAll.mockResolvedValue({
        items: products,
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await controller.findAll({});

      expect(mockProductsService.findAll).toHaveBeenCalledWith({});
      expect(result).toBeInstanceOf(PaginatedProductsDto);
      expect(result.total).toBe(1);
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return ProductResponseDto for given slug', async () => {
      const product = makeProduct();
      mockProductsService.findOne.mockResolvedValue(product);

      const result = await controller.findOne(product.slug);

      expect(mockProductsService.findOne).toHaveBeenCalledWith({ slug: product.slug });
      expect(result).toBeInstanceOf(ProductResponseDto);
    });

    it('should propagate NotFoundException from service', async () => {
      mockProductsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should upload image and create product', async () => {
      const category = makeCategory();
      const product = makeProduct();
      const imageUrl = faker.internet.url();
      const file = makeFile();
      const dto = {
        name: product.name,
        price: Number(product.price),
        categoryId: category.id,
        quantityInStock: product.quantityInStock,
      };

      mockProductsService.findCategoryById.mockResolvedValue(category);
      mockImageUploadService.upload.mockResolvedValue(imageUrl);
      mockProductsService.create.mockResolvedValue(product);

      const result = await controller.create(dto, file);

      expect(mockProductsService.findCategoryById).toHaveBeenCalledWith(dto.categoryId);
      expect(mockImageUploadService.upload).toHaveBeenCalledWith(file.buffer, file.originalname);
      expect(mockProductsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: dto.name, image: imageUrl }),
        category,
      );
      expect(result).toBeInstanceOf(ProductResponseDto);
    });

    it('should throw NotFoundException when category not found', async () => {
      mockProductsService.findCategoryById.mockResolvedValue(null);

      await expect(
        controller.create({ categoryId: faker.string.uuid() } as CreateProductDto, makeFile()),
      ).rejects.toThrow(NotFoundException);
      expect(mockProductsService.create).not.toHaveBeenCalled();
    });

    it('should propagate ConflictException from service', async () => {
      const category = makeCategory();
      mockProductsService.findCategoryById.mockResolvedValue(category);
      mockImageUploadService.upload.mockResolvedValue(faker.internet.url());
      mockProductsService.create.mockRejectedValue(new ConflictException());

      await expect(
        controller.create({ name: 'Dup', price: 100, categoryId: category.id }, makeFile()),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update product without new image', async () => {
      const product = makeProduct();
      mockProductsService.update.mockResolvedValue(product);

      const result = await controller.update(product.id, { name: 'Updated' }, undefined);

      expect(mockImageUploadService.upload).not.toHaveBeenCalled();
      expect(mockProductsService.update).toHaveBeenCalledWith(
        product.id,
        expect.objectContaining({ image: undefined }),
        undefined,
      );
      expect(result).toBeInstanceOf(ProductResponseDto);
    });

    it('should upload new image when file is provided', async () => {
      const product = makeProduct();
      const imageUrl = faker.internet.url();
      const file = makeFile();

      mockImageUploadService.upload.mockResolvedValue(imageUrl);
      mockProductsService.update.mockResolvedValue(product);

      await controller.update(product.id, {}, file);

      expect(mockImageUploadService.upload).toHaveBeenCalledWith(file.buffer, file.originalname);
      expect(mockProductsService.update).toHaveBeenCalledWith(
        product.id,
        expect.objectContaining({ image: imageUrl }),
        undefined,
      );
    });

    it('should resolve category when categoryId is provided', async () => {
      const category = makeCategory();
      const product = makeProduct({ category });

      mockProductsService.findCategoryById.mockResolvedValue(category);
      mockProductsService.update.mockResolvedValue(product);

      await controller.update(product.id, { categoryId: category.id }, undefined);

      expect(mockProductsService.findCategoryById).toHaveBeenCalledWith(category.id);
      expect(mockProductsService.update).toHaveBeenCalledWith(
        product.id,
        expect.anything(),
        category,
      );
    });

    it('should throw NotFoundException when category not found on update', async () => {
      mockProductsService.findCategoryById.mockResolvedValue(null);

      await expect(
        controller.update(faker.string.uuid(), { categoryId: faker.string.uuid() }, undefined),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException when product not found', async () => {
      mockProductsService.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update(faker.string.uuid(), {}, undefined)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should call service softDelete with given id', async () => {
      const id = faker.string.uuid();
      mockProductsService.softDelete.mockResolvedValue(undefined);

      await controller.softDelete(id);

      expect(mockProductsService.softDelete).toHaveBeenCalledWith(id);
    });

    it('should propagate NotFoundException when product not found', async () => {
      mockProductsService.softDelete.mockRejectedValue(new NotFoundException());

      await expect(controller.softDelete(faker.string.uuid())).rejects.toThrow(NotFoundException);
    });
  });
});
