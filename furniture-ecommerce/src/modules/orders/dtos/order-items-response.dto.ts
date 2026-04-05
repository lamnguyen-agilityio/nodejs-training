import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

import { NUMERIC } from '@/common/constants';

import { OrderWithItemsAndUser } from '../interfaces';

export class OrderItemResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614173456' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  @Expose()
  userEmail: string;

  @ApiProperty({ example: 'Modern Sofa' })
  @Expose()
  productName: string;

  @ApiProperty({ example: 'https://i.ibb.co/abc123/sofa.jpg' })
  @Expose()
  productImage: string;

  @ApiProperty({ example: '1299.99' })
  @Expose()
  priceAtPurchase: string;

  @ApiProperty({ example: 2 })
  @Expose()
  quantity: number;

  @ApiProperty({ example: '2599.98' })
  @Expose()
  subtotal: string;

  static from(item: OrderWithItemsAndUser): OrderItemResponseDto {
    return plainToInstance(
      OrderItemResponseDto,
      {
        id: item.id,
        userEmail: item.userEmail,
        productName: item.product.name,
        productImage: item.product.image,
        priceAtPurchase: item.priceAtPurchase,
        quantity: item.quantity,
        subtotal: (Number(item.priceAtPurchase) * item.quantity).toFixed(NUMERIC.DECIMAL_PLACES),
      },
      { excludeExtraneousValues: true },
    );
  }
}
