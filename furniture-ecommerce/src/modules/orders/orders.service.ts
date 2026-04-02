import { EntityManager } from '@mikro-orm/postgresql';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { MESSAGES, NUMERIC } from '@/common/constants';
import { OrderStatus, Role } from '@/common/enums';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import { CartsRepository } from '@/modules/carts/carts.repository';
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
   * checkout flow — transactional:
   *  1. validate cart not empty.
   *  2. insert order + order_items (no stock deduction here).
   *  3. clear cart.
   *
   * stock is deducted later at POST /payments/:orderId/checkout
   * using an atomic conditional UPDATE to handle race conditions.
   * if payment expires or fails, stock is rolled back by the webhook handler.
   */
  async createFromCart(authUser: AuthenticatedUser): Promise<OrderWithItems> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    const cartItems = await this.cartsRepository.findByUser(user);

    if (!cartItems.length) {
      throw new BadRequestException(MESSAGES.CART_EMPTY);
    }

    return this.em.transactional(async (txEm) => {
      // ── compute total using integer cents to avoid float precision loss ───
      const orderItems = cartItems.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        priceAtPurchase: String(item.product.price),
      }));

      const totalCents = orderItems.reduce((sum, item) => {
        const priceCents = Math.round(Number(item.priceAtPurchase) * 100);
        return sum + priceCents * item.quantity;
      }, 0);

      const totalAmount = (totalCents / 100).toFixed(NUMERIC.DECIMAL_PLACES);

      // ── insert order + order_items ─────────────────────────────────────────
      const order = await this.ordersRepository.createWithManager(
        txEm,
        user,
        orderItems,
        totalAmount,
      );

      // ── clear cart within the same transaction ────────────────────────────
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
