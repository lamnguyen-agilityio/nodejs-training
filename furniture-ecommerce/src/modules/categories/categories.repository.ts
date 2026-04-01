import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { Retryable } from '@/common/database';

import { CategoryEntity, type Category } from './entities/category.entity';
import type { CreateCategory, UpdateCategory } from './interfaces';

@Injectable()
export class CategoriesRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CategoriesRepository.name);
  }

  /**
   * finds all categories that are not soft-deleted.
   */
  async findAll(): Promise<Category[]> {
    return this.em.find(CategoryEntity, { deletedAt: null });
  }

  /**
   * finds a category by its ID or slug, excluding soft-deleted categories.
   */
  async findOne(where: Partial<Pick<Category, 'id' | 'slug'>>): Promise<Category | null> {
    return this.em.findOne(CategoryEntity, { ...where, deletedAt: null });
  }

  /**
   * checks if a category with the given slug exists, excluding a specific category by ID.
   */
  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.em.findOne(CategoryEntity, { slug, deletedAt: null });
    if (!existing) return false;
    if (excludeId && existing.id === excludeId) return false;

    return true;
  }

  /**
   * creates a new category with the given data.
   */
  @Retryable()
  async create(data: CreateCategory & { slug: string }): Promise<Category> {
    // clear any pending changes from previous failed attempts
    this.em.clear();

    const category = this.em.create(CategoryEntity, data);
    this.em.persist(category);
    await this.em.flush();

    return category;
  }

  /**
   * updates an existing category with the given data.
   */
  @Retryable()
  async update(category: Category, data: UpdateCategory & { slug?: string }): Promise<Category> {
    this.em.assign(category, data);
    await this.em.flush();

    return category;
  }

  /**
   * soft deletes a category by marking it as deleted.
   */
  @Retryable()
  async softDelete(category: Category): Promise<void> {
    this.em.assign(category, { deletedAt: new Date() });
    await this.em.flush();
  }
}
