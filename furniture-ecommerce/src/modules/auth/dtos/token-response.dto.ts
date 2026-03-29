import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

/**
 * stores token — accessToken for requests
 */
export class TokenResponseDto {
  @ApiProperty({
    description: 'Internal access token (JWT). Use as Bearer token on all subsequent requests.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @Expose()
  accessToken: string;

  @ApiProperty({
    description: 'Access token lifetime in seconds',
    example: 900,
  })
  @IsNumber()
  @Expose()
  expiresIn: number;

  static from(accessToken: string, expiresIn: number): TokenResponseDto {
    return plainToInstance(TokenResponseDto, { accessToken, expiresIn });
  }
}
