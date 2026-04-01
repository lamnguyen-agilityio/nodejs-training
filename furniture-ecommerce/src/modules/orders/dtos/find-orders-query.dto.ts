import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { NUMERIC } from '@/common/constants';
import { OrderStatus } from '@/common/enums';

import type { FindOrdersDto, FindAllOrdersAdminDto } from '../interfaces';

export class FindOrdersQueryDto implements FindOrdersDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(NUMERIC.PAGE_MIN)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(NUMERIC.LIMIT_MIN)
  @Max(NUMERIC.LIMIT_MAX)
  limit?: number;
}

export class FindAllOrdersQueryDto extends FindOrdersQueryDto implements FindAllOrdersAdminDto {
  @ApiPropertyOptional({ enum: OrderStatus, example: OrderStatus.Pending })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
