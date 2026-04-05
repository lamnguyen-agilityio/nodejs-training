import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { Retryable } from '@/common/database';
import { OrderStatus } from '@/common/enums';
import { resolvePagination } from '@/common/utils';
import type { User } from '@/modules/users/entities/user.entity';

import { OrderItemEntity, type OrderItem } from './entities/order-item.entity';
import { OrderEntity, type Order } from './entities/order.entity';
import type {
  FindAllOrdersAdminDto,
  FindOrdersDto,
  PaginatedOrders,
  OrderWithItems,
  OrderItemData,
  OrderWithItemsAndUser,
} from './interfaces';

@Injectable()
export class OrdersRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OrdersRepository.name);
  }

  /**
   * finds all orders for a given user with pagination.
   */
  async findByUser(user: User, dto: FindOrdersDto): Promise<PaginatedOrders> {
    const { page, limit, offset } = resolvePagination(dto);

    const [orders, total] = await this.em.findAndCount(
      OrderEntity,
      { user },
      { populate: ['user'], orderBy: { createdAt: 'DESC' }, limit, offset },
    );

    const items = await this.attachItems(orders);

    return { items, total, page, limit };
  }

  /**
   * finds a single order by its id.
   */
  async findOne(id: string): Promise<OrderWithItems | null> {
    const order = await this.em.findOne(OrderEntity, { id }, { populate: ['user'] });
    if (!order) return null;
    const [withItems] = await this.attachItems([order]);

    return withItems ?? null;
  }

  /**
   * finds all orders for admin with pagination.
   */
  async findAll(dto: FindAllOrdersAdminDto): Promise<PaginatedOrders> {
    const { page, limit, offset } = resolvePagination(dto);

    const where: { status?: OrderStatus } = {};
    if (dto.status) where.status = dto.status;

    const [orders, total] = await this.em.findAndCount(OrderEntity, where, {
      populate: ['user'],
      orderBy: { createdAt: 'DESC' },
      limit,
      offset,
    });

    const items = await this.attachItems(orders);

    return { items, total, page, limit };
  }

  /**
   * creates a new order for a user.
   */
  @Retryable()
  async create(
    user: User,
    orderItems: OrderItemData[],
    totalAmount: string,
  ): Promise<OrderWithItems> {
    // clear any pending changes from previous failed attempts
    this.em.clear();

    const order = this.em.create(OrderEntity, {
      user,
      status: OrderStatus.Pending,
      totalAmount,
    });
    this.em.persist(order);

    for (const item of orderItems) {
      const orderItem = this.em.create(OrderItemEntity, {
        order,
        product: item.product,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
      });
      this.em.persist(orderItem);
    }

    await this.em.flush();
    const created = await this.findOne(order.id);

    if (!created) {
      throw new Error(`Order ${order.id} not found after creation`);
    }

    return created;
  }

  /**
   * updates the status of an order.
   */
  @Retryable()
  async updateStatus(order: OrderWithItems, status: OrderStatus): Promise<OrderWithItems> {
    this.em.assign(order.entity, { status });
    await this.em.flush();
    const updated = await this.findOne(order.id);

    if (!updated) {
      throw new Error(`Order ${order.id} not found after status update`);
    }

    return updated;
  }

  /**
   * create order + order items using a provided transactional EntityManager.
   * called from OrdersService.createFromCart to share the transaction context.
   */
  async createWithManager(
    txEm: EntityManager,
    user: User,
    orderItems: OrderItemData[],
    totalAmount: string,
  ): Promise<OrderWithItems> {
    const order = txEm.create(OrderEntity, {
      user,
      status: OrderStatus.Pending,
      totalAmount,
    });
    txEm.persist(order);

    for (const item of orderItems) {
      const orderItem = txEm.create(OrderItemEntity, {
        order,
        product: item.product,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
      });
      txEm.persist(orderItem);
    }

    await txEm.flush();
    return (await this.findOne(order.id))!;
  }

  /**
   * private helper to attach order items to orders.
   */
  private async attachItems(orders: Order[]): Promise<OrderWithItems[]> {
    if (!orders.length) return [];

    const orderIds = orders.map((o) => o.id);

    const allItems = await this.em.find(
      OrderItemEntity,
      { order: { $in: orderIds } },
      { populate: ['product', 'product.category'] },
    );

    const itemsByOrderId = new Map<string, OrderItem[]>();
    for (const item of allItems) {
      const orderId = item.order.id;
      const orderItem = { ...item, userEmail: item.order.user.email };

      if (!itemsByOrderId.has(orderId)) itemsByOrderId.set(orderId, []);
      itemsByOrderId.get(orderId)!.push(orderItem);
    }

    return orders.map((order) => ({
      entity: order,
      orderItems: (itemsByOrderId.get(order.id) as OrderWithItemsAndUser[]) ?? [],
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      user: order.user,
    }));
  }
}
