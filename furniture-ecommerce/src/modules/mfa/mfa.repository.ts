import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/common/constants';
import { MfaMethod } from '@/common/enums';
import { UserEntity, type User } from '@/modules/users/entities/user.entity';

import { MAX_ATTEMPTS } from './constants';
import { MfaOtpEntity, type MfaOtp } from './entities/mfa-otp.entity';

const { NO_ACTIVE_OTP, OPT_EXPIRED, OPT_FAILED_ATTEMPTS, INVALID_CODE, INVALID_REMAINING } =
  MESSAGES;

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
   * verifies an MFA OTP code for a user.
   *
   * on success: deletes OTP + marks user mfa_verified_at.
   * on failure: atomically increments attempts, throws with remaining count.
   * on expiry/lockout: deletes OTP, throws.
   */
  async verifyAndConsumeOtp(user: User, code: string): Promise<void> {
    await this.em.transactional(async (txEm) => {
      const otp = await txEm.findOne(MfaOtpEntity, { user });

      if (!otp) {
        throw new NotFoundException(NO_ACTIVE_OTP);
      }

      if (new Date() > otp.expiresAt) {
        await txEm.nativeDelete(MfaOtpEntity, { id: otp.id });
        throw new UnauthorizedException(OPT_EXPIRED);
      }

      if (otp.attempts >= MAX_ATTEMPTS) {
        await txEm.nativeDelete(MfaOtpEntity, { id: otp.id });
        throw new UnauthorizedException(OPT_FAILED_ATTEMPTS);
      }

      const isValid = await bcrypt.compare(code, otp.codeHash);

      if (!isValid) {
        await txEm.nativeUpdate(MfaOtpEntity, { id: otp.id }, { attempts: otp.attempts + 1 });
        const remaining = MAX_ATTEMPTS - otp.attempts - 1;
        throw new UnauthorizedException(
          remaining > 0 ? INVALID_CODE(remaining) : INVALID_REMAINING,
        );
      }

      // valid — consume OTP and mark user as MFA-verified atomically
      await txEm.nativeDelete(MfaOtpEntity, { id: otp.id });
      await txEm.nativeUpdate(UserEntity, { id: user.id }, { mfaVerifiedAt: new Date() });
    });
  }
}
