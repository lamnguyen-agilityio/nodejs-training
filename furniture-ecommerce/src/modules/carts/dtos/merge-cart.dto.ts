import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';

import { GuestCartItemDto } from './quest-cart-item.dto';

/**
 * payload sent by the client after login to sync guest session cart
 * into the authenticated user's cart.
 * rule: if the same product exists in both, keep the higher quantity.
 */
export class MergeCartDto {
  @ApiProperty({
    type: [GuestCartItemDto],
    description: 'Cart items stored in client session before login',
    example: [{ productId: '019d2eb0-cad6-72e1-9149-cbec8767a59b', quantity: 2 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestCartItemDto)
  items: GuestCartItemDto[];
}
