import { faker } from '@faker-js/faker';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import { MfaMethod } from '@/common/enums';
import { createMockLogger } from '@/test/mocks';

import { OTP_TTL_MINUTES } from '../constants';
import { SmsOtpChannel } from './sms-otp.channel';

// ─── mock Twilio SDK ──────────────────────────────────────────────────────────

const mockMessagesCreate = jest.fn();

jest.mock('twilio', () =>
  jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
);

// ─── helpers ─────────────────────────────────────────────────────────────────

const makePhone = () => `+1${faker.string.numeric(10)}`;
const makeCode = () => faker.string.numeric(6);

const TWILIO_CONFIG = {
  twilioAccountSid: `AC${faker.string.alphanumeric(32)}`,
  twilioAuthToken: faker.string.alphanumeric(32),
  twilioPhoneNumber: makePhone(),
};

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue(TWILIO_CONFIG),
} satisfies Partial<jest.Mocked<ConfigService>>;

// ─── suite ───────────────────────────────────────────────────────────────────

describe('SmsOtpChannel', () => {
  let channel: SmsOtpChannel;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue(TWILIO_CONFIG);

    channel = new SmsOtpChannel(
      mockConfigService as unknown as ConfigService,
      mockLogger as unknown as PinoLogger,
    );
  });

  // ── method ────────────────────────────────────────────────────────────────

  describe('method', () => {
    it('should have method set to Sms', () => {
      expect(channel.method).toBe(MfaMethod.Sms);
    });
  });

  // ── send ──────────────────────────────────────────────────────────────────

  describe('send', () => {
    it('should call Twilio messages.create with correct params', async () => {
      const phoneNumber = makePhone();
      const code = makeCode();
      mockMessagesCreate.mockResolvedValue({ sid: `SM${faker.string.alphanumeric(32)}` });

      await channel.send(phoneNumber, code);

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        body: `Your verification code is: ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
        from: TWILIO_CONFIG.twilioPhoneNumber,
        to: phoneNumber,
      });
    });

    it('should send to the correct recipient number', async () => {
      const phoneNumber = makePhone();
      mockMessagesCreate.mockResolvedValue({});

      await channel.send(phoneNumber, makeCode());

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.to).toBe(phoneNumber);
    });

    it('should send from the configured Twilio number', async () => {
      mockMessagesCreate.mockResolvedValue({});

      await channel.send(makePhone(), makeCode());

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.from).toBe(TWILIO_CONFIG.twilioPhoneNumber);
    });

    it('should include the OTP code in the message body', async () => {
      const code = makeCode();
      mockMessagesCreate.mockResolvedValue({});

      await channel.send(makePhone(), code);

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.body).toContain(code);
    });

    it('should include expiry time in the message body', async () => {
      mockMessagesCreate.mockResolvedValue({});

      await channel.send(makePhone(), makeCode());

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.body).toContain(String(OTP_TTL_MINUTES));
    });

    it('should log info before and after sending', async () => {
      const phoneNumber = makePhone();
      mockMessagesCreate.mockResolvedValue({});

      await channel.send(phoneNumber, makeCode());

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumber }),
        'Sending MFA OTP via SMS',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumber }),
        'MFA OTP sent',
      );
    });

    it('should propagate error when Twilio messages.create throws', async () => {
      const error = new Error('Twilio API error');
      mockMessagesCreate.mockRejectedValue(error);

      await expect(channel.send(makePhone(), makeCode())).rejects.toThrow('Twilio API error');
    });

    it('should not log success when send fails', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('send failed'));

      await expect(channel.send(makePhone(), makeCode())).rejects.toThrow();

      const infoCalls = (mockLogger.info as jest.Mock).mock.calls.map((c: unknown[]) => c[1]);
      expect(infoCalls).not.toContain('MFA OTP sent');
    });
  });
});
