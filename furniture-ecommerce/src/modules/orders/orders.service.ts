import { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { MESSAGES } from '@/common/constants';
import { OrderStatus, Role } from '@/common/enums';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import { CartsRepository } from '@/modules/carts/carts.repository';
import { ProductEntity } from '@/modules/products/entities/product.entity';
import { UsersService } from '@/modules/users/users.service';

import type {
  FindAllOrdersAdminDto,
  FindOrdersDto,
  PaginatedOrders,
  OrderWithItems,
} from './interfaces';
import { assertValidTransition } from './order-status.machine';
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(
    private readonly em: EntityManager,
    private readonly ordersRepository: OrdersRepository,
    private readonly cartsRepository: CartsRepository,
    private readonly usersService: UsersService,
  ) {}

  /**
   * checkout flow — fully transactional:
   *  1. validate cart not empty.
   *  2. atomic stock deduction per product (conditional UPDATE, 0 rows = out of stock).
   *  3. insert order + order_items.
   *  4. clear cart.
   * all steps share the same DB transaction — any failure rolls back everything.
   */
  async createFromCart(authUser: AuthenticatedUser): Promise<OrderWithItems> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    const cartItems = await this.cartsRepository.findByUser(user);

    if (!cartItems.length) {
      throw new BadRequestException(MESSAGES.CART_EMPTY);
    }

    return this.em.transactional(async (txEm) => {
      // ── 1. atomic stock reservation ───────────────────────────────────────
      // use conditional UPDATE to avoid race conditions:
      // only deducts if current stock >= requested quantity.
      for (const item of cartItems) {
        const affected = await txEm.nativeUpdate(
          ProductEntity,
          {
            id: item.product.id,
            quantityInStock: { $gte: item.quantity },
          },
          { quantityInStock: item.product.quantityInStock - item.quantity },
        );

        if (affected === 0) {
          throw new BadRequestException(`${item.product.name}: ${MESSAGES.INSUFFICIENT_STOCK}`);
        }
      }

      // ── 2. compute total using integer cents to avoid float precision loss ─
      const orderItems = cartItems.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        priceAtPurchase: String(item.product.price),
      }));

      const totalCents = orderItems.reduce((sum, item) => {
        const priceCents = Math.round(Number(item.priceAtPurchase) * 100);
        return sum + priceCents * item.quantity;
      }, 0);

      const totalAmount = (totalCents / 100).toFixed(2);

      // ── 3. insert order + order_items using transactional em ──────────────
      const order = await this.ordersRepository.createWithManager(
        txEm,
        user,
        orderItems,
        totalAmount,
      );

      // ── 4. clear cart within the same transaction ─────────────────────────
      await this.cartsRepository.clearCartWithManager(txEm, user);

      return order;
    });
  }

  /**
   * finds orders for the authenticated user.
   */
  async findByUser(authUser: AuthenticatedUser, dto: FindOrdersDto): Promise<PaginatedOrders> {
    const user = await this.usersService.findOne({ id: authUser.userId });

    return this.ordersRepository.findByUser(user, dto);
  }

  /**
   * finds a single order by its ID, ensuring the user has access to it.
   */
  async findOneByUser(authUser: AuthenticatedUser, orderId: string): Promise<OrderWithItems> {
    const order = await this.findOne(orderId);
    if (order.user.id !== authUser.userId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }

    return order;
  }

  /**
   * finds all orders, optionally filtered by status for admin use.
   */
  async findAll(dto: FindAllOrdersAdminDto): Promise<PaginatedOrders> {
    return this.ordersRepository.findAll(dto);
  }

  /**
   * updates the status of an order, ensuring the transition is valid.
   */
  async updateStatus(orderId: string, newStatus: OrderStatus, role: Role): Promise<OrderWithItems> {
    const order = await this.findOne(orderId);
    assertValidTransition(order.status, newStatus, role);

    return this.ordersRepository.updateStatus(order, newStatus);
  }

  /**
   * finds an order by its ID for the admin.
   */
  async findOneAdmin(orderId: string): Promise<OrderWithItems> {
    return this.findOne(orderId);
  }

  /**
   * finds an order by its ID.
   */
  private async findOne(orderId: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findOne(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    return order;
  }
}
