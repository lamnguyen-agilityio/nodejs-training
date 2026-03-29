import { Expose, plainToInstance } from 'class-transformer';
import { IsString } from 'class-validator';

/**
 * stores token — accessToken for requests
 */
export class TokenResponseDto {
  @Expose()
  @IsString()
  accessToken: string;

  static from(accessToken: string): TokenResponseDto {
    return plainToInstance(TokenResponseDto, {
      accessToken,
    });
  }
}
