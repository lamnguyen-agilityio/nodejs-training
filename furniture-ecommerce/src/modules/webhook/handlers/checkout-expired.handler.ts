import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { OrderStatus, PaymentStatus } from '@/common/enums';
import { OrdersRepository } from '@/modules/orders/orders.repository';
import { PaymentEntity } from '@/modules/payments/entities/payment.entity';
import type { WebhookEvent } from '@/modules/payments/interfaces';
import { PaymentsRepository } from '@/modules/payments/payments.repository';
import { PaymentsService } from '@/modules/payments/payments.service';

@Injectable()
export class CheckoutExpiredHandler {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
    private readonly paymentsService: PaymentsService,
    private readonly ordersRepository: OrdersRepository,
    private readonly paymentsRepository: PaymentsRepository,
  ) {
    this.logger.setContext(CheckoutExpiredHandler.name);
  }

  /**
   * checkout.session.expired
   * session timed out — rollback stock and cancel order.
   */
  async handleExpired(event: WebhookEvent): Promise<void> {
    this.logger.info({ sessionId: event.sessionId }, 'Handling checkout.session.expired');

    await this.rollbackAndUpdate(event, PaymentStatus.Cancelled, OrderStatus.Cancelled);

    this.logger.info({ sessionId: event.sessionId }, 'Session expired — order cancelled');
  }

  /**
   * rollback stock and update payment/order status.
   */
  private async rollbackAndUpdate(
    event: WebhookEvent,
    paymentStatus: PaymentStatus,
    orderStatus: OrderStatus,
  ): Promise<void> {
    await this.em.transactional(async (txEm) => {
      const payment = await txEm.findOne(
        PaymentEntity,
        { checkoutSessionId: event.sessionId },
        { populate: ['order'] },
      );

      if (!payment) {
        this.logger.warn({ sessionId: event.sessionId }, 'Payment not found for rollback');
        return;
      }

      if (this.paymentsService.isFinalStatus(payment.status)) return;

      const order = await this.ordersRepository.findOne(payment.order.id);
      if (!order) {
        this.logger.warn({ orderId: payment.order.id }, 'Order not found for rollback');
        return;
      }

      await this.paymentsRepository.rollbackStockAtomic(txEm, order);

      txEm.assign(payment, {
        status: paymentStatus,
        ...(event.intentId && { intentId: event.intentId }),
      });
      txEm.assign(payment.order, { status: orderStatus });
      await txEm.flush();
    });
  }
}
