import { defineEntity, p } from '@mikro-orm/core';

import { PRICE_DECIMAL } from '@/common/constants';
import { PaymentStatus } from '@/common/enums';
import { OrderEntity } from '@/modules/orders/entities/order.entity';

const { Pending, Succeeded, Failed, Cancelled, Refunded } = PaymentStatus;
const { PRECISION, SCALE } = PRICE_DECIMAL;

export const PaymentEntity = defineEntity({
  name: 'Payment',
  tableName: 'payments',
  properties: {
    // unique identifier for the payment.
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    /**
     * the order this payment belongs to.
     * the FK column in the database is `order_id`.
     */
    order: p.manyToOne(OrderEntity).fieldName('order_id'),

    // the payment provider (e.g. Stripe, PayPal).
    provider: p.string(),

    // the payment intent ID from the provider.
    intentId: p.string().nullable(),

    // the checkout session ID from the provider.
    checkoutSessionId: p.string(),

    // the status of the payment.
    status: p.enum([Pending, Succeeded, Failed, Cancelled, Refunded]).default(Pending),

    // the total amount of the payment.
    amount: p.decimal().precision(PRECISION).scale(SCALE),

    // the currency of the payment.
    currency: p.string(),

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

export type Payment = (typeof PaymentEntity)['~entity'];
