import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

import { NUMERIC } from '@/common/constants';

/**
 * a single guest cart item sent from session storage on the client.
 */
export class GuestCartItemDto {
  @ApiProperty({ example: '019d2eb0-cad6-72e1-9149-cbec8767a59b' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(NUMERIC.QUANTITY_MIN)
  quantity: number;
}
