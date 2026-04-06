import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength, Allow } from 'class-validator';

import { LENGTH } from '@/common/constants';

export class CreateCategoryDto {
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

  @Allow()
  image?: unknown;
}

export class CreateCategoryFormDto extends CreateCategoryDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Category image file (JPEG, PNG, WEBP — max 5MB)',
  })
  declare image: Express.Multer.File;
}
