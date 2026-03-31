import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { LENGTH, NUMERIC } from '@/common/constants';

export class FindProductsQueryDto {
  @ApiPropertyOptional({ example: 'sofa' })
  @IsOptional()
  @IsString()
  @MaxLength(LENGTH.SHORT_MAX)
  search?: string;

  @ApiPropertyOptional({ example: 'living-room' })
  @IsOptional()
  @IsString()
  @MaxLength(LENGTH.SHORT_MAX)
  categorySlug?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(NUMERIC.PRICE_MIN)
  minPrice?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(NUMERIC.PRICE_MIN)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 1, default: NUMERIC.PAGE_MIN })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(NUMERIC.PAGE_MIN)
  page?: number;

  @ApiPropertyOptional({ example: NUMERIC.LIMIT_DEFAULT, default: NUMERIC.LIMIT_DEFAULT })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(NUMERIC.LIMIT_MIN)
  @Max(NUMERIC.LIMIT_MAX)
  limit?: number;
}
