import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

import { PaginationDto } from '@/common/dtos';

import type { OrderWithItems } from '../interfaces';
import { OrderResponseDto } from './order-response.dto';

export class PaginatedOrdersDto extends PaginationDto {
  @ApiProperty({ type: [OrderResponseDto] })
  @Expose()
  items: OrderResponseDto[];

  static from(
    orders: OrderWithItems[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedOrdersDto {
    return plainToInstance(
      PaginatedOrdersDto,
      {
        items: orders.map(OrderResponseDto.from),
        total,
        page,
        limit,
      },
      { excludeExtraneousValues: true },
    );
  }
}
