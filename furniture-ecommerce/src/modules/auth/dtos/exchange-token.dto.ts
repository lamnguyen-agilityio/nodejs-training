import { IsString } from 'class-validator';

/**
 * sends the provider JWT (Clerk or Auth0) to exchange for internal tokens.
 */
export class ExchangeTokenDto {
  @IsString()
  providerToken: string;
}
