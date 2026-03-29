import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { AuthProvider } from '@/common/enums';
import type { User } from '@/modules/users/entities/user.entity';

import {
  UserIdentityEntity,
  type UserIdentity,
  type UserIdentityWithUser,
} from './entities/user-identity.entity';
import type { UpsertIdentity } from './interfaces';

@Injectable()
export class UserIdentitiesRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * find a single identity by (provider, providerId).
   * this is the primary lookup used on every authenticated request.
   */
  async findByProviderAndId(
    provider: AuthProvider,
    providerId: string,
  ): Promise<UserIdentityWithUser | null> {
    return await this.em.findOne(
      UserIdentityEntity,
      { provider, providerId },
      { populate: ['user'] },
    );
  }

  /**
   * find all identities that belong to a local user.
   * used by SyncModule to check whether an Auth0 identity already exists.
   */
  async findAllByUser(user: User): Promise<UserIdentity[]> {
    return await this.em.find(UserIdentityEntity, { user });
  }

  /**
   * find a specific identity for a user + provider combination.
   * returns null when the identity does not exist yet (not yet synced).
   */
  async findByUserAndProvider(user: User, provider: AuthProvider): Promise<UserIdentity | null> {
    return await this.em.findOne(UserIdentityEntity, { user, provider });
  }

  /**
   * insert a new identity and flush immediately.
   */
  async create(data: UpsertIdentity): Promise<UserIdentity> {
    const identity = this.em.create(UserIdentityEntity, data);
    this.em.persist(identity);
    await this.em.flush();

    return identity;
  }

  /**
   * upsert: update an existing identity or create a new one.
   * matches on (provider, providerId) — the stable external key.
   * returns the identity and a flag indicating whether it was newly created.
   */
  async upsert(data: UpsertIdentity): Promise<{ identity: UserIdentity; created: boolean }> {
    const existing = await this.findByProviderAndId(data.provider, data.providerId);

    if (existing) {
      this.em.assign(existing, {
        socialProvider: data.socialProvider,
        socialProviderSub: data.socialProviderSub,
      });
      await this.em.flush();
      return { identity: existing, created: false };
    }

    const identity = await this.create(data);
    return { identity, created: true };
  }
}
