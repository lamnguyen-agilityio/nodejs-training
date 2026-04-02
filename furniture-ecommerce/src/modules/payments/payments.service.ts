import { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES, NUMERIC } from '@/common/constants';
import { OrderStatus, PaymentStatus } from '@/common/enums';
import type { AppConfig } from '@/config';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import type { OrderWithItems } from '@/modules/orders/interfaces';
import { OrdersRepository } from '@/modules/orders/orders.repository';
import { ProductEntity } from '@/modules/products/entities/product.entity';

import { type Payment } from './entities/payment.entity';
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
   * creates a Stripe checkout session for a pending order.
   *
   * stock deduction happens here (not at order creation) using an atomic
   * conditional UPDATE — if stock runs out between two concurrent checkouts,
   * the second caller receives a 409 before Stripe is ever called.
   *
   * rollback is handled by webhook handlers on session expiry or payment failure.
   */
  async createCheckout(
    authUser: AuthenticatedUser,
    orderId: string,
  ): Promise<{ checkoutUrl: string }> {
    const order = await this.findOwnedOrder(authUser.userId, orderId);
    this.assertOrderIsPending(order);

    // atomic stock deduction — race condition safe
    await this.deductStockAtomic(order);

    // atomically claim or retrieve existing pending payment record
    const { payment, isNew } = await this.paymentsRepository.createOrClaimPending(
      order.entity,
      this.paymentProvider.providerName,
    );

    // reuse existing session if already claimed by a concurrent request
    if (!isNew && payment.checkoutSessionId) {
      this.logger.info({ orderId }, 'Reusing existing pending payment session');
      const session = await this.paymentProvider.retrieveSession(payment.checkoutSessionId);

      return { checkoutUrl: session.checkoutUrl };
    }

    // payment record exists but has a non-pending status
    if (!isNew && this.isFinalStatus(payment.status)) {
      throw new ConflictException(`Order already has a payment with status: ${payment.status}`);
    }

    const config = this.configService.getOrThrow<AppConfig>('app');
    const urls = {
      successUrl: `${config.frontendUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
      cancelUrl: `${config.frontendUrl}/payments/cancel?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
    };

    const session = await this.paymentProvider.createCheckoutSession(order, urls);

    await this.paymentsRepository.attachSession(payment, {
      checkoutSessionId: session.sessionId,
      intentId: null,
      amount: (session.amount / 100).toFixed(NUMERIC.DECIMAL_PLACES),
      currency: session.currency,
    });

    return { checkoutUrl: session.checkoutUrl };
  }

  /**
   * allows reading payment status for pending/paid/failed/cancelled orders.
   * checkoutUrl is returned for pending orders to allow the client to redirect to the checkout page.
   */
  async getPaymentStatus(
    authUser: AuthenticatedUser,
    orderId: string,
  ): Promise<{ payment: Payment; checkoutUrl: string }> {
    const order = await this.findOwnedOrder(authUser.userId, orderId);
    const payment = await this.paymentsRepository.findByOrder(order.entity);

    if (!payment) {
      throw new NotFoundException(`No payment found for order ${orderId}`);
    }

    const session = await this.paymentProvider.retrieveSession(payment.checkoutSessionId);

    return { payment, checkoutUrl: session.checkoutUrl };
  }

  /**
   * uses quantity_in_stock = quantity_in_stock + qty to avoid overwriting
   * concurrent changes. accepts txEm to share the caller's transaction.
   */
  async rollbackStockAtomic(txEm: EntityManager, order: OrderWithItems): Promise<void> {
    this.logger.info({ orderId: order.id }, 'Rolling back stock for order');

    for (const item of order.orderItems) {
      await txEm
        .getConnection()
        .execute(`UPDATE products SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?`, [
          item.quantity,
          item.product.id,
        ]);
    }
  }

  /**
   * returns true if the payment status is final (succeeded, failed, or cancelled).
   */
  isFinalStatus(status: PaymentStatus): boolean {
    return [PaymentStatus.Succeeded, PaymentStatus.Failed, PaymentStatus.Cancelled].includes(
      status,
    );
  }

  /**
   * used by both createCheckout and getPaymentStatus.
   */
  private async findOwnedOrder(userId: string, orderId: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findOne(orderId);

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.user.id !== userId) {
      throw new BadRequestException('Order does not belong to you');
    }

    return order;
  }

  /**
   * pending assertion extracted — only called from createCheckout.
   */
  private assertOrderIsPending(order: OrderWithItems): void {
    if (order.status !== OrderStatus.Pending) {
      throw new BadRequestException(
        `Order status is '${order.status}' — only pending orders can be checked out`,
      );
    }
  }

  /**
   * atomic stock deduction at checkout time.
   * uses conditional nativeUpdate (WHERE quantity_in_stock >= requested)
   * to prevent overselling when two users checkout the same product.
   * throws 409 ConflictException if any product is out of stock.
   */
  private async deductStockAtomic(order: OrderWithItems): Promise<void> {
    for (const item of order.orderItems) {
      const affected = await this.em.nativeUpdate(
        ProductEntity,
        {
          id: item.product.id,
          quantityInStock: { $gte: item.quantity },
        },
        { quantityInStock: item.product.quantityInStock - item.quantity },
      );

      if (affected === 0) {
        this.logger.warn(
          { productId: item.product.id, required: item.quantity },
          'Stock insufficient at checkout',
        );

        throw new ConflictException(`${item.product.name}: ${MESSAGES.INSUFFICIENT_STOCK}`);
      }
    }
  }
}
