import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * represents the pagination information for a set of items.
 */
export class PaginationDto {
  @ApiProperty({ example: 10 })
  @Expose()
  total: number;

  @ApiProperty({ example: 1 })
  @Expose()
  page: number;

  @ApiProperty({ example: 20 })
  @Expose()
  limit: number;
}
