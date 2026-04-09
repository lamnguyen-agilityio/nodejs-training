import { MfaMethod } from '@/common/enums';

/**
 * abstract strategy for OTP delivery channels.
 *
 * to add Email, WhatsApp, etc.:
 *  1. create a class that extends OtpChannel
 *  2. set the correct method
 *  3. add it to MfaModule providers — MfaService picks it up automatically
 */
export abstract class OtpChannel {
  abstract readonly method: MfaMethod;
  abstract send(destination: string, code: string): Promise<void>;
}
