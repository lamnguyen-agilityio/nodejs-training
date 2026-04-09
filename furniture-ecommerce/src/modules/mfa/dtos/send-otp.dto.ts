import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { MfaMethod } from '@/common/enums';

export class SendOtpDto {
  @ApiPropertyOptional({
    enum: MfaMethod,
    default: MfaMethod.Sms,
    description: 'Delivery channel — sms (default) | email',
  })
  @IsOptional()
  @IsEnum(MfaMethod)
  method?: MfaMethod = MfaMethod.Sms;
}
