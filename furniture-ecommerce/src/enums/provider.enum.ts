/**
 * Supported authentication providers.
 *
 * - Clerk  → primary provider (default).
 * - Auth0  → fallback provider used when Clerk is unavailable.
 */
export enum AuthProvider {
  Clerk = 'clerk',
  Auth0 = 'auth0',
}

/**
 * Supported social authentication providers.
 */
export enum SocialProvider {
  Google = 'google',
  Github = 'github',
}
