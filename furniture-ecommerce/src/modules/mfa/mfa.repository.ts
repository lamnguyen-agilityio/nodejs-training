import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { MfaMethod } from '@/common/enums';
import { UserEntity, type User } from '@/modules/users/entities/user.entity';

import { MfaOtpEntity, type MfaOtp } from './entities/mfa-otp.entity';

@Injectable()
export class MfaRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MfaRepository.name);
  }

  /**
   * finds the active MFA OTP for a user.
   */
  async findActiveOtp(user: User): Promise<MfaOtp | null> {
    return this.em.findOne(MfaOtpEntity, { user });
  }

  /**
   * deletes the active MFA OTP for a user.
   */
  async deleteOtp(user: User): Promise<void> {
    await this.em.nativeDelete(MfaOtpEntity, { user });
  }

  /**
   * creates a new MFA OTP for a user.
   */
  async createOtp(user: User, codeHash: string, method: MfaMethod, expiresAt: Date): Promise<void> {
    // invalidate any previous OTP first — one active OTP per user
    await this.deleteOtp(user);

    const otp = this.em.create(MfaOtpEntity, {
      user,
      codeHash,
      method,
      attempts: 0,
      expiresAt,
    });
    this.em.persist(otp);
    await this.em.flush();
  }

  /**
   * increments the number of attempts for an MFA OTP.
   */
  async incrementAttempts(user: User, currentAttempts: number): Promise<void> {
    await this.em.nativeUpdate(MfaOtpEntity, { user }, { attempts: currentAttempts + 1 });
  }

  /**
   * marks a user as having MFA verified.
   */
  async markMfaVerified(userId: string): Promise<void> {
    await this.em.nativeUpdate(UserEntity, { id: userId }, { mfaVerifiedAt: new Date() });
  }
}
