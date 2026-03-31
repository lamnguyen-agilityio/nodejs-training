import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Allow,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { LENGTH, NUMERIC } from '@/common/constants';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Modern Sofa' })
  @IsOptional()
  @IsString()
  @MinLength(LENGTH.SHORT_MIN)
  @MaxLength(LENGTH.SHORT_MAX)
  name?: string;

  @ApiPropertyOptional({ example: 'A comfortable 3-seater sofa' })
  @IsOptional()
  @IsString()
  @MaxLength(LENGTH.DESCRIPTION)
  description?: string;

  @ApiPropertyOptional({ example: 1299.99 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(NUMERIC.PRICE_MIN)
  price?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(NUMERIC.QUANTITY_MIN)
  quantityInStock?: number;

  @ApiPropertyOptional({ example: '019d2eb0-cad6-72e1-9149-cbec8767a59b' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Allow()
  image?: unknown;
}

export class UpdateProductFormDto extends UpdateProductDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'New product image file (JPEG, PNG, WEBP — max 5MB). Omit to keep current image.',
  })
  declare image: Express.Multer.File | undefined;
}
