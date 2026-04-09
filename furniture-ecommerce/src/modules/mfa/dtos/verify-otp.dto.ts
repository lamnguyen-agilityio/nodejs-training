import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

import { OPT_LENGTH } from '../constants';

export class VerifyOtpDto {
  @ApiProperty({ example: '482910', description: `${OPT_LENGTH}-digit OTP code` })
  @IsString()
  @IsNotEmpty()
  @Length(OPT_LENGTH, OPT_LENGTH, { message: `OTP must be exactly ${OPT_LENGTH} digits` })
  @Matches(new RegExp(`^\\d{${OPT_LENGTH}}$`), { message: 'OTP must contain only digits' })
  code: string;
}
