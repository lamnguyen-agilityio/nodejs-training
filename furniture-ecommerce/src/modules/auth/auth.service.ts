import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { UserIdentitiesService } from '@/modules/user-identities/user-identities.service';
import { UsersService } from '@/modules/users/users.service';

import { AuthProviderFactory } from './auth-provider.factory';
import { AuthenticatedUserDto } from './dtos';
import type { AuthProviderProfile, AuthenticatedUser } from './interfaces';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userIdentitiesService: UserIdentitiesService,
    private readonly authProviderFactory: AuthProviderFactory,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  /**
   * core login flow — called by `AuthGuard` on every authenticated request.
   *
   * flow:
   *  1. look up existing identity by (provider, providerId).
   *  2a. found  → return the linked user directly (hot path, no writes).
   *  2b. not found → first login:
   *      - find-or-create the local `User` record by email.
   *      - create the `UserIdentity` linking provider ↔ user.
   *      - log whether user + identity were newly created.
   *  3. map to `AuthenticatedUser` interface and return.
   */
  async resolveUserFromProfile(profile: AuthProviderProfile): Promise<AuthenticatedUser> {
    const { providerId, email, name, socialProvider, socialProviderSub } = profile;
    const activeProvider = this.authProviderFactory.getActiveProvider();

    // ── 1. try existing identity first (hot path) ──────────────────────────
    const existingIdentity = await this.userIdentitiesService.findByProviderAndId(
      activeProvider,
      providerId,
    );

    if (existingIdentity) {
      return AuthenticatedUserDto.from({
        ...existingIdentity.user,
        userId: existingIdentity.user.id,
      });
    }

    // ── 2. first login — upsert user + create identity ─────────────────────
    this.logger.info(
      { provider: activeProvider, email },
      'First login — creating user and identity',
    );

    const { user, created: userCreated } = await this.usersService.findOrCreate({
      email,
      name,
    });

    if (userCreated) {
      this.logger.info({ userId: user.id, email: user.email }, 'New user created');
    }

    const { created: identityCreated } = await this.userIdentitiesService.upsert({
      user,
      provider: activeProvider,
      providerId,
      socialProvider,
      socialProviderSub,
    });

    if (identityCreated) {
      this.logger.info({ userId: user.id, provider: activeProvider }, 'New identity created');
    }

    return AuthenticatedUserDto.from({
      ...user,
      userId: user.id,
    });
  }
}
