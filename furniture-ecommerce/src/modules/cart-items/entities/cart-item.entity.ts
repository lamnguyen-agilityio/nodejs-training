import { defineEntity, p } from '@mikro-orm/core';

import { ProductEntity } from '@/modules/products/entities/product.entity';
import { UserEntity } from '@/modules/users/entities/user.entity';

export const CartItemEntity = defineEntity({
  name: 'CartItem',
  tableName: 'cart_items',
  properties: {
    // unique identifier for the cart item.
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    // the quantity of this cart item
    quantity: p.integer(),

    /**
     * the user this cart item belongs to.
     * the FK column in the database is `user_id`.
     */
    user: p.manyToOne(UserEntity).fieldName('user_id'),

    /**
     * the product this cart item belongs to.
     * the FK column in the database is `product_id`.
     */
    product: p.manyToOne(ProductEntity).fieldName('product_id'),

    // creation timestamp.
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),

    // last update timestamp.
    updatedAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),

    // soft-delete timestamp. NULL = active, non-NULL = deleted.
    deletedAt: p.datetime().nullable(),
  },
});

export type CartItem = (typeof CartItemEntity)['~entity'];
