import { BadRequestException, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { PaymentProviderService } from '@/modules/payments/payment-provider.service';
import { PaymentsRepository } from '@/modules/payments/payments.repository';
import { PaymentsService } from '@/modules/payments/payments.service';

import { CheckoutCompletedHandler, CheckoutExpiredHandler } from './handlers';

const HANDLED_EVENTS = ['checkout.session.completed', 'checkout.session.expired'] as const;

type HandledEventType = (typeof HANDLED_EVENTS)[number];

@Injectable()
export class WebhookService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly paymentProvider: PaymentProviderService,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly paymentsService: PaymentsService,
    private readonly checkoutCompletedHandler: CheckoutCompletedHandler,
    private readonly checkoutExpiredHandler: CheckoutExpiredHandler,
  ) {
    this.logger.setContext(WebhookService.name);
  }

  /**
   * verify signature and route to the correct handler.
   * returns quickly — Stripe expects 200 within 30s or it retries.
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    //verify Stripe signature — throws if invalid
    let event;
    try {
      event = this.paymentProvider.verifyWebhookSignature(payload, signature);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.info({ type: event.type, sessionId: event.sessionId }, 'Webhook received');

    if (!HANDLED_EVENTS.includes(event.type as HandledEventType)) {
      this.logger.info({ type: event.type }, 'Unhandled event type — skipping');
      return;
    }

    // idempotency — skip if payment already in final status
    if (event.sessionId) {
      const payment = await this.paymentsRepository.findBySessionId(event.sessionId);
      if (payment && this.paymentsService.isFinalStatus(payment.status)) {
        this.logger.info(
          { sessionId: event.sessionId, status: payment.status },
          'Payment already final — skipping duplicate webhook',
        );
        return;
      }
    }

    // route to handler
    switch (event.type as HandledEventType) {
      case 'checkout.session.completed':
        await this.checkoutCompletedHandler.handleCompleted(event);
        break;
      case 'checkout.session.expired':
        await this.checkoutExpiredHandler.handleExpired(event);
        break;
    }
  }
}
