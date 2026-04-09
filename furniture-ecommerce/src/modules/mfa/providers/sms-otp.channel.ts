import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import Twilio from 'twilio';

import { MfaMethod } from '@/common/enums';
import type { AppConfig } from '@/config';

import { OTP_TTL_MINUTES } from '../constants';
import { OtpChannel } from '../otp-channel.abstract';

@Injectable()
export class SmsOtpChannel extends OtpChannel {
  readonly method = MfaMethod.Sms;

  private readonly client: Twilio.Twilio;
  private readonly fromNumber: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(SmsOtpChannel.name);

    const config = this.configService.getOrThrow<AppConfig>('app');
    this.client = Twilio(config.twilioAccountSid, config.twilioAuthToken);
    this.fromNumber = config.twilioPhoneNumber;
  }

  async send(phoneNumber: string, code: string): Promise<void> {
    this.logger.info({ phoneNumber }, 'Sending MFA OTP via SMS');

    await this.client.messages.create({
      body: `Your verification code is: ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      from: this.fromNumber,
      to: phoneNumber,
    });

    this.logger.info({ phoneNumber }, 'MFA OTP sent');
  }
}
