import { Expose } from 'class-transformer';

/**
 * stores token — accessToken for requests
 */
export class TokenResponseDto {
  @Expose()
  accessToken: string;
}
