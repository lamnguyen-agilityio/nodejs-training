import { Injectable } from '@nestjs/common';

import { AuthProvider } from '@/enums';
import type { User } from '@/modules/users/entities/user.entity';

import type { UserIdentity, UserIdentityWithUser } from './entities/user-identity.entity';
import type { UpsertIdentity } from './interfaces';
import { UserIdentitiesRepository } from './user-identities.repository';

@Injectable()
export class UserIdentitiesService {
  constructor(private readonly userIdentitiesRepository: UserIdentitiesRepository) {}

  /**
   * primary lookup used by AuthGuard on every request.
   * returns the identity with the user relation populated.
   */
  async findByProviderAndId(
    provider: AuthProvider,
    providerId: string,
  ): Promise<UserIdentityWithUser | null> {
    return this.userIdentitiesRepository.findByProviderAndId(provider, providerId);
  }

  /**
   * check whether a specific provider identity already exists for a user.
   * used by SyncService before pushing to Auth0.
   */
  async hasIdentityForProvider(user: User, provider: AuthProvider): Promise<boolean> {
    const identity = await this.userIdentitiesRepository.findByUserAndProvider(user, provider);

    return identity !== null;
  }

  /**
   * retrieve all identities for a user.
   */
  async findAllByUser(user: User): Promise<UserIdentity[]> {
    return this.userIdentitiesRepository.findAllByUser(user);
  }

  /**
   * upsert an identity. called during the login flow after the user record
   * has been resolved. returns created=true on first login for this provider.
   */
  async upsert(data: UpsertIdentity): Promise<{ identity: UserIdentity; created: boolean }> {
    return this.userIdentitiesRepository.upsert(data);
  }

  /**
   * directly create an identity without checking for an existing one.
   * used by SyncService when creating the Auth0 shadow identity.
   */
  async create(data: UpsertIdentity): Promise<UserIdentity> {
    return this.userIdentitiesRepository.create(data);
  }
}
