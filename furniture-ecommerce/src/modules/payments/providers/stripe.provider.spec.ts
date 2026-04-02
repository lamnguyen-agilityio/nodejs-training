import { faker } from '@faker-js/faker';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import Stripe from 'stripe';

import { OrderStatus } from '@/common/enums';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import type { Order } from '@/modules/orders/entities/order.entity';
import type { OrderWithItems } from '@/modules/orders/interfaces';
import type { User } from '@/modules/users/entities/user.entity';
import { createMockLogger } from '@/test/mocks';

import { StripeProvider } from './stripe.provider';

// ─── mock Stripe SDK ──────────────────────────────────────────────────────────

const mockStripeCheckoutCreate = jest.fn();
const mockStripeCheckoutRetrieve = jest.fn();
const mockStripeWebhooksConstruct = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockStripeCheckoutCreate,
        retrieve: mockStripeCheckoutRetrieve,
      },
    },
    webhooks: {
      constructEvent: mockStripeWebhooksConstruct,
    },
  }));
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeApiKey = () => faker.string.alphanumeric(32);
const makeWebhookSecret = () => `whsec_${faker.string.alphanumeric(32)}`;
const makeSessionId = () => `cs_test_${faker.string.alphanumeric(24)}`;
const makeIntentId = () => `pi_${faker.string.alphanumeric(24)}`;

const makeUrls = () => ({
  successUrl: `https://example.com/payments/success?session_id={CHECKOUT_SESSION_ID}&order_id=${faker.string.uuid()}`,
  cancelUrl: `https://example.com/payments/cancel?session_id={CHECKOUT_SESSION_ID}&order_id=${faker.string.uuid()}`,
});

const makeOrderItem = (price = '99.99', quantity = 2) => ({
  id: faker.string.uuid(),
  quantity,
  priceAtPurchase: price,
  product: {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    quantityInStock: 10,
  } as OrderWithItems['orderItems'][number]['product'],
});

const makeOrder = (): OrderWithItems => ({
  entity: {} as Order,
  id: faker.string.uuid(),
  status: OrderStatus.Pending,
  totalAmount: '199.98',
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  user: { id: faker.string.uuid() } as User,
  orderItems: [makeOrderItem('99.99', 2) as OrderItem],
});

const makeStripeSession = (
  overrides: Partial<{
    id: string;
    url: string | null;
    payment_intent: string | null;
    amount_total: number | null;
    currency: string | null;
  }> = {},
) => ({
  id: makeSessionId(),
  url: `https://checkout.stripe.com/c/pay/${makeSessionId()}`,
  payment_intent: null,
  amount_total: 19998,
  currency: 'usd',
  ...overrides,
});

const makeStripeEvent = (type: string, data: Record<string, unknown>): Stripe.Event =>
  ({
    id: `evt_${faker.string.alphanumeric(24)}`,
    type: type as Stripe.Event['type'],
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: { object: data } as unknown as Stripe.Event['data'],
  }) as Stripe.Event;

// ─── mocks ───────────────────────────────────────────────────────────────────

