import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { Retryable } from '@/common/database';
import { PaymentStatus } from '@/common/enums';
import type { Order } from '@/modules/orders/entities/order.entity';

import { PaymentEntity, type Payment } from './entities/payment.entity';
import type { CreatePaymentData } from './interfaces';

@Injectable()
export class PaymentsRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PaymentsRepository.name);
  }

  /**
   * finds a payment by the order it is associated with.
   */
  async findByOrder(order: Order): Promise<Payment | null> {
    return this.em.findOne(PaymentEntity, { order });
  }

  /**
   * finds a payment by the session ID it is associated with.
   */
  async findBySessionId(sessionId: string): Promise<Payment | null> {
    return this.em.findOne(
      PaymentEntity,
      { checkoutSessionId: sessionId },
      { populate: ['order'] },
    );
  }

  /**
   * creates a new payment.
   */
  @Retryable()
  async create(data: CreatePaymentData): Promise<Payment> {
    // clear any pending changes from previous failed attempts
    this.em.clear();

    const payment = this.em.create(PaymentEntity, {
      ...data,
      status: PaymentStatus.Pending,
    });
    this.em.persist(payment);
    await this.em.flush();

    return payment;
  }

  /**
   * updates the status of a payment.
   */
  @Retryable()
  async updateStatus(payment: Payment, status: PaymentStatus, intentId?: string): Promise<Payment> {
    // only update intentId when provided — e.g. on webhook completed
    this.em.assign(payment, {
      status,
      ...(intentId !== undefined && { intentId }),
    });
    await this.em.flush();

    return payment;
  }
}
