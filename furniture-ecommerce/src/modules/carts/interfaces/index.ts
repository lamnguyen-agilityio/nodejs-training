import type { Product } from '@/modules/products/entities/product.entity';

export interface AddCartItem {
  productId: string;
  quantity: number;
}

export interface UpdateCartItem {
  quantity: number;
}

export interface GuestCartItem {
  product: Product;
  quantity: number;
}
