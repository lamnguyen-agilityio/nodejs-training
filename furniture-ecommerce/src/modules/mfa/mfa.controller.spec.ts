import { faker } from '@faker-js/faker';

import { MESSAGES } from '@/common/constants';
import { MfaMethod, Role } from '@/common/enums';
import type { AuthenticatedUser } from '@/modules/auth/interfaces';
import type { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { MFA_SESSION_HOURS } from './constants';
import { MfaResponseDto } from './dtos/mfa-response.dto';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';

// ─── mock decorators ──────────────────────────────────────────────────────────

jest.mock('./decorators/skip-mfa.decorator', () => ({
  SkipMfa: () => () => {},
}));

jest.mock('@/modules/auth/decorators', () => ({
  Auth: () => () => {},
  CurrentUser: () => () => {},
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeAuthUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  userId: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: Role.User,
  ...overrides,
});

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    phoneNumber: `+1${faker.string.numeric(10)}`,
    mfaVerifiedAt: null,
    ...overrides,
  }) as User;

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockMfaService = {
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
} satisfies Partial<jest.Mocked<MfaService>>;

const mockUsersService = {
  findOne: jest.fn(),
} satisfies Partial<jest.Mocked<UsersService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('MfaController', () => {
  let controller: MfaController;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new MfaController(
      mockMfaService as unknown as MfaService,
      mockUsersService as unknown as UsersService,
    );
  });

  // ── sendOtp ───────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('should resolve user and call mfaService.sendOtp', async () => {
      const authUser = makeAuthUser();
      const user = makeUser({ id: authUser.userId });
      mockUsersService.findOne.mockResolvedValue(user);
      mockMfaService.sendOtp.mockResolvedValue(undefined);

      await controller.sendOtp(authUser, { method: MfaMethod.Sms });

      expect(mockUsersService.findOne).toHaveBeenCalledWith({ id: authUser.userId });
      expect(mockMfaService.sendOtp).toHaveBeenCalledWith(user, MfaMethod.Sms);
    });

    it('should return MfaResponseDto with OTP_SENT message', async () => {
      const authUser = makeAuthUser();
      const user = makeUser({ id: authUser.userId });
      mockUsersService.findOne.mockResolvedValue(user);
      mockMfaService.sendOtp.mockResolvedValue(undefined);

      const result = await controller.sendOtp(authUser, { method: MfaMethod.Sms });

      expect(result).toBeInstanceOf(MfaResponseDto);
      expect(result.message).toBe(MESSAGES.OTP_SENT);
    });

    it('should propagate error from mfaService.sendOtp', async () => {
      const authUser = makeAuthUser();
      mockUsersService.findOne.mockResolvedValue(makeUser());
      mockMfaService.sendOtp.mockRejectedValue(new Error('send failed'));

      await expect(controller.sendOtp(authUser, { method: MfaMethod.Sms })).rejects.toThrow(
        'send failed',
      );
    });

    it('should propagate error from usersService.findOne', async () => {
      const authUser = makeAuthUser();
      mockUsersService.findOne.mockRejectedValue(new Error('user not found'));

      await expect(controller.sendOtp(authUser, { method: MfaMethod.Sms })).rejects.toThrow(
        'user not found',
      );
    });
  });

  // ── verifyOtp ─────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('should resolve user and call mfaService.verifyOtp', async () => {
      const authUser = makeAuthUser();
      const user = makeUser({ id: authUser.userId });
      const code = '482910';
      mockUsersService.findOne.mockResolvedValue(user);
      mockMfaService.verifyOtp.mockResolvedValue(undefined);

      await controller.verifyOtp(authUser, { code });

      expect(mockUsersService.findOne).toHaveBeenCalledWith({ id: authUser.userId });
      expect(mockMfaService.verifyOtp).toHaveBeenCalledWith(user, code);
    });

    it('should return MfaResponseDto with MFA_VERIFIED message', async () => {
      const authUser = makeAuthUser();
      mockUsersService.findOne.mockResolvedValue(makeUser());
      mockMfaService.verifyOtp.mockResolvedValue(undefined);

      const result = await controller.verifyOtp(authUser, { code: '482910' });

      expect(result).toBeInstanceOf(MfaResponseDto);
      expect(result.message).toBe(MESSAGES.MFA_VERIFIED(MFA_SESSION_HOURS));
    });

    it('should propagate error from mfaService.verifyOtp', async () => {
      const authUser = makeAuthUser();
      mockUsersService.findOne.mockResolvedValue(makeUser());
      mockMfaService.verifyOtp.mockRejectedValue(new Error('invalid code'));

      await expect(controller.verifyOtp(authUser, { code: 'wrong' })).rejects.toThrow(
        'invalid code',
      );
    });

    it('should propagate error from usersService.findOne', async () => {
      const authUser = makeAuthUser();
      mockUsersService.findOne.mockRejectedValue(new Error('user not found'));

      await expect(controller.verifyOtp(authUser, { code: '482910' })).rejects.toThrow(
        'user not found',
      );
    });
  });
});
