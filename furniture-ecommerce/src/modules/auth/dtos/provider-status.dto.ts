import { Expose, plainToInstance } from 'class-transformer';
import { IsEnum } from 'class-validator';

import { AuthProvider } from '@/common/enums';

/**
 * tells callers which provider is currently active and what is available.
 */
export class ProviderStatusDto {
  @IsEnum(AuthProvider)
  @Expose()
  active: AuthProvider;

  @IsEnum(AuthProvider, { each: true })
  @Expose()
  available: AuthProvider[];

  static from(status: { active: AuthProvider; available: AuthProvider[] }): ProviderStatusDto {
    return plainToInstance(ProviderStatusDto, status);
  }
}
