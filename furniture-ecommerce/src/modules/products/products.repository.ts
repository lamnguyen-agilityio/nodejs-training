import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { Retryable } from '@/common/database';
import { resolvePagination } from '@/common/utils';

import { ProductEntity, type Product } from './entities/product.entity';
import type {
  FindProductsDto,
  PaginatedProducts,
  CreateProductData,
  UpdateProductData,
} from './interfaces';

@Injectable()
export class ProductsRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProductsRepository.name);
  }

  /**
   * finds all products based on the provided criteria.
   * paginates the results.
   */
  async findAll(dto: FindProductsDto): Promise<PaginatedProducts> {
    const { page, limit, offset } = resolvePagination(dto);

    const where: Record<string, unknown> = { deletedAt: null };

    if (!dto.includeHidden) {
      where['quantityInStock'] = { $gt: 0 };
    }

    if (dto.categorySlug) {
      where['category'] = { slug: dto.categorySlug, deletedAt: null };
    }

    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (dto.minPrice !== undefined) priceFilter['$gte'] = dto.minPrice;
      if (dto.maxPrice !== undefined) priceFilter['$lte'] = dto.maxPrice;
      where['price'] = priceFilter;
    }

    if (dto.search) {
      where['name'] = { $ilike: `%${dto.search}%` };
    }

    const [items, total] = await this.em.findAndCount(ProductEntity, where, {
      populate: ['category'],
      limit,
      offset,
      orderBy: { createdAt: 'DESC' },
    });

    return { items, total, page, limit };
  }

  /**
   * finds a single product by its id or slug.
   */
  async findOne(where: Partial<Pick<Product, 'id' | 'slug'>>): Promise<Product | null> {
    return this.em.findOne(
      ProductEntity,
      { ...where, deletedAt: null },
      {
        populate: ['category'],
      },
    );
  }

  /**
   * checks if a product with the given slug exists, optionally excluding a specific product id.
   */
  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.em.findOne(ProductEntity, { slug, deletedAt: null });
    if (!existing) return false;
    if (excludeId && existing.id === excludeId) return false;

    return true;
  }

  /**
   * creates a new product.
   */
  @Retryable()
  async create(data: CreateProductData): Promise<Product> {
    const product = this.em.create(ProductEntity, data);
    this.em.persist(product);
    await this.em.flush();

    return product;
  }

  /**
   * updates an existing product.
   */
  @Retryable()
  async update(product: Product, data: UpdateProductData): Promise<Product> {
    this.em.assign(product, data);
    await this.em.flush();

    return product;
  }

  /**
   * soft deletes a product.
   */
  @Retryable()
  async softDelete(product: Product): Promise<void> {
    this.em.assign(product, { deletedAt: new Date() });
    await this.em.flush();
  }
}
