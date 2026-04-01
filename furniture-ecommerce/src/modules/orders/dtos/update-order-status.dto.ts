import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { OrderStatus } from '@/common/enums';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.Paid })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
