import { faker } from '@faker-js/faker';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { Role } from '@/common/enums';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import type { Product } from '@/modules/products/entities/product.entity';
import type { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { CartsController } from './carts.controller';
import { CartService } from './carts.service';
import { CartItemResponseDto, CartResponseDto } from './dtos';
import type { CartItem } from './entities/cart-item.entity';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  userId: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
  ...overrides,
});

const makeUser = (id?: string): User =>
  ({ id: id ?? faker.string.uuid(), email: faker.internet.email() }) as User;

const makeProduct = (): Product =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    price: faker.commerce.price(),
    quantityInStock: 10,
    category: { id: faker.string.uuid(), name: 'Category', slug: 'category' },
  }) as unknown as Product;

const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem =>
  ({
    id: faker.string.uuid(),
    quantity: faker.number.int({ min: 1, max: 5 }),
    product: makeProduct(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }) as CartItem;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockCartService = {
  getCart: jest.fn(),
  addItem: jest.fn(),
  updateItem: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
  mergeSessionCart: jest.fn(),
} satisfies Partial<jest.Mocked<CartService>>;

const mockUsersService = {
  findOne: jest.fn(),
} satisfies Partial<jest.Mocked<UsersService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('CartsController', () => {
  let controller: CartsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CartsController(
      mockCartService as unknown as CartService,
      mockUsersService as unknown as UsersService,
    );
  });

  // ── getCart ────────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('should return CartResponseDto with items and totals', async () => {
      const authUser = makeAuthUser();
      const user = makeUser(authUser.userId);
      const items = [makeCartItem(), makeCartItem()];

      mockUsersService.findOne.mockResolvedValue(user);
      mockCartService.getCart.mockResolvedValue(items);

      const result = await controller.getCart(authUser);

      expect(mockUsersService.findOne).toHaveBeenCalledWith({ id: authUser.userId });
      expect(mockCartService.getCart).toHaveBeenCalledWith(user);
      expect(result).toBeInstanceOf(CartResponseDto);
      expect(result.totalItems).toBe(2);
    });

    it('should return empty cart response', async () => {
      const authUser = makeAuthUser();
      mockUsersService.findOne.mockResolvedValue(makeUser(authUser.userId));
      mockCartService.getCart.mockResolvedValue([]);

      const result = await controller.getCart(authUser);

      expect(result.totalItems).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  // ── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should return CartItemResponseDto after adding item', async () => {
      const authUser = makeAuthUser();
      const user = makeUser(authUser.userId);
      const item = makeCartItem();
      const dto = { productId: faker.string.uuid(), quantity: 2 };

      mockUsersService.findOne.mockResolvedValue(user);
      mockCartService.addItem.mockResolvedValue(item);

      const result = await controller.addItem(authUser, dto);

      expect(mockCartService.addItem).toHaveBeenCalledWith(user, dto);
      expect(result).toBeInstanceOf(CartItemResponseDto);
    });

    it('should propagate BadRequestException from service', async () => {
      mockUsersService.findOne.mockResolvedValue(makeUser());
      mockCartService.addItem.mockRejectedValue(new BadRequestException('Insufficient stock'));

      await expect(
        controller.addItem(makeAuthUser(), { productId: faker.string.uuid(), quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── updateItem ─────────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('should return updated CartItemResponseDto', async () => {
      const authUser = makeAuthUser();
      const user = makeUser(authUser.userId);
      const item = makeCartItem();
      const itemId = faker.string.uuid();

      mockUsersService.findOne.mockResolvedValue(user);
      mockCartService.updateItem.mockResolvedValue(item);

      const result = await controller.updateItem(authUser, itemId, { quantity: 3 });

      expect(mockCartService.updateItem).toHaveBeenCalledWith(user, itemId, { quantity: 3 });
      expect(result).toBeInstanceOf(CartItemResponseDto);
    });

    it('should propagate NotFoundException when item not found', async () => {
      mockUsersService.findOne.mockResolvedValue(makeUser());
      mockCartService.updateItem.mockRejectedValue(new NotFoundException());

      await expect(
        controller.updateItem(makeAuthUser(), faker.string.uuid(), { quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── removeItem ─────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('should call service removeItem', async () => {
      const authUser = makeAuthUser();
      const user = makeUser(authUser.userId);
      const itemId = faker.string.uuid();

      mockUsersService.findOne.mockResolvedValue(user);
      mockCartService.removeItem.mockResolvedValue(undefined);

      await controller.removeItem(authUser, itemId);

      expect(mockCartService.removeItem).toHaveBeenCalledWith(user, itemId);
    });

    it('should propagate NotFoundException when item not found', async () => {
      mockUsersService.findOne.mockResolvedValue(makeUser());
      mockCartService.removeItem.mockRejectedValue(new NotFoundException());

      await expect(controller.removeItem(makeAuthUser(), faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── clearCart ──────────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('should call service clearCart', async () => {
      const authUser = makeAuthUser();
      const user = makeUser(authUser.userId);

      mockUsersService.findOne.mockResolvedValue(user);
      mockCartService.clearCart.mockResolvedValue(undefined);

      await controller.clearCart(authUser);

      expect(mockCartService.clearCart).toHaveBeenCalledWith(user);
    });
  });

  // ── mergeCart ──────────────────────────────────────────────────────────────

  describe('mergeCart', () => {
    it('should merge and return updated cart', async () => {
      const authUser = makeAuthUser();
      const user = makeUser(authUser.userId);
      const items = [makeCartItem()];
      const dto = {
        items: [{ productId: faker.string.uuid(), quantity: 2 }],
      };

      mockCartService.mergeSessionCart.mockResolvedValue(undefined);
      mockUsersService.findOne.mockResolvedValue(user);
      mockCartService.getCart.mockResolvedValue(items);

      const result = await controller.mergeCart(authUser, dto);

      expect(mockCartService.mergeSessionCart).toHaveBeenCalledWith(authUser.userId, dto.items);
      expect(result).toBeInstanceOf(CartResponseDto);
      expect(result.totalItems).toBe(1);
    });
  });
});
