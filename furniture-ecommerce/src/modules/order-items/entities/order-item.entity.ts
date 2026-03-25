import { defineEntity, p } from '@mikro-orm/core';

import { PRICE_DECIMAL } from '@/constants';
import { OrderEntity } from '@/modules/orders/entities/order.entity';
import { ProductEntity } from '@/modules/products/entities/product.entity';

const { PRECISION, SCALE } = PRICE_DECIMAL;

export const OrderItemEntity = defineEntity({
  name: 'OrderItem',
  tableName: 'order_items',
  properties: {
    // unique identifier for the order item.
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    /**
     * the order this order item belongs to.
     * the FK column in the database is `order_id`.
     */
    order: p.manyToOne(OrderEntity).fieldName('order_id'),

    /**
     * the product this order item belongs to.
     * the FK column in the database is `product_id`.
     */
    product: p.manyToOne(ProductEntity).fieldName('product_id'),

    // the quantity of the product in this order item.
    quantity: p.integer(),

    // the price of the product at the time of the order.
    priceAtPurchase: p.decimal().precision(PRECISION).scale(SCALE),

    // creation timestamp.
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
  },
});

export type OrderItem = (typeof OrderItemEntity)['~entity'];
