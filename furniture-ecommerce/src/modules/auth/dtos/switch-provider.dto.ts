import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { AuthProvider } from '@/common/enums';

/**
 * validated by ValidationPipe before reaching the controller.
 */
export class SwitchProviderDto {
  @ApiProperty({
    description: 'Target auth provider to switch to',
    enum: AuthProvider,
    example: AuthProvider.Auth0,
  })
  @IsEnum(AuthProvider)
  provider: AuthProvider;
}
