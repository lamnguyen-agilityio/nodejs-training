import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance, Type } from 'class-transformer';

import { OrderStatus } from '@/common/enums';

import type { OrderWithItems } from '../interfaces';
import { OrderItemResponseDto } from './order-items-response.dto';

export class OrderResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose()
  id: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.Pending })
  @Expose()
  status: OrderStatus;

  @ApiProperty({ example: '2599.98' })
  @Expose()
  totalAmount: string;

  @ApiProperty({ type: [OrderItemResponseDto] })
  @Expose()
  @Type(() => OrderItemResponseDto)
  items: OrderItemResponseDto[];

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  static from(order: OrderWithItems): OrderResponseDto {
    const items = order.orderItems.map(OrderItemResponseDto.from);

    return plainToInstance(
      OrderResponseDto,
      {
        id: order.id,
        status: order.status,
        totalAmount: order.totalAmount,
        items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
