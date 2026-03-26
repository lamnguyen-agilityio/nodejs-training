import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { JwksClient } from 'jwks-rsa';

import { MESSAGES } from '@/constants';
import { SocialProvider } from '@/enums';
import type { Auth0TokenPayload, AuthProviderProfile } from '@/modules/auth/interfaces';

const { EMPTY_PAYLOAD, MISSING_EMAIL, INVALID_SUB } = MESSAGES;

/**
 * verify JWT signature against Auth0's JWKS and return the decoded payload.
 */
export const verifyJwt = (token: string, jwksClient: JwksClient): Promise<Auth0TokenPayload> => {
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
};

/**
 * build a normalised AuthProviderProfile from the decoded Auth0 payload.
 */
export const buildProfile = (
  payload: Auth0TokenPayload,
  authConnectionMap: Record<string, SocialProvider>,
): AuthProviderProfile => {
  const [connection, socialProviderSub] = splitSub(payload.sub);
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
};

/**
 * split sub "google-oauth2|1234567890" → ["google-oauth2", "1234567890"].
 */
export const splitSub = (sub: string): [string, string] => {
  const pipeIndex = sub.indexOf('|');

  if (pipeIndex === -1) throw new UnauthorizedException(INVALID_SUB);

  const connection = sub.slice(0, pipeIndex);
  const id = sub.slice(pipeIndex + 1);

  if (!connection || !id) throw new UnauthorizedException(INVALID_SUB);

  return [connection, id];
};
