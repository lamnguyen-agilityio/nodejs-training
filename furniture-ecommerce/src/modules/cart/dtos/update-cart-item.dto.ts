import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

import { NUMERIC } from '@/common/constants';
import type { UpdateCartItem } from '@/modules/cart/interfaces';

export class UpdateCartItemDto implements UpdateCartItem {
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(NUMERIC.QUANTITY_MIN)
  quantity: number;
}
