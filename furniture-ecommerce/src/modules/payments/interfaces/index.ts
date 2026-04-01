import type { Order } from '@/modules/orders/entities/order.entity';

/**
 * the result of creating a checkout session — returned by the provider service.
 */
export interface CheckoutSessionResult {
  sessionId: string;
  intentId: string | null;
  checkoutUrl: string;
  amount: number;
  currency: string;
}

/**
 * the event received from the provider's webhook — contains session and intent ids.
 */
export interface WebhookEvent {
  type: string;
  sessionId: string;
  intentId?: string;
}

/**
 * the URLs to redirect the user to after a successful or cancelled payment.
 */
export interface CheckoutSessionUrls {
  successUrl: string;
  cancelUrl: string;
}

/**
 * the data required to create a payment record.
 */
export interface CreatePaymentData {
  order: Order;
  provider: string;
  intentId: string | null;
  checkoutSessionId: string;
  amount: string;
  currency: string;
}
