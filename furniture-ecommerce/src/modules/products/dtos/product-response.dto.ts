import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

import type { Product } from '../entities/product.entity';

export class ProductResponseDto {
  @ApiProperty({ example: '019d2eb0-cad6-72e1-9149-cbec8767a59b' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Modern Sofa' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'modern-sofa' })
  @Expose()
  slug: string;

  @ApiProperty({ example: '1299.99' })
  @Expose()
  price: string;

  @ApiPropertyOptional({
    example: 'https://i.ibb.co/abc123/sofa.jpg',
    description: 'Hosted image URL returned after server upload',
  })
  @Expose()
  image: string | null;

  @ApiProperty({ example: 10 })
  @Expose()
  quantityInStock: number;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  static from(product: Product): ProductResponseDto {
    return plainToInstance(ProductResponseDto, product, { excludeExtraneousValues: true });
  }
}

export class ProductResponseDetailDto extends ProductResponseDto {
  @ApiPropertyOptional({ example: 'A comfortable 3-seater sofa' })
  @Expose()
  description: string | null;

  static from(product: Product): ProductResponseDetailDto {
    return plainToInstance(ProductResponseDetailDto, product, { excludeExtraneousValues: true });
  }
}
