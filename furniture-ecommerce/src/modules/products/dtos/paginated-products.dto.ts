import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

import { PaginationDto } from '@/common/dtos';

import { ProductResponseDto } from './product-response.dto';
import type { Product } from '../entities/product.entity';

export class PaginatedProductsDto extends PaginationDto {
  @ApiProperty({ type: [ProductResponseDto] })
  @Expose()
  items: ProductResponseDto[];

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
