import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwksClient } from 'jwks-rsa';

import { verifyJwt, buildProfile, splitSub } from '@/common/utils';
import { AuthProvider, SocialProvider } from '@/enums';

import { AuthProviderAdapter } from './auth-provider.adapter';
import type { AuthProviderProfile } from '../interfaces';

/**
 * Auth0 embeds the social connection name in the `sub` claim as a prefix.
 * e.g. "google-oauth2|1234567890" or "github|1234567890"
 */
const AUTH0_CONNECTION_MAP: Record<string, SocialProvider> = {
  'google-oauth2': SocialProvider.Google,
  github: SocialProvider.Github,
};

@Injectable()
export class Auth0Adapter extends AuthProviderAdapter {
  readonly provider = AuthProvider.Auth0;

  /** JWKS client — caches public keys from Auth0's JWKS endpoint. */
  private readonly jwksClient = new JwksClient({
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  });

  // ─────────────────────────────────────────────────────────────
  // VERIFY TOKEN
  // ─────────────────────────────────────────────────────────────
  protected async doVerifyToken(token: string): Promise<AuthProviderProfile> {
    const payload = await verifyJwt(token, this.jwksClient);

    return buildProfile(payload, AUTH0_CONNECTION_MAP);
  }

  // ─────────────────────────────────────────────────────────────
  // GET USER PROFILE
  // ─────────────────────────────────────────────────────────────
  async getUserProfile(providerId: string): Promise<AuthProviderProfile> {
    const [connection, socialProviderSub] = splitSub(providerId);
    const socialProvider = AUTH0_CONNECTION_MAP[connection];

    if (!socialProvider) {
      throw new UnauthorizedException(`Unsupported Auth0 connection: ${connection}`);
    }

    // email/name are not available without the Management API here;
    // callers that need them should use doVerifyToken (token has the claims).
    return {
      providerId,
      email: '',
      name: '',
      socialProvider,
      socialProviderSub,
    };
  }
}
