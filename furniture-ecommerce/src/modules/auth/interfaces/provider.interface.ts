import { SocialProvider } from '@/common/enums';

/**
 * normalised user profile extracted from a provider's JWT / userinfo endpoint.
 * every adapter must return this shape so the rest of the system stays provider-agnostic.
 */
export interface AuthProviderProfile {
  providerId: string;
  email: string;
  name: string;
  socialProvider: SocialProvider;
  socialProviderSub: string;
}

/**
 * contract that every auth-provider adapter must satisfy.
 *
 * the system only calls two methods:
 *  - `verifyToken`  — on every authenticated request (hot path).
 *  - `getUserProfile` — once per first-login to enrich the local record.
 */
export interface AuthProvider {
  /**
   * verify the raw Bearer token and return the normalised profile.
   * throws an `UnauthorizedException` when the token is invalid or expired.
   */
  verifyToken(token: string): Promise<AuthProviderProfile>;

  /**
   * fetch a richer profile from the provider's API using the providerId.
   * falls back to the data already extracted in `verifyToken` when the
   * provider does not expose a separate userinfo endpoint.
   */
  getUserProfile(providerId: string): Promise<AuthProviderProfile>;
}
