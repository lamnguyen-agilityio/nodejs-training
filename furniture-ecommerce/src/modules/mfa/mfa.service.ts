import * as crypto from 'crypto';

import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PinoLogger } from 'nestjs-pino';

import { MfaMethod } from '@/common/enums';
import type { User } from '@/modules/users/entities/user.entity';

import { OTP_CHANNELS, OTP_TTL_MINUTES, BCRYPT_ROUNDS } from './constants';
import { MfaRepository } from './mfa.repository';
import { OtpChannel } from './otp-channel.abstract';

@Injectable()
export class MfaService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly mfaRepository: MfaRepository,
    @Inject(OTP_CHANNELS) private readonly channels: OtpChannel[],
  ) {
    this.logger.setContext(MfaService.name);
  }

  /**
   * generate OTP, hash, persist via repository, send via requested channel.
   */
  async sendOtp(user: User, method: MfaMethod = MfaMethod.Sms): Promise<void> {
    const destination = this.resolveDestination(user, method);
    const channel = this.resolveChannel(method);

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.mfaRepository.createOtp(user, codeHash, method, expiresAt);
    await channel.send(destination, code);

    this.logger.info({ userId: user.id, method }, 'MFA OTP sent');
  }

  /**
   * generate a random 6-digit code for MFA verification.
   */
  private generateCode(): string {
    return String(crypto.randomInt(100_000, 999_999));
  }

  /**
   * resolve the destination for an MFA OTP (phone number for SMS, email for email).
   */
  private resolveDestination(user: User, method: MfaMethod): string {
    if (method === MfaMethod.Sms) {
      if (!user.phoneNumber) {
        throw new BadRequestException(
          'Phone number not set — update your profile before using SMS MFA',
        );
      }
      return user.phoneNumber;
    }

    return user.email;
  }

  /**
   * resolve the channel for an MFA OTP (SMS or email).
   */
  private resolveChannel(method: MfaMethod): OtpChannel {
    const channel = this.channels.find((c) => c.method === method);
    if (!channel) {
      throw new BadRequestException(`MFA method '${method}' is not supported`);
    }

    return channel;
  }
}
