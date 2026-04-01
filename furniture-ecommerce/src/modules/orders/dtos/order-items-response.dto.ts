import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

import { calculateTotal } from '@/common/utils/price.util';

import type { OrderItem } from '../entities/order-item.entity';

export class OrderItemResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614173456' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Modern Sofa' })
  @Expose()
  productName: string;

  @ApiProperty({ example: '1299.99' })
  @Expose()
  priceAtPurchase: string;

  @ApiProperty({ example: 2 })
  @Expose()
  quantity: number;

  @ApiProperty({ example: '2599.98' })
  @Expose()
  subtotal: string;

  static from(item: OrderItem): OrderItemResponseDto {
    return plainToInstance(
      OrderItemResponseDto,
      {
        id: item.id,
        productName: item.product.name,
        priceAtPurchase: item.priceAtPurchase,
        quantity: item.quantity,
        subtotal: calculateTotal(Number(item.priceAtPurchase), item.quantity),
      },
      { excludeExtraneousValues: true },
    );
  }
}
