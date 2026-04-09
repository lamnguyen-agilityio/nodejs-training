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
   * only one OTP is allowed per user at a time — any existing OTP is deleted first.
   */
  async createOtp(user: User, codeHash: string, method: MfaMethod, expiresAt: Date): Promise<void> {
    await this.em.transactional(async (txEm) => {
      // delete existing OTP inside transaction — atomic with insert below
      await txEm.nativeDelete(MfaOtpEntity, { user });

      const otp = txEm.create(MfaOtpEntity, {
        user,
        codeHash,
        method,
        attempts: 0,
        expiresAt,
      });
      txEm.persist(otp);
      await txEm.flush();
    });
  }

  /**
   * increments the number of attempts for an MFA OTP.
   */
  async incrementAttempts(user: User): Promise<void> {
    await this.em
      .getConnection()
      .execute(`UPDATE mfa_otps SET attempts = attempts + 1 WHERE user_id = ?`, [user.id]);
  }

  /**
   * marks a user as having MFA verified.
   */
  async markMfaVerified(userId: string): Promise<void> {
    await this.em.nativeUpdate(UserEntity, { id: userId }, { mfaVerifiedAt: new Date() });
  }
}
