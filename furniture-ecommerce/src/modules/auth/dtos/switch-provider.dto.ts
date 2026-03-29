import { IsEnum } from 'class-validator';

import { AuthProvider } from '@/common/enums';

/**
 * validated by ValidationPipe before reaching the controller.
 */
export class SwitchProviderDto {
  @IsEnum(AuthProvider)
  provider: AuthProvider;
}
