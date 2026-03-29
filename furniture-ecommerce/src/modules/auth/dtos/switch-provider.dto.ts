import { IsEnum } from 'class-validator';

import { AuthProvider } from '@/enums';

/**
 * request body for POST /auth/provider/switch.
 * validated by ValidationPipe before reaching the controller.
 */
export class SwitchProviderDto {
  @IsEnum(AuthProvider)
  provider: AuthProvider;
}
