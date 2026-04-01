import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

import { Role } from '@/common/enums';
import { Auth, CurrentUser } from '@/modules/auth/decorators';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';

import {
  FindAllOrdersQueryDto,
  OrderResponseDto,
  PaginatedOrdersDto,
  UpdateOrderStatusDto,
} from './dtos';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
@Auth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Checkout — create order from cart',
    description:
      'Creates an order from all items in the cart. ' +
      'Validates stock, snapshots price, deducts stock, and clears the cart.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ description: 'Cart is empty' })
  async createFromCart(@CurrentUser() authUser: AuthenticatedUser): Promise<OrderResponseDto> {
    const order = await this.ordersService.createFromCart(authUser);

    return OrderResponseDto.from(order);
  }

  @Get()
  @ApiOperation({
    summary: 'List orders',
    description: 'Users see their own orders. Admins see all orders with optional status filter.',
  })
  @ApiOkResponse({ type: PaginatedOrdersDto })
  async findOrders(
    @CurrentUser() authUser: AuthenticatedUser,
    @Query() query: FindAllOrdersQueryDto,
  ): Promise<PaginatedOrdersDto> {
    if (authUser.role === Role.Admin) {
      const { items, total, page, limit } = await this.ordersService.findAll(query);
      return PaginatedOrdersDto.from(items, total, page, limit);
    }
    const { items, total, page, limit } = await this.ordersService.findByUser(authUser, query);

    return PaginatedOrdersDto.from(items, total, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order details',
    description: 'Users can only view their own orders. Admins can view any order.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiForbiddenResponse({ description: 'Order does not belong to the user' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async findOne(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderResponseDto> {
    if (authUser.role === Role.Admin) {
      const order = await this.ordersService.findOneAdmin(id);
      return OrderResponseDto.from(order);
    }
    const order = await this.ordersService.findOneByUser(authUser, id);

    return OrderResponseDto.from(order);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update order status',
    description:
      'Users can only cancel their own pending orders. ' +
      'Admins can drive the full fulfillment lifecycle.',
  })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiForbiddenResponse({ description: 'Order does not belong to the user' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid status transition' })
  async updateStatus(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    if (authUser.role !== Role.Admin) {
      await this.ordersService.findOneByUser(authUser, id);
    }
    const order = await this.ordersService.updateStatus(id, dto.status, authUser.role);

    return OrderResponseDto.from(order);
  }
}
