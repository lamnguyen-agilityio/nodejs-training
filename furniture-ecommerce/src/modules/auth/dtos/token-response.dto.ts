import { Expose, plainToInstance } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

/**
 * stores token — accessToken for requests
 */
export class TokenResponseDto {
  @Expose()
  @IsString()
  accessToken: string;

  @Expose()
  @IsNumber()
  expiresIn: number;

  static from(accessToken: string, expiresIn: number): TokenResponseDto {
    return plainToInstance(TokenResponseDto, {
      accessToken,
      expiresIn,
    });
  }
}
