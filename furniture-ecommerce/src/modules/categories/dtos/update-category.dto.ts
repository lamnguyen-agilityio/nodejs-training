import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength, Allow } from 'class-validator';

import { LENGTH } from '@/common/constants';

export class UpdateCategoryDto {
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

  @Allow()
  image?: unknown;
}

export class UpdateCategoryFormDto extends UpdateCategoryDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'New category image file (JPEG, PNG, WEBP — max 5MB). Omit to keep current image.',
  })
  declare image?: Express.Multer.File;
}
