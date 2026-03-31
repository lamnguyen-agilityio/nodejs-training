import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Expose, plainToInstance } from 'class-transformer';

import { ProductResponseDto } from '@/modules/products/dtos';

import type { CartItem } from '../entities/cart-item.entity';

export class CartItemResponseDto {
  @ApiProperty({ example: '019d2eb0-cad6-72e1-9149-cbec8767a59b' })
  @Expose()
  id: string;

  @ApiProperty({ example: 2 })
  @Expose()
  quantity: number;

  @ApiProperty({ type: () => ProductResponseDto })
  @Expose()
  @Type(() => ProductResponseDto)
  product: ProductResponseDto;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  static from(item: CartItem): CartItemResponseDto {
    return plainToInstance(CartItemResponseDto, item, { excludeExtraneousValues: true });
  }

  static fromMany(items: CartItem[]): CartItemResponseDto[] {
    return items.map(CartItemResponseDto.from);
  }
}
