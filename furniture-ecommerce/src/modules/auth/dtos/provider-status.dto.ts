import { Expose } from 'class-transformer';
import { IsEnum } from 'class-validator';

import { AuthProvider } from '@/enums';

/**
 * response body for GET /auth/provider.
 * tells callers which provider is currently active and what is available.
 */
export class ProviderStatusDto {
  @IsEnum(AuthProvider)
  @Expose()
  active: AuthProvider;

  @IsEnum(AuthProvider, { each: true })
  @Expose()
  available: AuthProvider[];
}
