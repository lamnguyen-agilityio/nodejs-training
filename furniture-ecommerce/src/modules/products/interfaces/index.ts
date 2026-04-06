import { ProductSortField, SortOrder } from '@/common/enums';
import type { Category } from '@/modules/categories/entities/category.entity';

import type { Product } from '../entities/product.entity';

// ── shared field shapes ───────────────────────────────────────────────────────

interface ProductFields {
  name: string;
  description?: string;
  image?: string;
  quantityInStock?: number;
}

interface ProductDataFields {
  name: string;
  slug: string;
  description?: string;
  price: string;
  image?: string;
  quantityInStock?: number;
}

// ── query / pagination ────────────────────────────────────────────────────────

export interface FindProductsDto {
  search?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  includeHidden?: boolean;
  sortBy?: ProductSortField;
  sortOrder?: SortOrder;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

// ── create ────────────────────────────────────────────────────────────────────

export interface CreateProductDto extends ProductFields {
  price: number;
  categoryId: string;
}

export interface CreateProductData extends ProductDataFields {
  category: Category;
}

// ── update ────────────────────────────────────────────────────────────────────

export interface UpdateProductDto extends Partial<ProductFields> {
  price?: number;
  categoryId?: string;
}

export interface UpdateProductData extends Partial<ProductDataFields> {
  category?: Category;
}
