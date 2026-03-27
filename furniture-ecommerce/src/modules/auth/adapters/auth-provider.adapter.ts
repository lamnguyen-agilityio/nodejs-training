import { UnauthorizedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/constants';
import { AuthProvider } from '@/enums';

import type { AuthProvider as IAuthProvider, AuthProviderProfile } from '../interfaces';

export abstract class AuthProviderAdapter implements IAuthProvider {
  abstract readonly provider: AuthProvider;

  constructor(protected readonly logger: PinoLogger) {}

  /**
   * public entry point — wraps `doVerifyToken` with uniform error handling.
   */
  async verifyToken(token: string): Promise<AuthProviderProfile> {
    try {
      return await this.doVerifyToken(token);
    } catch (err) {
      this.logger.warn(`Token verification failed: ${err}`);
      throw new UnauthorizedException(MESSAGES.INVALID_TOKEN);
    }
  }

  /**
   * provider-specific token verification.
   * subclasses throw freely — the base class will convert any error to
   * `UnauthorizedException`.
   */
  protected abstract doVerifyToken(token: string): Promise<AuthProviderProfile>;

  /**
   * provider-specific profile fetch.
   * default implementation re-verifies the token and returns that profile
   * (sufficient for providers that embed all claims in the JWT itself).
   * override when a separate userinfo endpoint is needed.
   */
  abstract getUserProfile(providerId: string): Promise<AuthProviderProfile>;
}
