import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PinoLogger } from 'nestjs-pino';

import { OrderStatus, PaymentStatus } from '@/common/enums';
import type { WebhookEvent } from '@/modules/payments/interfaces';
import { PaymentsService } from '@/modules/payments/payments.service';
import { createMockEm, createMockLogger } from '@/test/mocks';

import { CheckoutCompletedHandler } from './checkout-completed.handler';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeEvent = (overrides: Partial<WebhookEvent> = {}): WebhookEvent => ({
  type: 'checkout.session.completed',
  sessionId: `cs_test_${faker.string.alphanumeric(24)}`,
  intentId: `pi_${faker.string.alphanumeric(24)}`,
  ...overrides,
});

interface FakeOrder {
  id: string;
  status: OrderStatus;
}

interface FakePayment {
  id: string;
  status: PaymentStatus;
  checkoutSessionId: string;
  intentId?: string;
  order: FakeOrder;
}

const makePayment = (status = PaymentStatus.Pending): FakePayment => ({
  id: faker.string.uuid(),
  status,
  checkoutSessionId: `cs_test_${faker.string.alphanumeric(24)}`,
  order: { id: faker.string.uuid(), status: OrderStatus.Pending },
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockPaymentsService = {
  isFinalStatus: jest.fn(),
} satisfies Partial<jest.Mocked<PaymentsService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('CheckoutCompletedHandler', () => {
  let handler: CheckoutCompletedHandler;
  let mockEm: ReturnType<typeof createMockEm>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  const makeTxEm = (payment: FakePayment | null) => {
    const txEm = createMockEm();
    txEm.findOne.mockResolvedValue(payment);
    txEm.assign.mockImplementation(
      (entity: Record<string, unknown>, data: Record<string, unknown>) =>
        Object.assign(entity, data),
    );
    txEm.flush.mockResolvedValue(undefined);
    return txEm;
  };

  beforeEach(() => {
    mockEm = createMockEm();
    mockLogger = createMockLogger();
    jest.clearAllMocks();

    handler = new CheckoutCompletedHandler(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
      mockPaymentsService as unknown as PaymentsService,
    );
  });

  // ── handleCompleted — happy path ──────────────────────────────────────────

  describe('handleCompleted', () => {
    it('should mark payment as succeeded and order as paid', async () => {
      const event = makeEvent();
      const payment = makePayment(PaymentStatus.Pending);

      mockPaymentsService.isFinalStatus.mockReturnValue(false);
      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(payment)),
      );

      await handler.handleCompleted(event);

      expect(payment.status).toBe(PaymentStatus.Succeeded);
      expect(payment.order.status).toBe(OrderStatus.Paid);
    });

    it('should update intentId when provided in event', async () => {
      const event = makeEvent({ intentId: 'pi_test_123' });
      const payment = makePayment(PaymentStatus.Pending);

      mockPaymentsService.isFinalStatus.mockReturnValue(false);
      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(payment)),
      );

      await handler.handleCompleted(event);

      expect(payment.intentId).toBe('pi_test_123');
    });

    it('should not set intentId when not present in event', async () => {
      const event = makeEvent({ intentId: undefined });
      const payment = makePayment(PaymentStatus.Pending);

      mockPaymentsService.isFinalStatus.mockReturnValue(false);
      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(payment)),
      );

      await handler.handleCompleted(event);

      expect(payment.intentId).toBeUndefined();
    });

    it('should log info when order is marked as paid', async () => {
      const event = makeEvent();
      const payment = makePayment();

      mockPaymentsService.isFinalStatus.mockReturnValue(false);
      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(payment)),
      );

      await handler.handleCompleted(event);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: event.sessionId }),
        'Order marked as paid',
      );
    });
  });

  // ── idempotency ───────────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('should skip processing when payment is already in final status', async () => {
      const event = makeEvent();
      const payment = makePayment(PaymentStatus.Succeeded);

      mockPaymentsService.isFinalStatus.mockReturnValue(true);
      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(payment)),
      );

      await handler.handleCompleted(event);

      // status unchanged — still succeeded, not re-processed
      expect(payment.status).toBe(PaymentStatus.Succeeded);
      expect(payment.order.status).toBe(OrderStatus.Pending);
    });

    it('should log warn and return when payment not found', async () => {
      const event = makeEvent();

      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(null)),
      );

      await handler.handleCompleted(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: event.sessionId }),
        'Payment not found for completed session',
      );
    });
  });
});
