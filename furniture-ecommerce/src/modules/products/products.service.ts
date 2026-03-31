import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { MESSAGES } from '@/common/constants';
import { toSlug } from '@/common/utils';
import { CategoriesService } from '@/modules/categories/categories.service';
import type { Category } from '@/modules/categories/entities/category.entity';

import type { Product } from './entities/product.entity';
import type {
  CreateProductDto,
  FindProductsDto,
  UpdateProductDto,
  PaginatedProducts,
  UpdateProductData,
} from './interfaces';
import { ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * finds all products based on the provided criteria.
   */
  async findAll(dto: FindProductsDto): Promise<PaginatedProducts> {
    return this.productsRepository.findAll(dto);
  }

  /**
   * finds a product by its id or slug.
   */
  async findOne(where: Partial<Pick<Product, 'id' | 'slug'>>): Promise<Product> {
    const product = await this.productsRepository.findOne(where);
    if (!product) {
      throw new NotFoundException(`Product ${where.id ?? where.slug} not found`);
    }

    return product;
  }

  /**
   * finds a category by its id.
   */
  async findCategoryById(categoryId: string): Promise<Category | undefined> {
    return await this.categoriesService.findOne({ id: categoryId });
  }

  /**
   * creates a new product.
   */
  async create(dto: Omit<CreateProductDto, 'categoryId'>, category: Category): Promise<Product> {
    const slug = toSlug(dto.name);
    const exists = await this.productsRepository.existsBySlug(slug);
    if (exists) throw new ConflictException(MESSAGES.PRODUCT_SLUG_CONFLICT);

    const { price, ...rest } = dto;

    return this.productsRepository.create({
      ...rest,
      slug,
      category,
      price: String(price),
    });
  }

  /**
   * updates an existing product.
   */
  async update(id: string, dto: UpdateProductDto, category: Category): Promise<Product> {
    const product = await this.findOne({ id });

    if (dto.name) {
      const slug = toSlug(dto.name);
      const exists = await this.productsRepository.existsBySlug(slug, id);
      if (exists) throw new ConflictException(MESSAGES.PRODUCT_SLUG_CONFLICT);
    }

    const changes: UpdateProductData = {};

    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.description !== undefined) changes.description = dto.description;
    if (dto.quantityInStock !== undefined) changes.quantityInStock = dto.quantityInStock;
    if (dto.name !== undefined) changes.slug = toSlug(dto.name);
    if (dto.price !== undefined) changes.price = String(dto.price);
    if (dto.image !== undefined) changes.image = dto.image;
    if (category !== undefined) changes.category = category;

    return this.productsRepository.update(product, changes);
  }

  /**
   * soft deletes a product by its id.
   */
  async softDelete(id: string): Promise<void> {
    const product = await this.findOne({ id });
    await this.productsRepository.softDelete(product);
  }
}
