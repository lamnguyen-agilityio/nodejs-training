import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';

import type { Category } from '../entities/category.entity';

export class CategoryResponseDto {
  @ApiProperty({ example: '019d2eb0-cad6-72e1-9149-cbec8767a59b' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Living Room' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'living-room' })
  @Expose()
  slug: string;

  @ApiPropertyOptional({ example: 'Sofas, chairs and more' })
  @Expose()
  description: string | null;

  @ApiPropertyOptional({ example: 'https://i.ibb.co/abc123/sofa.jpg' })
  @Expose()
  image: string;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  static from(category: Category): CategoryResponseDto {
    return plainToInstance(CategoryResponseDto, category, { excludeExtraneousValues: true });
  }

  static fromMany(categories: Category[]): CategoryResponseDto[] {
    return categories.map(CategoryResponseDto.from);
  }
}
