import { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/common/constants';
import { OrderStatus, PaymentStatus } from '@/common/enums';
import type { AppConfig } from '@/config';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import type { OrderWithItems } from '@/modules/orders/interfaces';
import { OrdersRepository } from '@/modules/orders/orders.repository';
import { ProductEntity } from '@/modules/products/entities/product.entity';

import type { Payment } from './entities/payment.entity';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly paymentProvider: PaymentProviderService,
  ) {
    this.logger.setContext(PaymentsService.name);
  }

  /**
   * validates order ownership and status, handles duplicate sessions,
   * checks remaining stock before creating a Stripe session.
   */
  async createCheckout(
    authUser: AuthenticatedUser,
    orderId: string,
  ): Promise<{ checkoutUrl: string }> {
    const order = await this.findOrderForUser(authUser.userId, orderId);

    // duplicate check — reuse existing pending session
    const existing = await this.paymentsRepository.findByOrder(order.entity);
    if (existing) {
      if (existing.status === PaymentStatus.Pending) {
        this.logger.info({ orderId }, 'Reusing existing pending payment session');
        const session = await this.paymentProvider.retrieveSession(existing.checkoutSessionId);

        return { checkoutUrl: session.checkoutUrl };
      }

      throw new ConflictException(`Order already has a payment with status: ${existing.status}`);
    }

    // stock validation before charging Stripe
    for (const item of order.orderItems) {
      if (item.product.quantityInStock < item.quantity) {
        throw new BadRequestException(`${item.product.name}: ${MESSAGES.INSUFFICIENT_STOCK}`);
      }
    }

    const config = this.configService.getOrThrow<AppConfig>('app');
    const urls = {
      successUrl: `${config.appUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${config.appUrl}/payments/cancel?session_id={CHECKOUT_SESSION_ID}`,
    };

    const session = await this.paymentProvider.createCheckoutSession(order, urls);

    await this.paymentsRepository.create({
      order: order.entity,
      provider: this.paymentProvider.providerName,
      // intentId is null at session creation — Stripe only assigns a Payment Intent
      // after the user submits card details. Updated on webhook completed event.
      intentId: null,
      checkoutSessionId: session.sessionId,
      amount: (session.amount / 100).toFixed(2),
      currency: session.currency,
    });

    return { checkoutUrl: session.checkoutUrl };
  }

  /**
   * handle cancel redirect from Stripe.
   * rollback order status and restore stock.
   */
  async handleCancel(sessionId: string): Promise<void> {
    const payment = await this.paymentsRepository.findBySessionId(sessionId);
    if (!payment) {
      this.logger.warn({ sessionId }, 'Payment not found for cancel session');
      return;
    }

    if (this.isFinalStatus(payment.status)) {
      this.logger.info(
        { sessionId, status: payment.status },
        'Payment already in final status — skipping cancel',
      );
      return;
    }

    await this.rollbackStock(payment.order as unknown as OrderWithItems);

    await this.em.transactional(async (txEm) => {
      txEm.assign(payment, { status: PaymentStatus.Cancelled });
      txEm.assign(payment.order, { status: OrderStatus.Cancelled });
      await txEm.flush();
    });

    this.logger.info({ sessionId }, 'Payment cancelled and stock rolled back');
  }

  /**
   * get payment status for an order.
   */
  async getPaymentStatus(authUser: AuthenticatedUser, orderId: string): Promise<Payment> {
    const order = await this.findOrderForUser(authUser.userId, orderId);
    const payment = await this.paymentsRepository.findByOrder(order.entity);

    if (!payment) {
      throw new NotFoundException(`No payment found for order ${orderId}`);
    }

    return payment;
  }

  /**
   * shared rollback helper — restores stock for all order items.
   * used by cancel, failed, and expired handlers.
   */
  async rollbackStock(order: OrderWithItems): Promise<void> {
    this.logger.info({ orderId: order.id }, 'Rolling back stock for order');

    for (const item of order.orderItems) {
      await this.em.nativeUpdate(
        ProductEntity,
        { id: item.product.id },
        { quantityInStock: item.product.quantityInStock + item.quantity },
      );
    }
  }

  /**
   * finds an order for the authenticated user.
   */
  private async findOrderForUser(userId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findOne(orderId);

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.user.id !== userId) {
      throw new BadRequestException('Order does not belong to you');
    }

    if (order.status !== OrderStatus.Pending) {
      throw new BadRequestException(
        `Order status is '${order.status}' — only pending orders can be checked out`,
      );
    }

    return order;
  }

  /**
   * checks if a payment status is final (succeeded, failed, or cancelled).
   */
  isFinalStatus(status: PaymentStatus): boolean {
    return [PaymentStatus.Succeeded, PaymentStatus.Failed, PaymentStatus.Cancelled].includes(
      status,
    );
  }
}
