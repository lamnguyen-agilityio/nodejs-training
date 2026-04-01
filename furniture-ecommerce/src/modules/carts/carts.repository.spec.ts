import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { PinoLogger } from 'nestjs-pino';

import type { Product } from '@/modules/products/entities/product.entity';
import type { User } from '@/modules/users/entities/user.entity';
import { createMockEm, createMockLogger } from '@/test';

import { CartsRepository } from './carts.repository';
import type { CartItem } from './entities/cart-item.entity';
import type { GuestCartItem } from './interfaces';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({ id: faker.string.uuid(), email: faker.internet.email(), ...overrides }) as User;

const makeProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    price: faker.commerce.price(),
    quantityInStock: faker.number.int({ min: 5, max: 100 }),
    ...overrides,
  }) as Product;

const makeCartItem = (overrides: Partial<CartItem> = {}): CartItem =>
  ({
    id: faker.string.uuid(),
    quantity: faker.number.int({ min: 1, max: 5 }),
    product: makeProduct(),
    deletedAt: null,
    ...overrides,
  }) as CartItem;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('CartsRepository', () => {
  let repository: CartsRepository;
  let mockEm: ReturnType<typeof createMockEm>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockEm = createMockEm();
    mockLogger = createMockLogger();
    repository = new CartsRepository(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── findByUser ─────────────────────────────────────────────────────────────

  describe('findByUser', () => {
    it('should return all non-deleted cart items for user', async () => {
      const user = makeUser();
      const items = [makeCartItem(), makeCartItem()];
      mockEm.find.mockResolvedValue(items);

      const result = await repository.findByUser(user);

      expect(mockEm.find).toHaveBeenCalledWith(
        expect.anything(),
        { user, deletedAt: null },
        { populate: ['product', 'product.category'] },
      );
      expect(result).toBe(items);
    });

    it('should return empty array when cart is empty', async () => {
      mockEm.find.mockResolvedValue([]);
      const result = await repository.findByUser(makeUser());
      expect(result).toEqual([]);
    });
  });

  // ── findItem ───────────────────────────────────────────────────────────────

  describe('findItem', () => {
    it('should return cart item when found', async () => {
      const user = makeUser();
      const product = makeProduct();
      const item = makeCartItem({ product });
      mockEm.findOne.mockResolvedValue(item);

      const result = await repository.findItem(user, product);

      expect(mockEm.findOne).toHaveBeenCalledWith(expect.anything(), {
        user,
        product,
        deletedAt: null,
      });
      expect(result).toBe(item);
    });

    it('should return null when item not found', async () => {
      mockEm.findOne.mockResolvedValue(null);
      const result = await repository.findItem(makeUser(), makeProduct());
      expect(result).toBeNull();
    });
  });

  // ── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should create new cart item when product not in cart', async () => {
      const user = makeUser();
      const product = makeProduct();
      const item = makeCartItem({ product, quantity: 2 });

      mockEm.findOne.mockResolvedValue(null);
      mockEm.create.mockReturnValue(item);
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.addItem(user, product, 2);

      expect(mockEm.create).toHaveBeenCalledWith(expect.anything(), { user, product, quantity: 2 });
      expect(mockEm.persist).toHaveBeenCalledWith(item);
      expect(result).toBe(item);
    });

    it('should accumulate quantity when product already in cart', async () => {
      const user = makeUser();
      const product = makeProduct();
      const existing = makeCartItem({ product, quantity: 3 });

      mockEm.findOne.mockResolvedValue(existing);
      mockEm.assign.mockImplementation((item: CartItem, data: Partial<CartItem>) =>
        Object.assign(item, data),
      );
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.addItem(user, product, 2);

      expect(mockEm.assign).toHaveBeenCalledWith(existing, { quantity: 5 });
      expect(result).toBe(existing);
    });

    it('should propagate error when flush fails', async () => {
      mockEm.findOne.mockResolvedValue(null);
      mockEm.create.mockReturnValue(makeCartItem());
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.addItem(makeUser(), makeProduct(), 1)).rejects.toThrow(
        'flush failed',
      );
    });
  });

  // ── updateQuantity ─────────────────────────────────────────────────────────

  describe('updateQuantity', () => {
    it('should update item quantity and flush', async () => {
      const item = makeCartItem({ quantity: 1 });
      mockEm.assign.mockImplementation((i: CartItem, d: Partial<CartItem>) => Object.assign(i, d));
      mockEm.flush.mockResolvedValue(undefined);

      const result = await repository.updateQuantity(item, 5);

      expect(mockEm.assign).toHaveBeenCalledWith(item, { quantity: 5 });
      expect(result.quantity).toBe(5);
    });

    it('should propagate error when flush fails', async () => {
      const item = makeCartItem();
      mockEm.assign.mockImplementation((i: CartItem, d: Partial<CartItem>) => Object.assign(i, d));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.updateQuantity(item, 3)).rejects.toThrow('flush failed');
    });
  });

  // ── removeItem ─────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('should soft-delete item by setting deletedAt', async () => {
      const item = makeCartItem({ deletedAt: null });
      mockEm.assign.mockImplementation((i: CartItem, d: Partial<CartItem>) => Object.assign(i, d));
      mockEm.flush.mockResolvedValue(undefined);

      await repository.removeItem(item);

      expect(mockEm.assign).toHaveBeenCalledWith(
        item,
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should propagate error when flush fails', async () => {
      const item = makeCartItem();
      mockEm.assign.mockImplementation((i: CartItem, d: Partial<CartItem>) => Object.assign(i, d));
      mockEm.flush.mockRejectedValue(new Error('flush failed'));

      await expect(repository.removeItem(item)).rejects.toThrow('flush failed');
    });
  });

  // ── clearCart ──────────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('should soft-delete all cart items for user', async () => {
      const user = makeUser();
      const items = [makeCartItem(), makeCartItem()];
      mockEm.find.mockResolvedValue(items);
      mockEm.assign.mockImplementation((i: CartItem, d: Partial<CartItem>) => Object.assign(i, d));
      mockEm.flush.mockResolvedValue(undefined);

      await repository.clearCart(user);

      expect(mockEm.assign).toHaveBeenCalledTimes(2);
      items.forEach((item) =>
        expect(mockEm.assign).toHaveBeenCalledWith(
          item,
          expect.objectContaining({ deletedAt: expect.any(Date) }),
        ),
      );
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should flush even when cart is empty', async () => {
      mockEm.find.mockResolvedValue([]);
      mockEm.flush.mockResolvedValue(undefined);

      await repository.clearCart(makeUser());

      expect(mockEm.flush).toHaveBeenCalled();
    });
  });

  // ── mergeSessionCart ───────────────────────────────────────────────────────

  describe('mergeSessionCart', () => {
    it('should do nothing when guest items list is empty', async () => {
      await repository.mergeSessionCart(makeUser(), []);
      expect(mockEm.flush).not.toHaveBeenCalled();
    });

    it('should create new items when product not in user cart', async () => {
      const user = makeUser();
      const product = makeProduct();
      const guestItems: GuestCartItem[] = [{ product, quantity: 3 }];
      const newItem = makeCartItem({ product, quantity: 3 });

      mockEm.findOne.mockResolvedValue(null);
      mockEm.create.mockReturnValue(newItem);
      mockEm.flush.mockResolvedValue(undefined);

      await repository.mergeSessionCart(user, guestItems);

      expect(mockEm.create).toHaveBeenCalledWith(expect.anything(), { user, product, quantity: 3 });
      expect(mockEm.persist).toHaveBeenCalledWith(newItem);
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should keep higher quantity when product exists in both carts', async () => {
      const user = makeUser();
      const product = makeProduct();
      const existing = makeCartItem({ product, quantity: 5 });
      const guestItems: GuestCartItem[] = [{ product, quantity: 3 }];

      mockEm.findOne.mockResolvedValue(existing);
      mockEm.assign.mockImplementation((i: CartItem, d: Partial<CartItem>) => Object.assign(i, d));
      mockEm.flush.mockResolvedValue(undefined);

      await repository.mergeSessionCart(user, guestItems);

      // user had 5, guest had 3 — keep 5
      expect(mockEm.assign).toHaveBeenCalledWith(existing, { quantity: 5 });
    });

    it('should keep guest quantity when it is higher than user cart', async () => {
      const user = makeUser();
      const product = makeProduct();
      const existing = makeCartItem({ product, quantity: 2 });
      const guestItems: GuestCartItem[] = [{ product, quantity: 7 }];

      mockEm.findOne.mockResolvedValue(existing);
      mockEm.assign.mockImplementation((i: CartItem, d: Partial<CartItem>) => Object.assign(i, d));
      mockEm.flush.mockResolvedValue(undefined);

      await repository.mergeSessionCart(user, guestItems);

      // user had 2, guest had 7 — keep 7
      expect(mockEm.assign).toHaveBeenCalledWith(existing, { quantity: 7 });
    });
  });

  // ── clearCartWithManager ───────────────────────────────────────────────────

  describe('clearCartWithManager', () => {
    it('should soft-delete all items using the provided transactional em', async () => {
      const user = makeUser();
      const items = [makeCartItem(), makeCartItem()];
      const txEm = createMockEm();

      txEm.find.mockResolvedValue(items);
      txEm.assign.mockImplementation((i: CartItem, d: Partial<CartItem>) => Object.assign(i, d));
      txEm.flush.mockResolvedValue(undefined);

      await repository.clearCartWithManager(txEm as unknown as EntityManager, user);

      expect(txEm.find).toHaveBeenCalledWith(expect.anything(), { user, deletedAt: null });
      expect(txEm.assign).toHaveBeenCalledTimes(2);
      items.forEach((item) =>
        expect(txEm.assign).toHaveBeenCalledWith(
          item,
          expect.objectContaining({ deletedAt: expect.any(Date) }),
        ),
      );
      expect(txEm.flush).toHaveBeenCalled();
    });

    it('should use txEm not this.em', async () => {
      const user = makeUser();
      const txEm = createMockEm();

      txEm.find.mockResolvedValue([]);
      txEm.flush.mockResolvedValue(undefined);

      await repository.clearCartWithManager(txEm as unknown as EntityManager, user);

      // the main em should not be touched
      expect(mockEm.find).not.toHaveBeenCalled();
      expect(mockEm.flush).not.toHaveBeenCalled();
    });

    it('should flush even when cart is empty', async () => {
      const user = makeUser();
      const txEm = createMockEm();

      txEm.find.mockResolvedValue([]);
      txEm.flush.mockResolvedValue(undefined);

      await repository.clearCartWithManager(txEm as unknown as EntityManager, user);

      expect(txEm.flush).toHaveBeenCalled();
    });
  });
});
