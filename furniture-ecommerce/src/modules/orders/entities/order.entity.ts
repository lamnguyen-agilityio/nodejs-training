import { defineEntity, p } from '@mikro-orm/core';

import { PRICE_DECIMAL } from '@/common/constants';
import { OrderStatus } from '@/common/enums';
import { UserEntity } from '@/modules/users/entities/user.entity';

const { Pending, Paid, Shipped, Delivered, Cancelled, Failed } = OrderStatus;
const { PRECISION, SCALE } = PRICE_DECIMAL;

export const OrderEntity = defineEntity({
  name: 'Order',
  tableName: 'orders',
  properties: {
    // unique identifier for the order.
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    /**
     * the user this order belongs to.
     * the FK column in the database is `user_id`.
     */
    user: p.manyToOne(UserEntity).fieldName('user_id'),

    // the status of the order.
    status: p.enum([Pending, Paid, Shipped, Delivered, Cancelled, Failed]).default(Pending),

    // the total amount of the order.
    totalAmount: p.decimal().precision(PRECISION).scale(SCALE),

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
  },
});

export type Order = (typeof OrderEntity)['~entity'];
