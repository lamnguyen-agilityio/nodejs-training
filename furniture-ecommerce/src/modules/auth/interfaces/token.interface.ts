import type { Role } from '@/enums';

/**
 * minimal shape of a decoded Auth0 ID / access token payload.
 */
export interface Auth0TokenPayload {
  sub: string; // e.g. "google-oauth2|1234567890"
  email?: string;
  name?: string;
  nickname?: string;
  [key: string]: unknown;
}

/**
 * the internal token payload shape used internally by the application
 */
export interface InternalTokenPayload {
  sub: string;
  email: string;
  role: Role;
  name: string;
}
