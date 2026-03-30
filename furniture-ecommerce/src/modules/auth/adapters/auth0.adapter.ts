import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/common/constants';
import { AuthProvider, SocialProvider } from '@/common/enums';

import { AuthProviderAdapter } from './auth-provider.adapter';
import type { Auth0TokenPayload, AuthProviderProfile } from '../interfaces';

const { EMPTY_PAYLOAD, MISSING_EMAIL, INVALID_SUB } = MESSAGES;

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

  constructor(logger: PinoLogger) {
    super(logger);
    this.logger.setContext(Auth0Adapter.name);
  }

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
    const payload = await this.verifyJwt(token, this.jwksClient);

    return this.buildProfile(payload, AUTH0_CONNECTION_MAP);
  }

  // ─────────────────────────────────────────────────────────────
  // GET USER PROFILE
  // ─────────────────────────────────────────────────────────────
  async getUserProfile(providerId: string): Promise<AuthProviderProfile> {
    const [connection, socialProviderSub] = this.splitSub(providerId);
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

  // ─────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * verify JWT signature against Auth0's JWKS and return the decoded payload.
   */
  private verifyJwt(token: string, jwksClient: JwksClient): Promise<Auth0TokenPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          jwksClient.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            callback(null, key?.getPublicKey());
          });
        },
        {
          audience: process.env.AUTH0_AUDIENCE,
          issuer: `https://${process.env.AUTH0_DOMAIN}/`,
          algorithms: ['RS256'],
        },
        (err, decoded: Auth0TokenPayload) => {
          if (err) return reject(err);
          if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
            return reject(new UnauthorizedException(EMPTY_PAYLOAD));
          }
          if (!decoded.sub || typeof decoded.sub !== 'string') {
            return reject(new UnauthorizedException(EMPTY_PAYLOAD));
          }

          resolve(decoded);
        },
      );
    });
  }

  /**
   * build a normalised AuthProviderProfile from the decoded Auth0 payload.
   */
  private buildProfile(
    payload: Auth0TokenPayload,
    authConnectionMap: Record<string, SocialProvider>,
  ): AuthProviderProfile {
    const [connection, socialProviderSub] = this.splitSub(payload.sub);
    const socialProvider = authConnectionMap[connection];

    if (!socialProvider) {
      throw new UnauthorizedException(`Unsupported Auth0 connection: ${connection}`);
    }

    const email = payload.email;
    if (!email) {
      throw new UnauthorizedException(MISSING_EMAIL);
    }

    return {
      providerId: payload.sub,
      email,
      name: payload.name ?? payload.nickname ?? email,
      socialProvider,
      socialProviderSub,
    };
  }

  /**
   * split sub "google-oauth2|1234567890" → ["google-oauth2", "1234567890"].
   */
  private splitSub(sub: string): [string, string] {
    const pipeIndex = sub.indexOf('|');

    if (pipeIndex === -1) throw new UnauthorizedException(INVALID_SUB);

    const connection = sub.slice(0, pipeIndex);
    const id = sub.slice(pipeIndex + 1);

    if (!connection || !id) throw new UnauthorizedException(INVALID_SUB);

    return [connection, id];
  }
}