const stripeKey = makeApiKey();
const webhookSecret = makeWebhookSecret();

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue({
    stripeSecretKey: stripeKey,
    stripeWebhookSecret: webhookSecret,
  }),
} satisfies Partial<jest.Mocked<ConfigService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('StripeProvider', () => {
  let provider: StripeProvider;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();

    provider = new StripeProvider(
      mockConfigService as unknown as ConfigService,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── createCheckoutSession ─────────────────────────────────────────────────

  describe('createCheckoutSession', () => {
    it('should return sessionId, checkoutUrl, amount and currency', async () => {
      const order = makeOrder();
      const session = makeStripeSession();
      mockStripeCheckoutCreate.mockResolvedValue(session);

      const result = await provider.createCheckoutSession(order, makeUrls());

      expect(result.sessionId).toBe(session.id);
      expect(result.checkoutUrl).toBe(session.url);
      expect(result.amount).toBe(19998);
      expect(result.currency).toBe('usd');
    });

    it('should set intentId to null when payment_intent is not yet set', async () => {
      const order = makeOrder();
      mockStripeCheckoutCreate.mockResolvedValue(makeStripeSession({ payment_intent: null }));

      const result = await provider.createCheckoutSession(order, makeUrls());

      expect(result.intentId).toBeNull();
    });

    it('should pass idempotency key derived from order id', async () => {
      const order = makeOrder();
      mockStripeCheckoutCreate.mockResolvedValue(makeStripeSession());

      await provider.createCheckoutSession(order, makeUrls());

      expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idempotencyKey: `checkout_session:${order.id}` }),
      );
    });

    it('should build line items from orderItems with correct unit_amount', async () => {
      const order = makeOrder();
      order.orderItems = [makeOrderItem('49.99', 3) as OrderItem];
      mockStripeCheckoutCreate.mockResolvedValue(makeStripeSession());

      await provider.createCheckoutSession(order, makeUrls());

      const callArg = mockStripeCheckoutCreate.mock.calls[0][0];
      expect(callArg.line_items[0]).toMatchObject({
        quantity: 3,
        price_data: expect.objectContaining({ unit_amount: 4999 }),
      });
    });

    it('should include order id in session metadata', async () => {
      const order = makeOrder();
      mockStripeCheckoutCreate.mockResolvedValue(makeStripeSession());

      await provider.createCheckoutSession(order, makeUrls());

      const callArg = mockStripeCheckoutCreate.mock.calls[0][0];
      expect(callArg.metadata).toEqual({ orderId: order.id });
    });

    it('should throw InternalServerErrorException when session has no URL', async () => {
      const order = makeOrder();
      mockStripeCheckoutCreate.mockResolvedValue(makeStripeSession({ url: null }));

      await expect(provider.createCheckoutSession(order, makeUrls())).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should use default currency usd', async () => {
      const order = makeOrder();
      mockStripeCheckoutCreate.mockResolvedValue(makeStripeSession({ currency: null }));

      const result = await provider.createCheckoutSession(order, makeUrls());

      expect(result.currency).toBe('usd');
    });
  });

  // ── retrieveSession ───────────────────────────────────────────────────────

  describe('retrieveSession', () => {
    it('should return session details', async () => {
      const sessionId = makeSessionId();
      const intentId = makeIntentId();
      const session = makeStripeSession({
        id: sessionId,
        payment_intent: intentId,
        amount_total: 9999,
        currency: 'usd',
      });
      mockStripeCheckoutRetrieve.mockResolvedValue(session);

      const result = await provider.retrieveSession(sessionId);

      expect(result.sessionId).toBe(sessionId);
      expect(result.intentId).toBe(intentId);
      expect(result.amount).toBe(9999);
      expect(result.currency).toBe('usd');
    });

    it('should return empty checkoutUrl when session url is null', async () => {
      mockStripeCheckoutRetrieve.mockResolvedValue(makeStripeSession({ url: null }));

      const result = await provider.retrieveSession(makeSessionId());

      expect(result.checkoutUrl).toBe('');
    });

    it('should return null intentId when payment_intent is null', async () => {
      mockStripeCheckoutRetrieve.mockResolvedValue(makeStripeSession({ payment_intent: null }));

      const result = await provider.retrieveSession(makeSessionId());

      expect(result.intentId).toBeNull();
    });
  });

  // ── verifyWebhookSignature ────────────────────────────────────────────────

  describe('verifyWebhookSignature', () => {
    it('should return event with type and sessionId for checkout.session.completed', () => {
      const sessionId = makeSessionId();
      const intentId = makeIntentId();
      const stripeEvent = makeStripeEvent('checkout.session.completed', {
        id: sessionId,
        payment_intent: intentId,
      });
      mockStripeWebhooksConstruct.mockReturnValue(stripeEvent);

      const result = provider.verifyWebhookSignature(Buffer.from('payload'), 'sig');

      expect(result.type).toBe('checkout.session.completed');
      expect(result.sessionId).toBe(sessionId);
      expect(result.intentId).toBe(intentId);
    });

    it('should extract sessionId from checkout_session field when id is not a session id', () => {
      const sessionId = makeSessionId();
      // no id field — forces fallback to checkout_session
      const stripeEvent = makeStripeEvent('payment_intent.payment_failed', {
        checkout_session: sessionId,
      });
      mockStripeWebhooksConstruct.mockReturnValue(stripeEvent);

      const result = provider.verifyWebhookSignature(Buffer.from('payload'), 'sig');

      expect(result.sessionId).toBe(sessionId);
    });

    it('should return undefined intentId when not present in event', () => {
      const sessionId = makeSessionId();
      const stripeEvent = makeStripeEvent('checkout.session.expired', {
        id: sessionId,
      });
      mockStripeWebhooksConstruct.mockReturnValue(stripeEvent);

      const result = provider.verifyWebhookSignature(Buffer.from('payload'), 'sig');

      expect(result.intentId).toBeUndefined();
    });

    it('should throw when signature verification fails', () => {
      mockStripeWebhooksConstruct.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      expect(() => provider.verifyWebhookSignature(Buffer.from('payload'), 'bad-sig')).toThrow(
        'No signatures found',
      );
    });

    it('should throw InternalServerErrorException when session ID cannot be extracted', () => {
      const stripeEvent = makeStripeEvent('unknown.event', {
        some_other_field: 'value',
      });
      mockStripeWebhooksConstruct.mockReturnValue(stripeEvent);

      expect(() => provider.verifyWebhookSignature(Buffer.from('payload'), 'sig')).toThrow(
        InternalServerErrorException,
      );
    });

    it('should log error when signature verification fails', () => {
      const err = new Error('Invalid signature');
      mockStripeWebhooksConstruct.mockImplementation(() => {
        throw err;
      });

      expect(() => provider.verifyWebhookSignature(Buffer.from('payload'), 'bad-sig')).toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err }),
        'Stripe webhook signature verification failed',
      );
    });
  });
});
