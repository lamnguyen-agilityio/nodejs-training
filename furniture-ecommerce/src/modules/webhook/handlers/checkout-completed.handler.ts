import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { OrderStatus, PaymentStatus } from '@/common/enums';
import { PaymentEntity } from '@/modules/payments/entities/payment.entity';
import type { WebhookEvent } from '@/modules/payments/interfaces';
import { PaymentsService } from '@/modules/payments/payments.service';

@Injectable()
export class CheckoutCompletedHandler {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
    private readonly paymentsService: PaymentsService,
  ) {
    this.logger.setContext(CheckoutCompletedHandler.name);
  }

  /**
   * checkout.session.completed
   * payment succeeded — update payment + order to paid.
   * stock was already deducted at createFromCart — no need to deduct again.
   */
  async handleCompleted(event: WebhookEvent): Promise<void> {
    this.logger.info({ sessionId: event.sessionId }, 'Handling checkout.session.completed');

    await this.em.transactional(async (txEm) => {
      const payment = await txEm.findOne(
        PaymentEntity,
        { checkoutSessionId: event.sessionId },
        { populate: ['order'] },
      );

      if (!payment) {
        this.logger.warn({ sessionId: event.sessionId }, 'Payment not found for completed session');
        return;
      }

      if (this.paymentsService.isFinalStatus(payment.status)) return;

      txEm.assign(payment, {
        status: PaymentStatus.Succeeded,
        // intentId now available after payment completes
        ...(event.intentId && { intentId: event.intentId }),
      });
      txEm.assign(payment.order, { status: OrderStatus.Paid });
      await txEm.flush();
    });

    this.logger.info({ sessionId: event.sessionId }, 'Order marked as paid');
  }
}
