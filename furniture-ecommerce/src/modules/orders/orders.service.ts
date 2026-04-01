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
    private readonly ordersRepository: OrdersRepository,
    private readonly cartsRepository: CartsRepository,
    private readonly usersService: UsersService,
  ) {}

  /**
   * creates an order from the user's cart.
   */
  async createFromCart(authUser: AuthenticatedUser): Promise<OrderWithItems> {
    const user = await this.usersService.findOne({ id: authUser.userId });
    const cartItems = await this.cartsRepository.findByUser(user);

    if (!cartItems.length) {
      throw new BadRequestException(MESSAGES.CART_EMPTY);
    }

    // check stock and map cart items to order items
    const orderItems = cartItems.map((item) => {
      if (item.quantity > item.product.quantityInStock) {
        throw new BadRequestException(`${item.product.name}: ${MESSAGES.INSUFFICIENT_STOCK}`);
      }

      return {
        product: item.product,
        quantity: item.quantity,
        priceAtPurchase: String(item.product.price),
      };
    });

    const totalAmount = orderItems
      .reduce((sum, item) => sum + Number(item.priceAtPurchase) * item.quantity, 0)
      .toFixed(NUMERIC.DECIMAL_PLACES);

    const order = await this.ordersRepository.create(user, orderItems, totalAmount);

    // deduct stock after successful order creation
    for (const item of cartItems) {
      item.product.quantityInStock -= item.quantity;
    }
    await this.cartsRepository.clearCart(user);

    return order;
  }

  /**
   * finds orders for the authenticated user.
   */
  async findByUser(authUser: AuthenticatedUser, dto: FindOrdersDto): Promise<PaginatedOrders> {
    const user = await this.usersService.findOne({ id: authUser.userId });

    return this.ordersRepository.findByUser(user, dto);
  }

  /**
   * finds an order by its ID for the authenticated user.
   */
  async findOneByUser(authUser: AuthenticatedUser, orderId: string): Promise<OrderWithItems> {
    const order = await this.findOne(orderId);
    if (order.user.id !== authUser.userId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }

    return order;
  }

  /**
   * finds all orders for the admin.
   */
  async findAll(dto: FindAllOrdersAdminDto): Promise<PaginatedOrders> {
    return this.ordersRepository.findAll(dto);
  }

  /**
   * updates the status of an order.
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
