import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PinoLogger } from 'nestjs-pino';

import { OrderStatus } from '@/common/enums';
import type { Product } from '@/modules/products/entities/product.entity';
import type { User } from '@/modules/users/entities/user.entity';
import { createMockEm, createMockLogger } from '@/test';

import type { OrderItem } from './entities/order-item.entity';
import type { Order } from './entities/order.entity';
import type { OrderItemData, OrderWithItems } from './interfaces';
import { OrdersRepository } from './orders.repository';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeUser = (): User => ({ id: faker.string.uuid(), email: faker.internet.email() }) as User;

const makeProduct = (): Product =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    price: faker.commerce.price(),
    quantityInStock: 10,
  }) as Product;

const makeOrder = (user: User, overrides: Partial<Order> = {}): Order =>
  ({
    id: faker.string.uuid(),
    user,
    status: OrderStatus.Pending,
    totalAmount: faker.commerce.price(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }) as Order;

const makeOrderItem = (orderId: string, overrides: Partial<OrderItem> = {}): OrderItem =>
  ({
    id: faker.string.uuid(),
    order: { id: orderId },
    product: makeProduct(),
    quantity: faker.number.int({ min: 1, max: 5 }),
    priceAtPurchase: faker.commerce.price(),
    createdAt: faker.date.past(),
    ...overrides,
  }) as unknown as OrderItem;

const makeOrderWithItems = (user: User): OrderWithItems => {
  const order = makeOrder(user);
  return {
    entity: order,
    userEmail: faker.internet.email(),
    orderItems: [makeOrderItem(order.id)],
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    user: order.user,
  };
};

const makeOrderItemData = (): OrderItemData => ({
  product: makeProduct(),
  quantity: faker.number.int({ min: 1, max: 5 }),
  priceAtPurchase: faker.commerce.price(),
});

// ─── suite ───────────────────────────────────────────────────────────────────

describe('OrdersRepository', () => {
  let repository: OrdersRepository;
  let mockEm: ReturnType<typeof createMockEm>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockEm = createMockEm();
    mockLogger = createMockLogger();
    repository = new OrdersRepository(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── findByUser ─────────────────────────────────────────────────────────────

  describe('findByUser', () => {
    it('should return paginated orders with items for user', async () => {
      const user = makeUser();
      const order = makeOrder(user);
      const orderItem = makeOrderItem(order.id);

      mockEm.findAndCount.mockResolvedValue([[order], 1]);
      mockEm.find.mockResolvedValue([orderItem]);

      const result = await repository.findByUser(user, { page: 1, limit: 10 });

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        { user },
        expect.objectContaining({ limit: 10, offset: 0 }),
      );
      expect(result.total).toBe(1);
      expect(result.items[0].orderItems).toHaveLength(1);
    });

    it('should return empty list when user has no orders', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      const result = await repository.findByUser(makeUser(), {});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should compute correct offset for page 2', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findByUser(makeUser(), { page: 2, limit: 10 });

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ offset: 10 }),
      );
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return OrderWithItems when order found', async () => {
      const user = makeUser();
      const order = makeOrder(user);
      const orderItem = makeOrderItem(order.id);

      mockEm.findOne.mockResolvedValue(order);
      mockEm.find.mockResolvedValue([orderItem]);

      const result = await repository.findOne(order.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(order.id);
      expect(result!.orderItems).toHaveLength(1);
    });

    it('should return null when order not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.findOne(faker.string.uuid());

      expect(result).toBeNull();
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all orders without status filter', async () => {
      const user = makeUser();
      const order = makeOrder(user);
      mockEm.findAndCount.mockResolvedValue([[order], 1]);
      mockEm.find.mockResolvedValue([]);

      const result = await repository.findAll({});

      expect(mockEm.findAndCount).toHaveBeenCalledWith(expect.anything(), {}, expect.anything());
      expect(result.total).toBe(1);
    });

    it('should filter by status when provided', async () => {
      mockEm.findAndCount.mockResolvedValue([[], 0]);

      await repository.findAll({ status: OrderStatus.Paid });

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        { status: OrderStatus.Paid },
        expect.anything(),
      );
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create order and order items then return with items', async () => {
      const user = makeUser();
      const items = [makeOrderItemData()];
      const order = makeOrder(user);
      const orderItem = makeOrderItem(order.id);

      mockEm.create.mockReturnValueOnce(order).mockReturnValueOnce(orderItem);
      mockEm.flush.mockResolvedValue(undefined);
      // findOne call after creation
      mockEm.findOne.mockResolvedValue(order);
      mockEm.find.mockResolvedValue([orderItem]);

      const result = await repository.create(user, items, '99.99');

      expect(mockEm.clear).toHaveBeenCalled();
      expect(mockEm.persist).toHaveBeenCalledTimes(2);
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result.id).toBe(order.id);
    });

    it('should throw Error when order not found after creation', async () => {
      const user = makeUser();
      const order = makeOrder(user);

      mockEm.create.mockReturnValue(order);
      mockEm.flush.mockResolvedValue(undefined);
      // findOne returns null simulating a post-creation lookup failure
      mockEm.findOne.mockResolvedValue(null);

      await expect(repository.create(user, [makeOrderItemData()], '99.99')).rejects.toThrow(
        `Order ${order.id} not found after creation`,
      );
    });

    it('should propagate error when flush fails', async () => {
      const user = makeUser();
      mockEm.create.mockReturnValue(makeOrder(user));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.create(user, [makeOrderItemData()], '99.99')).rejects.toThrow(
        'flush failed',
      );
    });
  });

  // ── updateStatus ───────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should assign new status to entity and flush', async () => {
      const user = makeUser();
      const orderWithItems = makeOrderWithItems(user);
      const updatedOrder = { ...orderWithItems.entity, status: OrderStatus.Paid };

      mockEm.assign.mockImplementation((entity: Order, data: Partial<Order>) =>
        Object.assign(entity, data),
      );
      mockEm.flush.mockResolvedValue(undefined);
      mockEm.findOne.mockResolvedValue(updatedOrder);
      mockEm.find.mockResolvedValue([]);

      const result = await repository.updateStatus(orderWithItems, OrderStatus.Paid);

      expect(mockEm.assign).toHaveBeenCalledWith(orderWithItems.entity, {
        status: OrderStatus.Paid,
      });
      expect(mockEm.flush).toHaveBeenCalled();
      expect(result.status).toBe(OrderStatus.Paid);
    });

    it('should throw Error when order not found after status update', async () => {
      const user = makeUser();
      const orderWithItems = makeOrderWithItems(user);

      mockEm.assign.mockImplementation((e: Order, d: Partial<Order>) => Object.assign(e, d));
      mockEm.flush.mockResolvedValue(undefined);
      // findOne returns null simulating a post-update lookup failure
      mockEm.findOne.mockResolvedValue(null);

      await expect(repository.updateStatus(orderWithItems, OrderStatus.Paid)).rejects.toThrow(
        `Order ${orderWithItems.id} not found after status update`,
      );
    });

    it('should propagate error when flush fails', async () => {
      const orderWithItems = makeOrderWithItems(makeUser());
      mockEm.assign.mockImplementation((e: Order, d: Partial<Order>) => Object.assign(e, d));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.updateStatus(orderWithItems, OrderStatus.Paid)).rejects.toThrow(
        'flush failed',
      );
    });
  });

  // ── createWithManager ──────────────────────────────────────────────────────

  describe('createWithManager', () => {
    it('should create order using txEm and return with items', async () => {
      const user = makeUser();
      const txEm = createMockEm();
      const items = [makeOrderItemData()];
      const order = makeOrder(user);
      const orderItem = makeOrderItem(order.id);

      txEm.create.mockReturnValueOnce(order).mockReturnValueOnce(orderItem);
      txEm.flush.mockResolvedValue(undefined);
      // findOne uses this.em
      mockEm.findOne.mockResolvedValue(order);
      mockEm.find.mockResolvedValue([orderItem]);

      const result = await repository.createWithManager(
        txEm as unknown as EntityManager,
        user,
        items,
        '99.99',
      );

      expect(txEm.create).toHaveBeenCalledTimes(2);
      expect(txEm.persist).toHaveBeenCalledTimes(2);
      expect(txEm.flush).toHaveBeenCalled();
      expect(result.id).toBe(order.id);
    });

    it('should use txEm not this.em for writes', async () => {
      const user = makeUser();
      const txEm = createMockEm();
      const order = makeOrder(user);

      txEm.create.mockReturnValue(order);
      txEm.flush.mockResolvedValue(undefined);
      mockEm.findOne.mockResolvedValue(order);
      mockEm.find.mockResolvedValue([]);

      await repository.createWithManager(
        txEm as unknown as EntityManager,
        user,
        [makeOrderItemData()],
        '99.99',
      );

      expect(mockEm.create).not.toHaveBeenCalled();
      expect(mockEm.flush).not.toHaveBeenCalled();
    });
  });
});
