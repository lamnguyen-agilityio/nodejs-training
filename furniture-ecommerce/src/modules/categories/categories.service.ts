import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { MESSAGES } from '@/common/constants';
import { toSlug } from '@/common/utils';
import { ImageUploadService } from '@/modules/upload/image-upload.service';

import { CategoriesRepository } from './categories.repository';
import type { CreateCategoryDto, UpdateCategoryDto } from './dtos';
import type { Category } from './entities/category.entity';
import type { UpdateCategory } from './interfaces';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  /**
   * finds all categories that are not soft-deleted.
   */
  async findAll(): Promise<Category[]> {
    return this.categoriesRepository.findAll();
  }

  /**
   * finds a category by its ID or slug, excluding soft-deleted categories.
   */
  async findOne(where: Partial<Pick<Category, 'id' | 'slug'>>): Promise<Category> {
    const category = await this.categoriesRepository.findOne(where);
    if (!category) {
      throw new NotFoundException(`Category ${where.id ?? where.slug} not found`);
    }

    return category;
  }

  /**
   * creates a new category with the given data.
   */
  async create(dto: CreateCategoryDto, file: Express.Multer.File): Promise<Category> {
    const slug = toSlug(dto.name);

    const exists = await this.categoriesRepository.existsBySlug(slug);
    if (exists) throw new ConflictException(MESSAGES.CATEGORY_SLUG_CONFLICT);

    const image = await this.imageUploadService.upload(file.buffer, file.originalname);

    return this.categoriesRepository.create({ ...dto, slug, image });
  }

  /**
   * updates an existing category with the given data.
   */
  async update(id: string, dto: UpdateCategoryDto, file?: Express.Multer.File): Promise<Category> {
    const category = await this.findOne({ id });
    const changes: UpdateCategory & { slug?: string } = {};

    if (dto.name) {
      changes.slug = toSlug(dto.name);
      changes.name = dto.name;
    }

    // check if the slug already exists (excluding the current category)
    if (changes.slug) {
      const exists = await this.categoriesRepository.existsBySlug(changes.slug, id);
      if (exists) throw new ConflictException(MESSAGES.CATEGORY_SLUG_CONFLICT);
    }

    if (file) changes.image = await this.imageUploadService.upload(file.buffer, file.originalname);
    if (dto.description) changes.description = dto.description;

    return this.categoriesRepository.update(category, changes);
  }

  /**
   * soft deletes a category by its ID.
   */
  async softDelete(id: string): Promise<void> {
    const category = await this.findOne({ id });
    await this.categoriesRepository.softDelete(category);
  }
}
