import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { LENGTH } from '@/common/constants';

import type { UpdateCategory } from '../interfaces';

export class UpdateCategoryDto implements UpdateCategory {
  @ApiPropertyOptional({ example: 'Living Room' })
  @IsOptional()
  @IsString()
  @MinLength(LENGTH.SHORT_MIN)
  @MaxLength(LENGTH.SHORT_MAX)
  name?: string;

  @ApiPropertyOptional({ example: 'Sofas, chairs and more' })
  @IsOptional()
  @IsString()
  @MaxLength(LENGTH.DESCRIPTION)
  description?: string;
}
