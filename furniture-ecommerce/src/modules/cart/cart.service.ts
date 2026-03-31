import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { MESSAGES, NUMERIC } from '@/common/constants';
import { ProductsService } from '@/modules/products/products.service';
import type { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { CartRepository } from './cart.repository';
import type { GuestCartItemDto } from './dtos';
import type { CartItem } from './entities/cart-item.entity';
import type { AddCartItem, UpdateCartItem } from './interfaces';

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productsService: ProductsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * get all cart items for a user.
   */
  async getCart(user: User): Promise<CartItem[]> {
    return this.cartRepository.findByUser(user);
  }

  /**
   * add an item to the cart.
   */
  async addItem(user: User, dto: AddCartItem): Promise<CartItem> {
    const product = await this.productsService.findOne({ id: dto.productId });

    // check existing quantity in cart to avoid exceeding stock
    const existing = await this.cartRepository.findItem(user, product);
    const currentQty = existing?.quantity ?? 0;
    const totalQty = currentQty + dto.quantity;

    if (totalQty > product.quantityInStock) {
      throw new BadRequestException(MESSAGES.INSUFFICIENT_STOCK);
    }

    return this.cartRepository.addItem(user, product, dto.quantity);
  }

  /**
   * update an item in the cart.
   */
  async updateItem(user: User, itemId: string, dto: UpdateCartItem): Promise<CartItem> {
    const item = await this.findCartItem(user, itemId);

    // updateItem replaces quantity entirely — check against stock directly
    if (dto.quantity > item.product.quantityInStock) {
      throw new BadRequestException(MESSAGES.INSUFFICIENT_STOCK);
    }

    if (dto.quantity < NUMERIC.QUANTITY_MIN) {
      throw new BadRequestException(MESSAGES.INVALID_QUANTITY);
    }

    return this.cartRepository.updateQuantity(item, dto.quantity);
  }

  /**
   * remove an item from the cart.
   */
  async removeItem(user: User, itemId: string): Promise<void> {
    const item = await this.findCartItem(user, itemId);
    await this.cartRepository.removeItem(item);
  }

  /**
   * clear the entire cart for a user.
   */
  async clearCart(user: User): Promise<void> {
    await this.cartRepository.clearCart(user);
  }

  /**
   * merge guest session cart into authenticated user cart.
   * for each guest item:
   *  - resolve product and validate it exists
   *  - compute merged quantity = max(existingQty, guestQty)
   *  - clamp merged quantity to stock if it exceeds available stock
   */
  async mergeSessionCart(userId: string, guestItems: GuestCartItemDto[]): Promise<void> {
    const user = await this.usersService.findOne({ id: userId });

    const resolvedItems = await Promise.all(
      guestItems.map(async (item) => {
        const product = await this.productsService.findOne({ id: item.productId });

        // clamp quantity to available stock before merging
        const quantity = Math.min(item.quantity, product.quantityInStock);

        return { product, quantity };
      }),
    );

    // filter out items where stock is 0
    const validItems = resolvedItems.filter((item) => item.quantity > 0);

    await this.cartRepository.mergeSessionCart(user, validItems);
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private async findCartItem(user: User, itemId: string): Promise<CartItem> {
    const items = await this.cartRepository.findByUser(user);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException(MESSAGES.CART_ITEM_NOT_FOUND);

    return item;
  }
}
