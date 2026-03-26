import { createClerkClient, verifyToken } from '@clerk/backend';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { MESSAGES } from '@/constants';
import { AuthProvider, SocialProvider } from '@/enums';

import { AuthProviderAdapter } from './auth-provider.adapter';
import type { AuthProviderProfile } from '../interfaces';

/**
 * maps Clerk's OAuth provider string to our internal `SocialProvider` enum.
 */
const CLERK_SOCIAL_PROVIDER_MAP: Record<string, SocialProvider> = {
  oauth_google: SocialProvider.Google,
  oauth_github: SocialProvider.Github,
};

@Injectable()
export class ClerkAdapter extends AuthProviderAdapter {
  readonly provider = AuthProvider.Clerk;

  private readonly clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  // ─────────────────────────────────────────────────────────────
  // VERIFY TOKEN
  // ─────────────────────────────────────────────────────────────
  protected async doVerifyToken(token: string): Promise<AuthProviderProfile> {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!payload?.sub) {
      throw new UnauthorizedException(MESSAGES.INVALID_TOKEN);
    }

    return this.getUserProfile(payload.sub);
  }

  // ─────────────────────────────────────────────────────────────
  // GET USER PROFILE
  // ─────────────────────────────────────────────────────────────
  async getUserProfile(providerId: string): Promise<AuthProviderProfile> {
    const clerkUser = await this.clerkClient.users.getUser(providerId);

    const externalAccounts = clerkUser.externalAccounts ?? [];

    const externalAccount =
      // 1. prioritize supported providers (Google, Github...).
      externalAccounts.find((acc) =>
        Object.keys(CLERK_SOCIAL_PROVIDER_MAP).includes(acc.provider),
      ) ||
      // 2. fallback: account verified.
      externalAccounts.find((acc) => acc.verification?.status === 'verified') ||
      // 3. fallback: the first external account.
      externalAccounts[0];

    if (!externalAccount) {
      throw new UnauthorizedException(MESSAGES.INVALID_SOCIAL_ACCOUNT);
    }

    const socialProvider = CLERK_SOCIAL_PROVIDER_MAP[externalAccount.provider];

    if (!socialProvider) {
      throw new UnauthorizedException(`Unsupported social provider: ${externalAccount.provider}`);
    }

    if (!externalAccount.providerUserId) {
      throw new UnauthorizedException(MESSAGES.INVALID_EXTERNAL_ACCOUNT);
    }

    // get primary email
    const primaryEmail =
      clerkUser.primaryEmailAddress?.verification?.status === 'verified'
        ? clerkUser.primaryEmailAddress.emailAddress
        : undefined;

    // get fallback verified email
    const fallbackVerifiedEmail = clerkUser.emailAddresses?.find(
      (email) => email.verification?.status === 'verified',
    )?.emailAddress;

    // get verified email
    const verifiedEmail = primaryEmail ?? fallbackVerifiedEmail;

    if (!verifiedEmail) {
      throw new UnauthorizedException(MESSAGES.INVALID_EMAIL_ADDRESS);
    }

    // build name
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ');

    return {
      providerId: clerkUser.id,
      email: verifiedEmail,
      name: fullName || verifiedEmail,
      socialProvider,
      socialProviderSub: externalAccount.providerUserId,
    };
  }
}
