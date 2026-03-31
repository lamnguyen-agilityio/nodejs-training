import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { Retryable } from '@/common/database';
import type { Product } from '@/modules/products/entities/product.entity';
import type { User } from '@/modules/users/entities/user.entity';

import { CartItemEntity, type CartItem } from './entities/cart-item.entity';
import type { GuestCartItem } from './interfaces';

@Injectable()
export class CartRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CartRepository.name);
  }

  /*
   * find all cart items for a user.
   */
  async findByUser(user: User): Promise<CartItem[]> {
    return this.em.find(
      CartItemEntity,
      { user, deletedAt: null },
      { populate: ['product', 'product.category'] },
    );
  }

  /*
   * find a cart item for a user and product.
   */
  async findItem(user: User, product: Product): Promise<CartItem | null> {
    return this.em.findOne(CartItemEntity, { user, product, deletedAt: null });
  }

  /*
   * add an item to the cart.
   */
  @Retryable()
  async addItem(user: User, product: Product, quantity: number): Promise<CartItem> {
    const existing = await this.findItem(user, product);

    if (existing) {
      // stock validation is done in service — just accumulate here
      this.em.assign(existing, { quantity: existing.quantity + quantity });
      await this.em.flush();

      return existing;
    }

    const item = this.em.create(CartItemEntity, { user, product, quantity });
    this.em.persist(item);
    await this.em.flush();

    return item;
  }

  /*
   * update the quantity of an item in the cart
   */
  @Retryable()
  async updateQuantity(item: CartItem, quantity: number): Promise<CartItem> {
    this.em.assign(item, { quantity });
    await this.em.flush();

    return item;
  }

  /*
   * remove an item from the cart.
   */
  @Retryable()
  async removeItem(item: CartItem): Promise<void> {
    this.em.assign(item, { deletedAt: new Date() });
    await this.em.flush();
  }

  /*
   * clear the cart for a user.
   */
  @Retryable()
  async clearCart(user: User): Promise<void> {
    const items = await this.findByUser(user);
    items.forEach((item) => this.em.assign(item, { deletedAt: new Date() }));
    await this.em.flush();
  }

  /**
   * merge guest session items into user cart.
   * rule: keep the higher quantity between user cart and guest session,
   *       clamped to stock (already done in service before calling this).
   */
  @Retryable()
  async mergeSessionCart(user: User, guestItems: GuestCartItem[]): Promise<void> {
    if (!guestItems.length) return;

    for (const guestItem of guestItems) {
      const existing = await this.findItem(user, guestItem.product);

      if (existing) {
        // keep higher quantity — stock clamping already applied in service
        const merged = Math.max(existing.quantity, guestItem.quantity);
        this.em.assign(existing, { quantity: merged });
      } else {
        const item = this.em.create(CartItemEntity, {
          user,
          product: guestItem.product,
          quantity: guestItem.quantity,
        });
        this.em.persist(item);
      }
    }

    await this.em.flush();
  }
}
