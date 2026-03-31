import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

import { CartItemResponseDto } from './cart-item-response.dto';

export class CartResponseDto {
  @ApiProperty({ type: [CartItemResponseDto] })
  @Expose()
  items: CartItemResponseDto[];

  @ApiProperty({ example: 3 })
  @Expose()
  totalItems: number;

  @ApiProperty({ example: 2599.98 })
  @Expose()
  totalAmount: number;

  static from(
    items: CartItemResponseDto[],
    totalItems: number,
    totalAmount: number,
  ): CartResponseDto {
    return plainToInstance(
      CartResponseDto,
      { items, totalItems, totalAmount },
      { excludeExtraneousValues: true },
    );
  }
}
