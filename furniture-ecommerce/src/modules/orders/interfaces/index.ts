import type { OrderStatus } from '@/common/enums';
import type { Product } from '@/modules/products/entities/product.entity';

import { type OrderItem } from '../entities/order-item.entity';
import { type Order } from '../entities/order.entity';

export interface OrderWithItemsAndUser extends OrderItem {
  userEmail: string;
}

/**
 * OrderWithItems wraps the tracked MikroORM entity + loaded items separately.
 * keeping a reference to the original entity ensures em.assign() works correctly.
 */
export interface OrderWithItems {
  id: string;
  entity: Order;
  orderItems: OrderWithItemsAndUser[];
  status: OrderStatus;
  totalAmount: string;
  createdAt: Date;
  updatedAt: Date;
  user: Order['user'];
}

export interface FindOrdersDto {
  page?: number;
  limit?: number;
}

export interface FindAllOrdersAdminDto extends FindOrdersDto {
  status?: OrderStatus;
}

export interface OrderItemData {
  product: Product;
  quantity: number;
  priceAtPurchase: string;
}

export interface PaginatedOrders {
  items: OrderWithItems[];
  total: number;
  page: number;
  limit: number;
}
