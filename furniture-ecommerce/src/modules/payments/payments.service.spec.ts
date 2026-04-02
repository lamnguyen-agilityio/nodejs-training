import { faker } from '@faker-js/faker';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { OrderStatus, PaymentStatus } from '@/common/enums';
import { Role } from '@/common/enums';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import type { Order } from '@/modules/orders/entities/order.entity';
import type { OrderWithItems } from '@/modules/orders/interfaces';
import { OrdersRepository } from '@/modules/orders/orders.repository';
import type { User } from '@/modules/users/entities/user.entity';
import { createMockLogger } from '@/test/mocks';

import type { Payment } from './entities/payment.entity';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { OrderItem } from '../orders/entities/order-item.entity';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthUser = (userId = faker.string.uuid()): AuthenticatedUser => ({
  userId,
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
});

const makeOrder = (userId: string, status = OrderStatus.Pending): OrderWithItems => ({
  entity: {} as Order,
  id: faker.string.uuid(),
  status,
  totalAmount: '199.98',
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  user: { id: userId } as User,
  orderItems: [
    {
      id: faker.string.uuid(),
      quantity: 2,
      priceAtPurchase: '99.99',
      product: {
        id: faker.string.uuid(),
        name: 'Test Product',
        quantityInStock: 10,
      } as OrderWithItems['orderItems'][number]['product'],
    } as OrderItem,
  ],
});

const makePayment = (
  status = PaymentStatus.Pending,
  checkoutSessionId = `cs_test_${faker.string.alphanumeric(24)}`,
): Payment =>
  ({
    id: faker.string.uuid(),
    status,
    checkoutSessionId,
    intentId: null,
    amount: '199.98',
    currency: 'usd',
    provider: 'stripe',
  }) as Payment;

const makeCheckoutUrl = () =>
  `https://checkout.stripe.com/c/pay/cs_test_${faker.string.alphanumeric(24)}`;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue({ frontendUrl: 'https://example.com' }),
} satisfies Partial<jest.Mocked<ConfigService>>;

const mockPaymentsRepository = {
  findByOrder: jest.fn(),
  findBySessionId: jest.fn(),
  createOrClaimPending: jest.fn(),
  attachSession: jest.fn(),
  updateStatus: jest.fn(),
} satisfies Partial<jest.Mocked<PaymentsRepository>>;

const mockOrdersRepository = {
  findOne: jest.fn(),
} satisfies Partial<jest.Mocked<OrdersRepository>>;

