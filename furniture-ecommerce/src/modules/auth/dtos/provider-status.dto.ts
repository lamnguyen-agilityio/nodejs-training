import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';
import { IsEnum } from 'class-validator';

import { AuthProvider } from '@/common/enums';

/**
 * tells callers which provider is currently active and what is available.
 */
export class ProviderStatusDto {
  @ApiProperty({
    description: 'Currently active auth provider',
    enum: AuthProvider,
    example: AuthProvider.Clerk,
  })
  @IsEnum(AuthProvider)
  @Expose()
  active: AuthProvider;

  @ApiProperty({
    description: 'All registered auth providers',
    enum: AuthProvider,
    isArray: true,
    example: [AuthProvider.Clerk, AuthProvider.Auth0],
  })
  @IsEnum(AuthProvider, { each: true })
  @Expose()
  available: AuthProvider[];

  static from(status: { active: AuthProvider; available: AuthProvider[] }): ProviderStatusDto {
    return plainToInstance(ProviderStatusDto, status);
  }
}
