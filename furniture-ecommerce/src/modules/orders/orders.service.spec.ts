import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { MESSAGES } from '@/common/constants';
import { OrderStatus, Role } from '@/common/enums';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import { CartsRepository } from '@/modules/carts/carts.repository';
import type { CartItem } from '@/modules/carts/entities/cart-item.entity';
import type { Product } from '@/modules/products/entities/product.entity';
import type { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { createMockEm } from '@/test/mocks';

import type { Order } from './entities/order.entity';
import type { OrderWithItems } from './interfaces';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthUser = (role = Role.User): AuthenticatedUser => ({
  userId: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role,
});

const makeUser = (id?: string): User =>
  ({ id: id ?? faker.string.uuid(), email: faker.internet.email() }) as User;

const makeProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    price: '99.99',
    quantityInStock: 10,
    ...overrides,
  }) as Product;

const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem =>
  ({
    id: faker.string.uuid(),
    quantity: 2,
    product: makeProduct(),
    ...overrides,
  }) as CartItem;

const makeOrderWithItems = (
  userId: string,
  overrides: Partial<OrderWithItems> = {},
): OrderWithItems => ({
  entity: {} as Order,
  id: faker.string.uuid(),
  userEmail: faker.internet.email(),
  status: OrderStatus.Pending,
  totalAmount: '199.98',
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  user: makeUser(userId),
  orderItems: [],
  ...overrides,
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockEm = createMockEm();

const mockOrdersRepository = {
  findByUser: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  updateStatus: jest.fn(),
  createWithManager: jest.fn(),
} satisfies Partial<jest.Mocked<OrdersRepository>>;

const mockCartsRepository = {
  findByUser: jest.fn(),
  clearCartWithManager: jest.fn(),
} satisfies Partial<jest.Mocked<CartsRepository>>;

const mockUsersService = {
  findOne: jest.fn(),
} satisfies Partial<jest.Mocked<UsersService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(
      mockEm as unknown as EntityManager,
      mockOrdersRepository as unknown as OrdersRepository,
      mockCartsRepository as unknown as CartsRepository,
      mockUsersService as unknown as UsersService,
    );
  });

  // ── createFromCart ─────────────────────────────────────────────────────────

  describe('createFromCart', () => {
    it('should throw BadRequestException when cart is empty', async () => {
      const authUser = makeAuthUser();
      mockUsersService.findOne.mockResolvedValue(makeUser(authUser.userId));
      mockCartsRepository.findByUser.mockResolvedValue([]);

      await expect(service.createFromCart(authUser)).rejects.toThrow(BadRequestException);
      await expect(service.createFromCart(authUser)).rejects.toThrow(MESSAGES.CART_EMPTY);
    });

    it('should run transactional checkout', async () => {
      const authUser = makeAuthUser();
      const user = makeUser(authUser.userId);
      const product = makeProduct({ quantityInStock: 10, price: '99.99' });
      const cartItems = [makeCartItem({ product, quantity: 2 })];
      const order = makeOrderWithItems(user.id);

      mockUsersService.findOne.mockResolvedValue(user);
      mockCartsRepository.findByUser.mockResolvedValue(cartItems);

      // em.transactional calls the callback with txEm
      mockEm.transactional.mockImplementation(async (cb: Function) => {
        const txEm = createMockEm();
        txEm.nativeUpdate.mockResolvedValue(1);
        mockOrdersRepository.createWithManager.mockResolvedValue(order);
        mockCartsRepository.clearCartWithManager.mockResolvedValue(undefined);
        return cb(txEm);
      });

      const result = await service.createFromCart(authUser);

      expect(mockEm.transactional).toHaveBeenCalled();
      expect(result).toBe(order);
    });
  });

  // ── findByUser ─────────────────────────────────────────────────────────────

  describe('findByUser', () => {
    it('should return paginated orders for user', async () => {
      const authUser = makeAuthUser();
      const user = makeUser(authUser.userId);
      const paginated = { items: [makeOrderWithItems(user.id)], total: 1, page: 1, limit: 20 };

      mockUsersService.findOne.mockResolvedValue(user);
      mockOrdersRepository.findByUser.mockResolvedValue(paginated);

      const result = await service.findByUser(authUser, {});

      expect(mockOrdersRepository.findByUser).toHaveBeenCalledWith(user, {});
      expect(result).toBe(paginated);
    });
  });

  // ── findOneByUser ──────────────────────────────────────────────────────────

  describe('findOneByUser', () => {
    it('should return order when it belongs to the user', async () => {
      const authUser = makeAuthUser();
      const order = makeOrderWithItems(authUser.userId);
      mockOrdersRepository.findOne.mockResolvedValue(order);

      const result = await service.findOneByUser(authUser, order.id);

      expect(result).toBe(order);
    });

    it('should throw ForbiddenException when order belongs to another user', async () => {
      const authUser = makeAuthUser();
      const order = makeOrderWithItems(faker.string.uuid()); // different userId
      mockOrdersRepository.findOne.mockResolvedValue(order);

      await expect(service.findOneByUser(authUser, order.id)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockOrdersRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneByUser(makeAuthUser(), faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should delegate to repository findAll', async () => {
      const paginated = { items: [], total: 0, page: 1, limit: 20 };
      mockOrdersRepository.findAll.mockResolvedValue(paginated);

      const result = await service.findAll({ status: OrderStatus.Pending });

      expect(mockOrdersRepository.findAll).toHaveBeenCalledWith({ status: OrderStatus.Pending });
      expect(result).toBe(paginated);
    });
  });

  // ── updateStatus ───────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update status when transition is valid for Admin', async () => {
      const order = makeOrderWithItems(faker.string.uuid(), { status: OrderStatus.Pending });
      const updated = { ...order, status: OrderStatus.Paid };

      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockOrdersRepository.updateStatus.mockResolvedValue(updated);

      const result = await service.updateStatus(order.id, OrderStatus.Paid, Role.Admin);

      expect(mockOrdersRepository.updateStatus).toHaveBeenCalledWith(order, OrderStatus.Paid);
      expect(result.status).toBe(OrderStatus.Paid);
    });

    it('should allow User to cancel pending order', async () => {
      const authUser = makeAuthUser(Role.User);
      const order = makeOrderWithItems(authUser.userId, { status: OrderStatus.Pending });
      const updated = { ...order, status: OrderStatus.Cancelled };

      mockOrdersRepository.findOne.mockResolvedValue(order);
      mockOrdersRepository.updateStatus.mockResolvedValue(updated);

      const result = await service.updateStatus(order.id, OrderStatus.Cancelled, Role.User);

      expect(result.status).toBe(OrderStatus.Cancelled);
    });

    it('should throw UnprocessableEntityException for invalid transition', async () => {
      const order = makeOrderWithItems(faker.string.uuid(), { status: OrderStatus.Delivered });
      mockOrdersRepository.findOne.mockResolvedValue(order);

      await expect(service.updateStatus(order.id, OrderStatus.Pending, Role.Admin)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(mockOrdersRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when order not found', async () => {
      mockOrdersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(faker.string.uuid(), OrderStatus.Paid, Role.Admin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findOneAdmin ───────────────────────────────────────────────────────────

  describe('findOneAdmin', () => {
    it('should return order for any user', async () => {
      const order = makeOrderWithItems(faker.string.uuid());
      mockOrdersRepository.findOne.mockResolvedValue(order);

      const result = await service.findOneAdmin(order.id);

      expect(result).toBe(order);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockOrdersRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneAdmin(faker.string.uuid())).rejects.toThrow(NotFoundException);
    });
  });
});
