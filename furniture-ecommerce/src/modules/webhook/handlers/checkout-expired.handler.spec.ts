import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PinoLogger } from 'nestjs-pino';

import { OrderStatus, PaymentStatus } from '@/common/enums';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import type { Order } from '@/modules/orders/entities/order.entity';
import type { OrderWithItems } from '@/modules/orders/interfaces';
import { OrdersRepository } from '@/modules/orders/orders.repository';
import type { WebhookEvent } from '@/modules/payments/interfaces';
import { PaymentsService } from '@/modules/payments/payments.service';
import type { User } from '@/modules/users/entities/user.entity';
import { createMockEm, createMockLogger } from '@/test/mocks';

import { CheckoutExpiredHandler } from './checkout-expired.handler';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeEvent = (overrides: Partial<WebhookEvent> = {}): WebhookEvent => ({
  type: 'checkout.session.expired',
  sessionId: `cs_test_${faker.string.alphanumeric(24)}`,
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

const makeOrder = (): OrderWithItems => ({
  entity: {} as Order,
  id: faker.string.uuid(),
  status: OrderStatus.Pending,
  totalAmount: '99.99',
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  user: { id: faker.string.uuid() } as User,
  orderItems: [
    {
      id: faker.string.uuid(),
      quantity: 2,
      priceAtPurchase: '49.99',
      product: {
        id: faker.string.uuid(),
        name: 'Test Product',
        quantityInStock: 8,
      } as OrderWithItems['orderItems'][number]['product'],
    } as OrderItem,
  ],
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockPaymentsService = {
  isFinalStatus: jest.fn(),
  rollbackStockAtomic: jest.fn(),
} satisfies Partial<jest.Mocked<PaymentsService>>;

const mockOrdersRepository = {
  findOne: jest.fn(),
} satisfies Partial<jest.Mocked<OrdersRepository>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('CheckoutExpiredHandler', () => {
  let handler: CheckoutExpiredHandler;
  let mockEm: ReturnType<typeof createMockEm>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  type TxEm = ReturnType<typeof createMockEm>;

  const makeTxEm = (payment: FakePayment | null): TxEm => {
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

    handler = new CheckoutExpiredHandler(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
      mockPaymentsService as unknown as PaymentsService,
      mockOrdersRepository as unknown as OrdersRepository,
    );
  });

  // ── handleExpired — happy path ────────────────────────────────────────────

  describe('handleExpired', () => {
    it('should rollback stock and set payment + order to cancelled', async () => {
      const event = makeEvent();
      const payment = makePayment(PaymentStatus.Pending);
      const order = makeOrder();

      mockPaymentsService.isFinalStatus.mockReturnValue(false);
      mockPaymentsService.rollbackStockAtomic.mockResolvedValue(undefined);
      mockOrdersRepository.findOne.mockResolvedValue(order);

      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(payment)),
      );

      await handler.handleExpired(event);

      expect(mockPaymentsService.rollbackStockAtomic).toHaveBeenCalled();
      expect(payment.status).toBe(PaymentStatus.Cancelled);
      expect(payment.order.status).toBe(OrderStatus.Cancelled);
    });

    it('should call rollbackStockAtomic with the transactional em and order', async () => {
      const event = makeEvent();
      const payment = makePayment(PaymentStatus.Pending);
      const order = makeOrder();
      let capturedTxEm: TxEm | undefined;

      mockPaymentsService.isFinalStatus.mockReturnValue(false);
      mockPaymentsService.rollbackStockAtomic.mockResolvedValue(undefined);
      mockOrdersRepository.findOne.mockResolvedValue(order);

      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) => {
        const txEm = makeTxEm(payment);
        capturedTxEm = txEm;
        return cb(txEm);
      });

      await handler.handleExpired(event);

      expect(mockPaymentsService.rollbackStockAtomic).toHaveBeenCalledWith(capturedTxEm, order);
    });

    it('should log info on successful expiry handling', async () => {
      const event = makeEvent();
      const payment = makePayment();
      const order = makeOrder();

      mockPaymentsService.isFinalStatus.mockReturnValue(false);
      mockPaymentsService.rollbackStockAtomic.mockResolvedValue(undefined);
      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(payment)),
      );

      await handler.handleExpired(event);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: event.sessionId }),
        'Session expired — order cancelled',
      );
    });
  });

  // ── idempotency ───────────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('should skip rollback when payment is already in final status', async () => {
      const event = makeEvent();
      const payment = makePayment(PaymentStatus.Cancelled);

      mockPaymentsService.isFinalStatus.mockReturnValue(true);
      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(payment)),
      );

      await handler.handleExpired(event);

      expect(mockPaymentsService.rollbackStockAtomic).not.toHaveBeenCalled();
      expect(mockOrdersRepository.findOne).not.toHaveBeenCalled();
    });

    it('should log warn and skip when payment not found', async () => {
      const event = makeEvent();

      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(null)),
      );

      await handler.handleExpired(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: event.sessionId }),
        'Payment not found for rollback',
      );
      expect(mockPaymentsService.rollbackStockAtomic).not.toHaveBeenCalled();
    });

    it('should log warn and skip rollback when order not found', async () => {
      const event = makeEvent();
      const payment = makePayment(PaymentStatus.Pending);

      mockPaymentsService.isFinalStatus.mockReturnValue(false);
      mockOrdersRepository.findOne.mockResolvedValue(null);
      mockEm.transactional.mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
        cb(makeTxEm(payment)),
      );

      await handler.handleExpired(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: payment.order.id }),
        'Order not found for rollback',
      );
      expect(mockPaymentsService.rollbackStockAtomic).not.toHaveBeenCalled();
    });
  });
});
