import { faker } from '@faker-js/faker';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/common/constants';
import { MfaMethod } from '@/common/enums';
import type { User } from '@/modules/users/entities/user.entity';
import { createMockLogger } from '@/test/mocks';

import { MFA_SESSION_MS } from './constants';
import { MfaRepository } from './mfa.repository';
import { MfaService } from './mfa.service';
import type { OtpChannel } from './otp-channel.abstract';

// ─── mocks ───────────────────────────────────────────────────────────────────

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    phoneNumber: `+1${faker.string.numeric(10)}`,
    mfaVerifiedAt: null,
    ...overrides,
  }) as User;

const makeSmsChannel = (): jest.Mocked<OtpChannel> => ({
  method: MfaMethod.Sms,
  send: jest.fn(),
});

// ─── suite ───────────────────────────────────────────────────────────────────

describe('MfaService', () => {
  let service: MfaService;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockMfaRepository: jest.Mocked<
    Pick<MfaRepository, 'createOtp' | 'deleteOtp' | 'verifyAndConsumeOtp'>
  >;
  let mockSmsChannel: jest.Mocked<OtpChannel>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMfaRepository = {
      createOtp: jest.fn().mockResolvedValue(undefined),
      deleteOtp: jest.fn().mockResolvedValue(undefined),
      verifyAndConsumeOtp: jest.fn().mockResolvedValue(undefined),
    };
    mockSmsChannel = makeSmsChannel();
    mockSmsChannel.send.mockResolvedValue(undefined);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-code');

    jest.clearAllMocks();
    mockMfaRepository.createOtp.mockResolvedValue(undefined);
    mockMfaRepository.deleteOtp.mockResolvedValue(undefined);
    mockMfaRepository.verifyAndConsumeOtp.mockResolvedValue(undefined);
    mockSmsChannel.send.mockResolvedValue(undefined);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-code');

    service = new MfaService(
      mockLogger as unknown as PinoLogger,
      mockMfaRepository as unknown as MfaRepository,
      [mockSmsChannel],
    );
  });

  // ── sendOtp ───────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('should create otp and send via SMS channel', async () => {
      const user = makeUser();

      await service.sendOtp(user, MfaMethod.Sms);

      expect(mockMfaRepository.createOtp).toHaveBeenCalledWith(
        user,
        'hashed-code',
        MfaMethod.Sms,
        expect.any(Date),
      );
      expect(mockSmsChannel.send).toHaveBeenCalledWith(
        user.phoneNumber,
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('should default to SMS method when no method specified', async () => {
      const user = makeUser();

      await service.sendOtp(user);

      expect(mockSmsChannel.send).toHaveBeenCalled();
    });

    it('should hash the code before storing', async () => {
      const user = makeUser();

      await service.sendOtp(user, MfaMethod.Sms);

      expect(bcrypt.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{6}$/),
        expect.any(Number),
      );
      expect(mockMfaRepository.createOtp).toHaveBeenCalledWith(
        user,
        'hashed-code',
        MfaMethod.Sms,
        expect.any(Date),
      );
    });

    it('should set expiry date in the future', async () => {
      const user = makeUser();
      const before = Date.now();

      await service.sendOtp(user, MfaMethod.Sms);

      const expiresAt: Date = mockMfaRepository.createOtp.mock.calls[0][3];
      expect(expiresAt.getTime()).toBeGreaterThan(before);
    });

    it('should persist otp before sending', async () => {
      const user = makeUser();
      const callOrder: string[] = [];
      mockMfaRepository.createOtp.mockImplementation(async () => {
        callOrder.push('create');
      });
      mockSmsChannel.send.mockImplementation(async () => {
        callOrder.push('send');
      });

      await service.sendOtp(user, MfaMethod.Sms);

      expect(callOrder).toEqual(['create', 'send']);
    });

    it('should log info on successful send', async () => {
      const user = makeUser();

      await service.sendOtp(user, MfaMethod.Sms);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id }),
        'MFA OTP sent',
      );
    });

    it('should delete otp and throw InternalServerErrorException when send fails', async () => {
      const user = makeUser();
      mockSmsChannel.send.mockRejectedValue(new Error('Twilio error'));

      await expect(service.sendOtp(user, MfaMethod.Sms)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockMfaRepository.deleteOtp).toHaveBeenCalledWith(user);
    });

    it('should log error when send fails', async () => {
      const user = makeUser();
      const sendError = new Error('Twilio error');
      mockSmsChannel.send.mockRejectedValue(sendError);

      await expect(service.sendOtp(user, MfaMethod.Sms)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id, err: sendError }),
        'OTP delivery failed — cleaning up persisted OTP',
      );
    });

    it('should throw BadRequestException when user has no phone number for SMS', async () => {
      const user = makeUser({ phoneNumber: undefined });

      await expect(service.sendOtp(user, MfaMethod.Sms)).rejects.toThrow(BadRequestException);
      await expect(service.sendOtp(user, MfaMethod.Sms)).rejects.toThrow(MESSAGES.MISSING_PHONE);
    });

    it('should throw BadRequestException when channel is not supported', async () => {
      const user = makeUser();

      await expect(service.sendOtp(user, MfaMethod.Email)).rejects.toThrow(BadRequestException);
    });

    it('should use email as destination for Email method', async () => {
      const emailChannel: jest.Mocked<OtpChannel> = {
        method: MfaMethod.Email,
        send: jest.fn().mockResolvedValue(undefined),
      };
      service = new MfaService(
        mockLogger as unknown as PinoLogger,
        mockMfaRepository as unknown as MfaRepository,
        [mockSmsChannel, emailChannel],
      );
      const user = makeUser();

      await service.sendOtp(user, MfaMethod.Email);

      expect(emailChannel.send).toHaveBeenCalledWith(user.email, expect.any(String));
    });
  });

  // ── verifyOtp ─────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('should call verifyAndConsumeOtp with user and code', async () => {
      const user = makeUser();
      const code = '482910';

      await service.verifyOtp(user, code);

      expect(mockMfaRepository.verifyAndConsumeOtp).toHaveBeenCalledWith(user, code);
    });

    it('should log info on successful verification', async () => {
      const user = makeUser();

      await service.verifyOtp(user, '482910');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id }),
        'MFA verified — session window opened',
      );
    });

    it('should propagate errors from verifyAndConsumeOtp', async () => {
      const user = makeUser();
      mockMfaRepository.verifyAndConsumeOtp.mockRejectedValue(new Error('verification failed'));

      await expect(service.verifyOtp(user, 'wrong')).rejects.toThrow('verification failed');
    });
  });

  // ── isMfaSessionValid ─────────────────────────────────────────────────────

  describe('isMfaSessionValid', () => {
    it('should return false when mfaVerifiedAt is null', () => {
      const user = makeUser({ mfaVerifiedAt: null });
      expect(service.isMfaSessionValid(user)).toBe(false);
    });

    it('should return true when mfaVerifiedAt is within 8-hour window', () => {
      const user = makeUser({
        mfaVerifiedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      });
      expect(service.isMfaSessionValid(user)).toBe(true);
    });

    it('should return false when mfaVerifiedAt is older than 8 hours', () => {
      const user = makeUser({
        mfaVerifiedAt: new Date(Date.now() - MFA_SESSION_MS - 1000),
      });
      expect(service.isMfaSessionValid(user)).toBe(false);
    });

    it('should return true when mfaVerifiedAt is exactly at session boundary', () => {
      const user = makeUser({
        mfaVerifiedAt: new Date(Date.now() - MFA_SESSION_MS + 1000),
      });
      expect(service.isMfaSessionValid(user)).toBe(true);
    });
  });
});