const mockPaymentProvider = {
  providerName: 'stripe',
  createCheckoutSession: jest.fn(),
  retrieveSession: jest.fn(),
} satisfies Partial<jest.Mocked<PaymentProviderService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();

    service = new PaymentsService(
      mockConfigService as unknown as ConfigService,
      mockLogger as unknown as PinoLogger,
      mockPaymentsRepository as unknown as PaymentsRepository,
      mockOrdersRepository as unknown as OrdersRepository,
      mockPaymentProvider as unknown as PaymentProviderService,
    );
  });

  // ── createCheckout ─────────────────────────────────────────────────────────

  describe('createCheckout', () => {
    it('should create session and return checkoutUrl for new payment', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(authUser.userId);
      const payment = makePayment();
      const checkoutUrl = makeCheckoutUrl();

      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockPaymentsRepository.createOrClaimPending.mockResolvedValue({
        payment,
        isNew: true,
      });
      mockPaymentProvider.createCheckoutSession.mockResolvedValue({
        sessionId: payment.checkoutSessionId,
        intentId: null,
        checkoutUrl,
        amount: 19998,
        currency: 'usd',
      });
      mockPaymentsRepository.attachSession.mockResolvedValue(payment);

      const result = await service.createCheckout(authUser, order.id);

      expect(result.checkoutUrl).toBe(checkoutUrl);
      expect(mockPaymentProvider.createCheckoutSession).toHaveBeenCalled();
      expect(mockPaymentsRepository.attachSession).toHaveBeenCalled();
    });

    it('should reuse existing session when payment already pending', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(authUser.userId);
      const sessionId = `cs_test_${faker.string.alphanumeric(24)}`;
      const payment = makePayment(PaymentStatus.Pending, sessionId);
      const checkoutUrl = makeCheckoutUrl();

      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockPaymentsRepository.createOrClaimPending.mockResolvedValue({
        payment,
        isNew: false,
      });
      mockPaymentProvider.retrieveSession.mockResolvedValue({
        sessionId,
        intentId: null,
        checkoutUrl,
        amount: 19998,
        currency: 'usd',
      });

      const result = await service.createCheckout(authUser, order.id);

      expect(result.checkoutUrl).toBe(checkoutUrl);
      expect(mockPaymentProvider.createCheckoutSession).not.toHaveBeenCalled();
      expect(mockPaymentProvider.retrieveSession).toHaveBeenCalledWith(sessionId);
    });

    it('should throw ConflictException when payment exists with final status', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(authUser.userId);
      const payment = makePayment(PaymentStatus.Succeeded, '');

      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockPaymentsRepository.createOrClaimPending.mockResolvedValue({
        payment,
        isNew: false,
      });

      await expect(service.createCheckout(authUser, order.id)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockOrdersRepository.findOne.mockResolvedValue(null);

      await expect(service.createCheckout(makeAuthUser(), faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when order belongs to another user', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(faker.string.uuid()); // different user

      mockOrdersRepository.findOne.mockResolvedValue(order);

      await expect(service.createCheckout(authUser, order.id)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when order is not pending', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(authUser.userId, OrderStatus.Paid);

      mockOrdersRepository.findOne.mockResolvedValue(order);

      await expect(service.createCheckout(authUser, order.id)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when stock is insufficient', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(authUser.userId);
      order.orderItems[0].product.quantityInStock = 1;
      order.orderItems[0].quantity = 5;

      mockOrdersRepository.findOne.mockResolvedValue(order);

      await expect(service.createCheckout(authUser, order.id)).rejects.toThrow(BadRequestException);
    });

    it('should pass success and cancel urls with order_id appended', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(authUser.userId);
      const payment = makePayment();

      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockPaymentsRepository.createOrClaimPending.mockResolvedValue({
        payment,
        isNew: true,
      });
      mockPaymentProvider.createCheckoutSession.mockResolvedValue({
        sessionId: `cs_test_${faker.string.alphanumeric(24)}`,
        intentId: null,
        checkoutUrl: makeCheckoutUrl(),
        amount: 0,
        currency: 'usd',
      });
      mockPaymentsRepository.attachSession.mockResolvedValue(payment);

      await service.createCheckout(authUser, order.id);

      const callUrls = mockPaymentProvider.createCheckoutSession.mock.calls[0][1];
      expect(callUrls.successUrl).toContain(`order_id=${order.id}`);
      expect(callUrls.cancelUrl).toContain(`order_id=${order.id}`);
    });
  });

  // ── getPaymentStatus ───────────────────────────────────────────────────────

  describe('getPaymentStatus', () => {
    it('should return payment and checkoutUrl', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(authUser.userId, OrderStatus.Pending);
      const payment = makePayment();
      const checkoutUrl = makeCheckoutUrl();

      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockPaymentsRepository.findByOrder.mockResolvedValue(payment);
      mockPaymentProvider.retrieveSession.mockResolvedValue({
        sessionId: payment.checkoutSessionId,
        intentId: null,
        checkoutUrl,
        amount: 19998,
        currency: 'usd',
      });

      const result = await service.getPaymentStatus(authUser, order.id);

      expect(result.payment).toBe(payment);
      expect(result.checkoutUrl).toBe(checkoutUrl);
    });

    it('should throw NotFoundException when no payment found', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(authUser.userId, OrderStatus.Paid);

      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockPaymentsRepository.findByOrder.mockResolvedValue(null);

      await expect(service.getPaymentStatus(authUser, order.id)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order belongs to another user', async () => {
      const authUser = makeAuthUser();
      const order = makeOrder(faker.string.uuid(), OrderStatus.Paid);

      mockOrdersRepository.findOne.mockResolvedValue(order);

      await expect(service.getPaymentStatus(authUser, order.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── isFinalStatus ──────────────────────────────────────────────────────────

  describe('isFinalStatus', () => {
    it.each([PaymentStatus.Succeeded, PaymentStatus.Failed, PaymentStatus.Cancelled])(
      'should return true for %s',
      (status) => {
        expect(service.isFinalStatus(status)).toBe(true);
      },
    );

    it('should return false for pending', () => {
      expect(service.isFinalStatus(PaymentStatus.Pending)).toBe(false);
    });
  });

  // ── rollbackStockAtomic ────────────────────────────────────────────────────

  describe('rollbackStockAtomic', () => {
    it('should execute atomic increment for each order item', async () => {
      const txEm = {
        getConnection: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue(undefined),
        }),
      };
      const order = makeOrder(faker.string.uuid());

      await service.rollbackStockAtomic(
        txEm as unknown as import('@mikro-orm/postgresql').EntityManager,
        order,
      );

      const conn = txEm.getConnection();
      expect(conn.execute).toHaveBeenCalledWith(
        'UPDATE products SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?',
        [order.orderItems[0].quantity, order.orderItems[0].product.id],
      );
    });

    it('should execute one update per order item', async () => {
      const order = makeOrder(faker.string.uuid());
      order.orderItems.push({
        id: faker.string.uuid(),
        quantity: 1,
        priceAtPurchase: '49.99',
        product: {
          id: faker.string.uuid(),
          name: 'Product 2',
          quantityInStock: 5,
        } as OrderWithItems['orderItems'][number]['product'],
      } as OrderItem);

      const mockExecute = jest.fn().mockResolvedValue(undefined);
      const txEm = {
        getConnection: jest.fn().mockReturnValue({ execute: mockExecute }),
      };

      await service.rollbackStockAtomic(
        txEm as unknown as import('@mikro-orm/postgresql').EntityManager,
        order,
      );

      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });
});
