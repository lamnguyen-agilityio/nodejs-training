import { faker } from '@faker-js/faker';
import type { EntityManager } from '@mikro-orm/postgresql';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/common/constants';
import { MfaMethod } from '@/common/enums';
import type { User } from '@/modules/users/entities/user.entity';
import { UserEntity } from '@/modules/users/entities/user.entity';
import { createMockEm, createMockLogger } from '@/test/mocks';

import { MAX_ATTEMPTS } from './constants';
import { MfaOtpEntity, type MfaOtp } from './entities/mfa-otp.entity';
import { MfaRepository } from './mfa.repository';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    phoneNumber: `+1${faker.string.numeric(10)}`,
    mfaVerifiedAt: null,
    ...overrides,
  }) as User;

const makeOtp = (overrides: Partial<MfaOtp> = {}): MfaOtp =>
  ({
    id: faker.string.uuid(),
    codeHash: faker.string.alphanumeric(60),
    method: MfaMethod.Sms,
    attempts: 0,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
    ...overrides,
  }) as MfaOtp;

const makeExpiredOtp = (): MfaOtp => makeOtp({ expiresAt: new Date(Date.now() - 1000) });

const makeLockedOtp = (): MfaOtp => makeOtp({ attempts: MAX_ATTEMPTS });

// ─── mocks ───────────────────────────────────────────────────────────────────

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

// ─── suite ───────────────────────────────────────────────────────────────────

