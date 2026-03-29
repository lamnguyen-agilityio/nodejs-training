import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * sends the provider JWT (Clerk or Auth0) to exchange for internal tokens.
 */
export class ExchangeTokenDto {
  @ApiProperty({
    description:
      'Raw JWT issued by the active auth provider (Clerk or Auth0). ' +
      'Obtain this token from the provider SDK after social login.',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  providerToken: string;
}
