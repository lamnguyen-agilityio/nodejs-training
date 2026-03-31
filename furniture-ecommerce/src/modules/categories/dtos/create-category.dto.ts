import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { LENGTH } from '@/common/constants';

import type { CreateCategory } from '../interfaces';

export class CreateCategoryDto implements CreateCategory {
  @ApiProperty({ example: 'Living Room', description: 'Category name' })
  @IsString()
  @MinLength(LENGTH.SHORT_MIN)
  @MaxLength(LENGTH.SHORT_MAX)
  name: string;

  @ApiPropertyOptional({ example: 'Sofas, chairs and more' })
  @IsOptional()
  @IsString()
  @MaxLength(LENGTH.DESCRIPTION)
  description?: string;
}
