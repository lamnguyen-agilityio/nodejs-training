import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { MESSAGES } from '@/common/constants';
import { OrderStatus, Role } from '@/common/enums';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import { User } from '@/modules/users/entities/user.entity';

import { OrderResponseDto, PaginatedOrdersDto } from './dtos';
import type { Order } from './entities/order.entity';
import type { OrderWithItems } from './interfaces';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthUser = (role = Role.User, userId?: string): AuthenticatedUser => ({
  userId: userId ?? faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role,
});

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
  user: { id: userId } as User,
  orderItems: [],
  ...overrides,
});

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockOrdersService = {
  createFromCart: jest.fn(),
  findByUser: jest.fn(),
  findAll: jest.fn(),
  findOneByUser: jest.fn(),
  findOneAdmin: jest.fn(),
  updateStatus: jest.fn(),
} satisfies Partial<jest.Mocked<OrdersService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OrdersController(mockOrdersService as unknown as OrdersService);
  });

  // ── createFromCart ─────────────────────────────────────────────────────────

  describe('createFromCart', () => {
    it('should return OrderResponseDto after successful checkout', async () => {
      const authUser = makeAuthUser();
      const order = makeOrderWithItems(authUser.userId);
      mockOrdersService.createFromCart.mockResolvedValue(order);

      const result = await controller.createFromCart(authUser);

      expect(mockOrdersService.createFromCart).toHaveBeenCalledWith(authUser);
      expect(result).toBeInstanceOf(OrderResponseDto);
    });

    it('should propagate BadRequestException when cart is empty', async () => {
      mockOrdersService.createFromCart.mockRejectedValue(
        new BadRequestException(MESSAGES.CART_EMPTY),
      );

      await expect(controller.createFromCart(makeAuthUser())).rejects.toThrow(BadRequestException);
    });
  });

  // ── findOrders ─────────────────────────────────────────────────────────────

  describe('findOrders', () => {
    it('should return user orders when role is User', async () => {
      const authUser = makeAuthUser(Role.User);
      const paginated = {
        items: [makeOrderWithItems(authUser.userId)],
        total: 1,
        page: 1,
        limit: 20,
      };
      mockOrdersService.findByUser.mockResolvedValue(paginated);

      const result = await controller.findOrders(authUser, {});

      expect(mockOrdersService.findByUser).toHaveBeenCalledWith(authUser, {});
      expect(mockOrdersService.findAll).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(PaginatedOrdersDto);
    });

    it('should return all orders when role is Admin', async () => {
      const authUser = makeAuthUser(Role.Admin);
      const paginated = { items: [], total: 0, page: 1, limit: 20 };
      mockOrdersService.findAll.mockResolvedValue(paginated);

      const result = await controller.findOrders(authUser, {});

      expect(mockOrdersService.findAll).toHaveBeenCalledWith({});
      expect(mockOrdersService.findByUser).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(PaginatedOrdersDto);
    });

    it('should pass status filter to admin findAll', async () => {
      const authUser = makeAuthUser(Role.Admin);
      mockOrdersService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      await controller.findOrders(authUser, { status: OrderStatus.Paid });

      expect(mockOrdersService.findAll).toHaveBeenCalledWith({ status: OrderStatus.Paid });
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should call findOneByUser for User role', async () => {
      const authUser = makeAuthUser(Role.User);
      const order = makeOrderWithItems(authUser.userId);
      mockOrdersService.findOneByUser.mockResolvedValue(order);

      const result = await controller.findOne(authUser, order.id);

      expect(mockOrdersService.findOneByUser).toHaveBeenCalledWith(authUser, order.id);
      expect(mockOrdersService.findOneAdmin).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(OrderResponseDto);
    });

    it('should call findOneAdmin for Admin role', async () => {
      const authUser = makeAuthUser(Role.Admin);
      const order = makeOrderWithItems(faker.string.uuid());
      mockOrdersService.findOneAdmin.mockResolvedValue(order);

      const result = await controller.findOne(authUser, order.id);

      expect(mockOrdersService.findOneAdmin).toHaveBeenCalledWith(order.id);
      expect(mockOrdersService.findOneByUser).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(OrderResponseDto);
    });

    it('should propagate ForbiddenException for User accessing another order', async () => {
      const authUser = makeAuthUser(Role.User);
      mockOrdersService.findOneByUser.mockRejectedValue(new ForbiddenException());

      await expect(controller.findOne(authUser, faker.string.uuid())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should propagate NotFoundException', async () => {
      mockOrdersService.findOneByUser.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(makeAuthUser(), faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateStatus ───────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update status for Admin without ownership check', async () => {
      const authUser = makeAuthUser(Role.Admin);
      const order = makeOrderWithItems(faker.string.uuid(), { status: OrderStatus.Paid });
      mockOrdersService.updateStatus.mockResolvedValue(order);

      const result = await controller.updateStatus(authUser, order.id, {
        status: OrderStatus.Paid,
      });

      expect(mockOrdersService.findOneByUser).not.toHaveBeenCalled();
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        OrderStatus.Paid,
        Role.Admin,
      );
      expect(result).toBeInstanceOf(OrderResponseDto);
    });

    it('should check ownership for User before updating', async () => {
      const authUser = makeAuthUser(Role.User);
      const order = makeOrderWithItems(authUser.userId, { status: OrderStatus.Pending });
      const cancelled = { ...order, status: OrderStatus.Cancelled };

      mockOrdersService.findOneByUser.mockResolvedValue(order);
      mockOrdersService.updateStatus.mockResolvedValue(cancelled);

      await controller.updateStatus(authUser, order.id, { status: OrderStatus.Cancelled });

      expect(mockOrdersService.findOneByUser).toHaveBeenCalledWith(authUser, order.id);
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        OrderStatus.Cancelled,
        Role.User,
      );
    });

    it('should throw ForbiddenException when User tries to update another user order', async () => {
      const authUser = makeAuthUser(Role.User);
      mockOrdersService.findOneByUser.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.updateStatus(authUser, faker.string.uuid(), {
          status: OrderStatus.Cancelled,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockOrdersService.updateStatus).not.toHaveBeenCalled();
    });

    it('should propagate UnprocessableEntityException for invalid transition', async () => {
      const authUser = makeAuthUser(Role.Admin);
      mockOrdersService.updateStatus.mockRejectedValue(new UnprocessableEntityException());

      await expect(
        controller.updateStatus(authUser, faker.string.uuid(), { status: OrderStatus.Pending }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
