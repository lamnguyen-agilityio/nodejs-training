export interface CreateProductDto {
  name: string;
  description?: string;
  price: number;
  image?: string;
  quantityInStock?: number;
  categoryId: string;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  image?: string;
  quantityInStock?: number;
  categoryId?: string;
}

export interface FindProductsDto {
  search?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  includeHidden?: boolean;
}