describe('MfaRepository', () => {
  let repository: MfaRepository;
  let mockEm: ReturnType<typeof createMockEm>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  type TxEm = ReturnType<typeof createMockEm>;

  const makeTxEm = (otp: MfaOtp | null): TxEm => {
    const txEm = createMockEm();
    txEm.findOne.mockResolvedValue(otp);
    txEm.nativeDelete.mockResolvedValue(1);
    txEm.nativeUpdate.mockResolvedValue(1);
    txEm.create.mockReturnValue(otp ?? makeOtp());
    txEm.persist.mockReturnThis();
    txEm.flush.mockResolvedValue(undefined);
    return txEm;
  };

  beforeEach(() => {
    mockEm = createMockEm();
    mockLogger = createMockLogger();
    jest.clearAllMocks();

    repository = new MfaRepository(
      mockEm as unknown as EntityManager,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── findActiveOtp ─────────────────────────────────────────────────────────

  describe('findActiveOtp', () => {
    it('should return otp when found', async () => {
      const user = makeUser();
      const otp = makeOtp();
      mockEm.findOne.mockResolvedValue(otp);

      const result = await repository.findActiveOtp(user);

      expect(mockEm.findOne).toHaveBeenCalledWith(MfaOtpEntity, { user });
      expect(result).toBe(otp);
    });

    it('should return null when no otp found', async () => {
      const user = makeUser();
      mockEm.findOne.mockResolvedValue(null);

      const result = await repository.findActiveOtp(user);

      expect(result).toBeNull();
    });
  });

  // ── deleteOtp ─────────────────────────────────────────────────────────────

  describe('deleteOtp', () => {
    it('should call nativeDelete with correct params', async () => {
      const user = makeUser();
      mockEm.nativeDelete.mockResolvedValue(1);

      await repository.deleteOtp(user);

      expect(mockEm.nativeDelete).toHaveBeenCalledWith(MfaOtpEntity, { user });
    });
  });

  // ── createOtp ─────────────────────────────────────────────────────────────

  describe('createOtp', () => {
    it('should delete existing OTP and create new one inside transaction', async () => {
      const user = makeUser();
      const otp = makeOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      let capturedTxEm: TxEm | undefined;

      mockEm.transactional.mockImplementation(async (cb: (txEm: unknown) => Promise<unknown>) => {
        capturedTxEm = makeTxEm(otp);
        return cb(capturedTxEm);
      });

      await repository.createOtp(user, otp.codeHash, MfaMethod.Sms, expiresAt);

      expect(capturedTxEm!.nativeDelete).toHaveBeenCalledWith(MfaOtpEntity, { user });
      expect(capturedTxEm!.create).toHaveBeenCalledWith(MfaOtpEntity, {
        user,
        codeHash: otp.codeHash,
        method: MfaMethod.Sms,
        attempts: 0,
        expiresAt,
      });
      expect(capturedTxEm!.persist).toHaveBeenCalled();
      expect(capturedTxEm!.flush).toHaveBeenCalled();
    });

    it('should run inside a transaction', async () => {
      const user = makeUser();
      mockEm.transactional.mockResolvedValue(undefined);

      await repository.createOtp(user, faker.string.alphanumeric(60), MfaMethod.Sms, new Date());

      expect(mockEm.transactional).toHaveBeenCalled();
    });
  });

  // ── verifyAndConsumeOtp ───────────────────────────────────────────────────

  describe('verifyAndConsumeOtp', () => {
    const validCode = '482910';

    const setupTransaction = (otp: MfaOtp | null) => {
      let capturedTxEm: TxEm;
      mockEm.transactional.mockImplementation(async (cb: (txEm: unknown) => Promise<unknown>) => {
        capturedTxEm = makeTxEm(otp);
        return cb(capturedTxEm);
      });
      return () => capturedTxEm;
    };

    // ── happy path ────────────────────────────────────────────────────────

    it('should delete otp and mark user verified on valid code', async () => {
      const user = makeUser();
      const otp = makeOtp();
      const getTxEm = setupTransaction(otp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await repository.verifyAndConsumeOtp(user, validCode);

      const txEm = getTxEm();
      expect(txEm.nativeDelete).toHaveBeenCalledWith(MfaOtpEntity, { id: otp.id });
      expect(txEm.nativeUpdate).toHaveBeenCalledWith(
        UserEntity,
        { id: user.id },
        expect.objectContaining({ mfaVerifiedAt: expect.any(Date) }),
      );
    });

    it('should call bcrypt.compare with submitted code and stored hash', async () => {
      const user = makeUser();
      const otp = makeOtp();
      setupTransaction(otp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await repository.verifyAndConsumeOtp(user, validCode);

      expect(bcrypt.compare).toHaveBeenCalledWith(validCode, otp.codeHash);
    });

    it('should run inside a transaction', async () => {
      setupTransaction(makeOtp());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await repository.verifyAndConsumeOtp(makeUser(), validCode);

      expect(mockEm.transactional).toHaveBeenCalled();
    });

    // ── no active otp ─────────────────────────────────────────────────────

    it('should throw NotFoundException when no otp found', async () => {
      setupTransaction(null);

      await expect(repository.verifyAndConsumeOtp(makeUser(), validCode)).rejects.toThrow(
        NotFoundException,
      );

      await expect(repository.verifyAndConsumeOtp(makeUser(), validCode)).rejects.toThrow(
        MESSAGES.NO_ACTIVE_OTP,
      );
    });

    it('should not call bcrypt when no otp found', async () => {
      setupTransaction(null);

      await expect(repository.verifyAndConsumeOtp(makeUser(), validCode)).rejects.toThrow();

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    // ── expired otp ───────────────────────────────────────────────────────

    it('should throw UnauthorizedException and delete otp when expired', async () => {
      const user = makeUser();
      const otp = makeExpiredOtp();
      const getTxEm = setupTransaction(otp);

      await expect(repository.verifyAndConsumeOtp(user, validCode)).rejects.toThrow(
        UnauthorizedException,
      );

      await expect(repository.verifyAndConsumeOtp(user, validCode)).rejects.toThrow(
        MESSAGES.OPT_EXPIRED,
      );

      const txEm = getTxEm();
      expect(txEm.nativeDelete).toHaveBeenCalledWith(MfaOtpEntity, { id: otp.id });
    });

    it('should not call bcrypt when otp is expired', async () => {
      setupTransaction(makeExpiredOtp());

      await expect(repository.verifyAndConsumeOtp(makeUser(), validCode)).rejects.toThrow();

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    // ── locked otp ────────────────────────────────────────────────────────

    it('should throw UnauthorizedException and delete otp when max attempts reached', async () => {
      const user = makeUser();
      const otp = makeLockedOtp();
      const getTxEm = setupTransaction(otp);

      await expect(repository.verifyAndConsumeOtp(user, validCode)).rejects.toThrow(
        UnauthorizedException,
      );

      await expect(repository.verifyAndConsumeOtp(user, validCode)).rejects.toThrow(
        MESSAGES.OPT_FAILED_ATTEMPTS,
      );

      const txEm = getTxEm();
      expect(txEm.nativeDelete).toHaveBeenCalledWith(MfaOtpEntity, { id: otp.id });
    });

    it('should not call bcrypt when attempts are exhausted', async () => {
      setupTransaction(makeLockedOtp());

      await expect(repository.verifyAndConsumeOtp(makeUser(), validCode)).rejects.toThrow();

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    // ── invalid code ──────────────────────────────────────────────────────

    it('should increment attempts and throw UnauthorizedException on invalid code', async () => {
      const user = makeUser();
      const otp = makeOtp({ attempts: 0 });
      const getTxEm = setupTransaction(otp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(repository.verifyAndConsumeOtp(user, 'wrong-code')).rejects.toThrow(
        UnauthorizedException,
      );

      const txEm = getTxEm();
      expect(txEm.nativeUpdate).toHaveBeenCalledWith(
        MfaOtpEntity,
        { id: otp.id },
        { attempts: otp.attempts + 1 },
      );
    });

    it('should include remaining attempts in error message when attempts remain', async () => {
      const otp = makeOtp({ attempts: 0 });
      setupTransaction(otp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(repository.verifyAndConsumeOtp(makeUser(), 'wrong')).rejects.toThrow(
        MESSAGES.INVALID_CODE(MAX_ATTEMPTS - otp.attempts - 1),
      );
    });

    it('should use INVALID_REMAINING message when last attempt fails', async () => {
      const otp = makeOtp({ attempts: MAX_ATTEMPTS - 1 });
      setupTransaction(otp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(repository.verifyAndConsumeOtp(makeUser(), 'wrong')).rejects.toThrow(
        MESSAGES.INVALID_REMAINING,
      );
    });

    it('should not delete otp or mark user verified on invalid code', async () => {
      const user = makeUser();
      const otp = makeOtp({ attempts: 0 });
      const getTxEm = setupTransaction(otp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(repository.verifyAndConsumeOtp(user, 'wrong')).rejects.toThrow();

      const txEm = getTxEm();
      expect(txEm.nativeDelete).not.toHaveBeenCalled();
      expect(txEm.nativeUpdate).not.toHaveBeenCalledWith(
        UserEntity,
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
