import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { Retryable } from '@/common/database';
import { PaymentStatus } from '@/common/enums';
import type { Order } from '@/modules/orders/entities/order.entity';

import { PaymentEntity, type Payment } from './entities/payment.entity';
import type { AttachSessionData } from './interfaces';

@Injectable()
export class PaymentsRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PaymentsRepository.name);
  }

  /**
   * finds a payment record by order.
   */
  async findByOrder(order: Order): Promise<Payment | null> {
    return this.em.findOne(PaymentEntity, { order });
  }

  /**
   * finds a payment record by checkout session ID.
   */
  async findBySessionId(sessionId: string): Promise<Payment | null> {
    return this.em.findOne(
      PaymentEntity,
      { checkoutSessionId: sessionId },
      { populate: ['order'] },
    );
  }

  /**
   * atomically claim or retrieve a pending payment record for an order.
   * inserts a new pending payment with no session details yet — if a pending
   * record already exists (unique constraint on order_id + pending status),
   * returns the existing one instead.
   *
   * this prevents two concurrent checkout requests from both calling the
   * external provider — the second caller sees the claimed record and reuses
   * the session created by the first.
   *
   * returns { payment, isNew } so the caller knows whether to call the provider.
   */
  @Retryable()
  async createOrClaimPending(
    order: Order,
    provider: string,
  ): Promise<{ payment: Payment; isNew: boolean }> {
    // check for any existing payment for this order first
    const existing = await this.findByOrder(order);
    if (existing) {
      return { payment: existing, isNew: false };
    }

    // insert a placeholder pending record — session details filled in later
    // unique constraint on order_id ensures concurrent callers cannot both insert
    const payment = this.em.create(PaymentEntity, {
      order,
      provider,
      status: PaymentStatus.Pending,
      intentId: null,
      checkoutSessionId: '', // placeholder — updated by attachSession
      amount: '0', // placeholder — updated by attachSession
      currency: '', // placeholder — updated by attachSession
    });
    this.em.persist(payment);
    await this.em.flush();

    return { payment, isNew: true };
  }

  /**
   * attach provider session details to a previously claimed pending payment.
   * called after createCheckoutSession succeeds.
   */
  @Retryable()
  async attachSession(payment: Payment, data: AttachSessionData): Promise<Payment> {
    this.em.assign(payment, data);
    await this.em.flush();

    return payment;
  }

  /**
   * updates the payment status.
   */
  @Retryable()
  async updateStatus(payment: Payment, status: PaymentStatus, intentId?: string): Promise<Payment> {
    this.em.assign(payment, {
      status,
      ...(intentId !== undefined && { intentId }),
    });
    await this.em.flush();

    return payment;
  }
}
