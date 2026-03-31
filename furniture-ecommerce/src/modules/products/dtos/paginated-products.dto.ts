import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

import { NUMERIC } from '@/common/constants';

import { ProductResponseDto } from './product-response.dto';
import type { Product } from '../entities/product.entity';

export class PaginatedProductsDto {
  @ApiProperty({ type: [ProductResponseDto] })
  @Expose()
  items: ProductResponseDto[];

  @ApiProperty({ example: 100 })
  @Expose()
  total: number;

  @ApiProperty({ example: 1 })
  @Expose()
  page: number;

  @ApiProperty({ example: NUMERIC.LIMIT_DEFAULT })
  @Expose()
  limit: number;

  static from(
    products: Product[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedProductsDto {
    return plainToInstance(PaginatedProductsDto, {
      items: products.map(ProductResponseDto.from),
      total,
      page,
      limit,
    });
  }
}
