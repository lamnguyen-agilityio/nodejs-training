import { faker } from '@faker-js/faker';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { MESSAGES, NUMERIC } from '@/common/constants';
import type { Product } from '@/modules/products/entities/product.entity';
import { ProductsService } from '@/modules/products/products.service';
import type { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { CartsRepository } from './carts.repository';
import { CartService } from './carts.service';
import type { GuestCartItemDto } from './dtos';
import type { CartItem } from './entities/cart-item.entity';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({ id: faker.string.uuid(), email: faker.internet.email(), ...overrides }) as User;

const makeProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    price: faker.commerce.price(),
    quantityInStock: 10,
    ...overrides,
  }) as Product;

const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem =>
  ({
    id: faker.string.uuid(),
    quantity: 2,
    product: makeProduct(),
    deletedAt: null,
    ...overrides,
  }) as CartItem;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockCartsRepository = {
  findByUser: jest.fn(),
  findItem: jest.fn(),
  addItem: jest.fn(),
  updateQuantity: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
  mergeSessionCart: jest.fn(),
} satisfies Partial<jest.Mocked<CartsRepository>>;

const mockProductsService = {
  findOne: jest.fn(),
} satisfies Partial<jest.Mocked<ProductsService>>;

const mockUsersService = {
  findOne: jest.fn(),
} satisfies Partial<jest.Mocked<UsersService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CartService(
      mockCartsRepository as unknown as CartsRepository,
      mockProductsService as unknown as ProductsService,
      mockUsersService as unknown as UsersService,
    );
  });

  // ── getCart ────────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('should return all cart items for user', async () => {
      const user = makeUser();
      const items = [makeCartItem(), makeCartItem()];
      mockCartsRepository.findByUser.mockResolvedValue(items);

      const result = await service.getCart(user);

      expect(mockCartsRepository.findByUser).toHaveBeenCalledWith(user);
      expect(result).toBe(items);
    });
  });

  // ── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should add item when total quantity is within stock', async () => {
      const user = makeUser();
      const product = makeProduct({ quantityInStock: 10 });
      const item = makeCartItem({ product, quantity: 3 });

      mockProductsService.findOne.mockResolvedValue(product);
      mockCartsRepository.findItem.mockResolvedValue(null);
      mockCartsRepository.addItem.mockResolvedValue(item);

      const result = await service.addItem(user, { productId: product.id, quantity: 3 });

      expect(mockCartsRepository.addItem).toHaveBeenCalledWith(user, product, 3);
      expect(result).toBe(item);
    });

    it('should accumulate with existing cart quantity before checking stock', async () => {
      const user = makeUser();
      const product = makeProduct({ quantityInStock: 10 });
      const existing = makeCartItem({ product, quantity: 8 });
      const item = makeCartItem({ product, quantity: 10 });

      mockProductsService.findOne.mockResolvedValue(product);
      mockCartsRepository.findItem.mockResolvedValue(existing);
      mockCartsRepository.addItem.mockResolvedValue(item);

      // 8 existing + 2 new = 10 = stock → ok
      const result = await service.addItem(user, { productId: product.id, quantity: 2 });

      expect(result).toBe(item);
    });

    it('should throw BadRequestException when total exceeds stock', async () => {
      const user = makeUser();
      const product = makeProduct({ quantityInStock: 10 });
      const existing = makeCartItem({ product, quantity: 8 });

      mockProductsService.findOne.mockResolvedValue(product);
      mockCartsRepository.findItem.mockResolvedValue(existing);

      // 8 + 3 = 11 > 10 → insufficient stock
      await expect(service.addItem(user, { productId: product.id, quantity: 3 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addItem(user, { productId: product.id, quantity: 3 })).rejects.toThrow(
        MESSAGES.INSUFFICIENT_STOCK,
      );
      expect(mockCartsRepository.addItem).not.toHaveBeenCalled();
    });
  });

  // ── updateItem ─────────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('should update quantity when within stock', async () => {
      const user = makeUser();
      const product = makeProduct({ quantityInStock: 10 });
      const item = makeCartItem({ product, quantity: 2 });
      const updated = makeCartItem({ product, quantity: 5 });

      mockCartsRepository.findByUser.mockResolvedValue([item]);
      mockCartsRepository.updateQuantity.mockResolvedValue(updated);

      const result = await service.updateItem(user, item.id, { quantity: 5 });

      expect(mockCartsRepository.updateQuantity).toHaveBeenCalledWith(item, 5);
      expect(result).toBe(updated);
    });

    it('should throw BadRequestException when quantity exceeds stock', async () => {
      const user = makeUser();
      const product = makeProduct({ quantityInStock: 10 });
      const item = makeCartItem({ product, quantity: 2 });

      mockCartsRepository.findByUser.mockResolvedValue([item]);

      await expect(service.updateItem(user, item.id, { quantity: 11 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateItem(user, item.id, { quantity: 11 })).rejects.toThrow(
        MESSAGES.INSUFFICIENT_STOCK,
      );
    });

    it('should throw BadRequestException when quantity is below minimum', async () => {
      const user = makeUser();
      const product = makeProduct({ quantityInStock: 10 });
      const item = makeCartItem({ product });

      mockCartsRepository.findByUser.mockResolvedValue([item]);

      await expect(
        service.updateItem(user, item.id, { quantity: NUMERIC.QUANTITY_MIN - 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when cart item not found', async () => {
      mockCartsRepository.findByUser.mockResolvedValue([]);

      await expect(
        service.updateItem(makeUser(), faker.string.uuid(), { quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateItem(makeUser(), faker.string.uuid(), { quantity: 1 }),
      ).rejects.toThrow(MESSAGES.CART_ITEM_NOT_FOUND);
    });
  });

  // ── removeItem ─────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('should remove the cart item', async () => {
      const user = makeUser();
      const item = makeCartItem();

      mockCartsRepository.findByUser.mockResolvedValue([item]);
      mockCartsRepository.removeItem.mockResolvedValue(undefined);

      await service.removeItem(user, item.id);

      expect(mockCartsRepository.removeItem).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException when item not in cart', async () => {
      mockCartsRepository.findByUser.mockResolvedValue([]);

      await expect(service.removeItem(makeUser(), faker.string.uuid())).rejects.toThrow(
        NotFoundException,
      );
      expect(mockCartsRepository.removeItem).not.toHaveBeenCalled();
    });
  });

  // ── clearCart ──────────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('should clear the entire cart', async () => {
      const user = makeUser();
      mockCartsRepository.clearCart.mockResolvedValue(undefined);

      await service.clearCart(user);

      expect(mockCartsRepository.clearCart).toHaveBeenCalledWith(user);
    });
  });

  // ── mergeSessionCart ───────────────────────────────────────────────────────

  describe('mergeSessionCart', () => {
    it('should resolve products and merge valid items', async () => {
      const user = makeUser();
      const product = makeProduct({ quantityInStock: 10 });
      const guestItems: GuestCartItemDto[] = [{ productId: product.id, quantity: 3 }];

      mockUsersService.findOne.mockResolvedValue(user);
      mockProductsService.findOne.mockResolvedValue(product);
      mockCartsRepository.mergeSessionCart.mockResolvedValue(undefined);

      await service.mergeSessionCart(user.id, guestItems);

      expect(mockCartsRepository.mergeSessionCart).toHaveBeenCalledWith(user, [
        { product, quantity: 3 },
      ]);
    });

    it('should clamp quantity to available stock', async () => {
      const user = makeUser();
      const product = makeProduct({ quantityInStock: 5 });
      const guestItems: GuestCartItemDto[] = [{ productId: product.id, quantity: 10 }];

      mockUsersService.findOne.mockResolvedValue(user);
      mockProductsService.findOne.mockResolvedValue(product);
      mockCartsRepository.mergeSessionCart.mockResolvedValue(undefined);

      await service.mergeSessionCart(user.id, guestItems);

      expect(mockCartsRepository.mergeSessionCart).toHaveBeenCalledWith(user, [
        { product, quantity: 5 },
      ]);
    });

    it('should filter out items with zero stock', async () => {
      const user = makeUser();
      const product = makeProduct({ quantityInStock: 0 });
      const guestItems: GuestCartItemDto[] = [{ productId: product.id, quantity: 3 }];

      mockUsersService.findOne.mockResolvedValue(user);
      mockProductsService.findOne.mockResolvedValue(product);
      mockCartsRepository.mergeSessionCart.mockResolvedValue(undefined);

      await service.mergeSessionCart(user.id, guestItems);

      expect(mockCartsRepository.mergeSessionCart).toHaveBeenCalledWith(user, []);
    });
  });
});
