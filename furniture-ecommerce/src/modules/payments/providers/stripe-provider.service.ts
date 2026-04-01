import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import Stripe from 'stripe';

import type { AppConfig } from '@/config';
import type { OrderWithItems } from '@/modules/orders/interfaces';

import {
  type CheckoutSessionResult,
  type CheckoutSessionUrls,
  type WebhookEvent,
} from '../interfaces';
import { PaymentProviderService } from '../payment-provider.service';

@Injectable()
export class StripeProviderService extends PaymentProviderService {
  readonly providerName = 'stripe';

  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(StripeProviderService.name);

    const config = this.configService.getOrThrow<AppConfig>('app');
    this.stripe = new Stripe(config.stripeSecretKey);
    this.webhookSecret = config.stripeWebhookSecret;
  }

  async createCheckoutSession(
    order: OrderWithItems,
    urls: CheckoutSessionUrls,
  ): Promise<CheckoutSessionResult> {
    this.logger.info({ orderId: order.id }, 'Creating Stripe checkout session');

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.orderItems.map(
      (item) => ({
        quantity: item.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(Number(item.priceAtPurchase) * 100),
          product_data: {
            name: item.product.name,
          },
        },
      }),
    );

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      metadata: { orderId: order.id },
      // session expires in 30 minutes
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!session.url) {
      this.logger.error({ orderId: order.id }, 'Stripe session created without URL');
      throw new InternalServerErrorException('Failed to create checkout session');
    }

    this.logger.info(
      { orderId: order.id, sessionId: session.id, intentId: session.payment_intent },
      'Stripe checkout session created',
    );

    return {
      sessionId: session.id,
      intentId: session.payment_intent as string,
      checkoutUrl: session.url,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
    };
  }

  async retrieveSession(sessionId: string): Promise<CheckoutSessionResult> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    return {
      sessionId: session.id,
      intentId: session.payment_intent as string,
      checkoutUrl: session.url ?? '',
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
    };
  }

  verifyWebhookSignature(payload: Buffer, signature: string): WebhookEvent {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (err) {
      this.logger.error({ err }, 'Stripe webhook signature verification failed');
      throw err;
    }

    const sessionId = this.extractSessionId(event);
    const intentId = this.extractIntentId(event);

    return { type: event.type, sessionId, intentId };
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private extractSessionId(event: Stripe.Event): string {
    const data = event.data.object;

    return (data['id'] as string) ?? (data['checkout_session'] as string) ?? '';
  }

  private extractIntentId(event: Stripe.Event): string | undefined {
    const data = event.data.object;
    const intentId = data['payment_intent'];

    return typeof intentId === 'string' ? intentId : undefined;
  }
}
