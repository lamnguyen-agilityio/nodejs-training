import type { OrderWithItems } from '@/modules/orders/interfaces';

import type { CheckoutSessionResult, CheckoutSessionUrls, WebhookEvent } from './interfaces';

/**
 * abstract strategy for payment providers.
 *
 * to add a new provider (PayPal, etc.):
 *  1. create a class that extends PaymentProviderService.
 *  2. implement all abstract methods.
 *  3. swap the useClass binding in PaymentsModule.
 *
 * PaymentsService only depends on this abstract class — never on a concrete provider.
 */
export abstract class PaymentProviderService {
  abstract readonly providerName: string;

  /**
   * create a checkout session for the given order.
   * returns the session details including the URL to redirect the user to.
   */
  abstract createCheckoutSession(
    order: OrderWithItems,
    urls: CheckoutSessionUrls,
  ): Promise<CheckoutSessionResult>;

  /**
   * retrieve an existing checkout session by its id.
   * used to verify payment status on redirect.
   */
  abstract retrieveSession(sessionId: string): Promise<CheckoutSessionResult>;

  /**
   * verify the webhook signature and extract the event payload.
   * throws if the signature is invalid.
   */
  abstract verifyWebhookSignature(payload: Buffer, signature: string): WebhookEvent;
}
