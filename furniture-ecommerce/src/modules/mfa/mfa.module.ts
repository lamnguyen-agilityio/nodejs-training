import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';

import { OTP_CHANNELS } from './constants';
import { MfaGuard } from './guards/mfa.guard';
import { MfaController } from './mfa.controller';
import { MfaRepository } from './mfa.repository';
import { MfaService } from './mfa.service';
import { SmsOtpChannel } from './providers/sms-otp.channel';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [MfaController],
  providers: [
    SmsOtpChannel,
    {
      provide: OTP_CHANNELS,
      useFactory: (sms: SmsOtpChannel) => [sms],
      inject: [SmsOtpChannel],
    },
    MfaRepository,
    MfaService,
    MfaGuard,
  ],
  exports: [MfaGuard, MfaService],
})
export class MfaModule {}
