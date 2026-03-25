import { defineEntity, p } from '@mikro-orm/core';

import { AuthProvider, SocialProvider } from '../../../enums';
import { UserEntity, type User } from '../../users/entities/user.entity';

export const UserIdentityEntity = defineEntity({
  name: 'UserIdentity',
  tableName: 'user_identities',
  properties: {
    /** Internal database primary key — not exposed in API responses. */
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    /**
     * The owning user.
     * Pass the EntitySchema directly (not a lazy arrow function) — required by
     * MikroORM v7 defineEntity for relation resolution.
     * The FK column in the database is `user_id`.
     */
    user: p.manyToOne(UserEntity).fieldName('user_id'),

    /**
     * Auth provider that owns this identity.
     * Clerk is the default; Auth0 is the fallback when Clerk is unavailable.
     */
    provider: p.enum([AuthProvider.Clerk, AuthProvider.Auth0]),

    /**
     * The sub claim issued by the provider (e.g. Clerk user ID, Auth0 sub).
     * Used by the JWT strategy to resolve the local user on every request.
     */
    providerId: p.string().unique(),

    /**
     * Social provider that owns this identity.
     */
    socialProvider: p.enum([SocialProvider.Google, SocialProvider.Github]),

    /**
     * The sub claim issued by the social provider (e.g. Google user ID, Github username).
     * Used to look up the local user on every request.
     */
    socialProviderSub: p.string().unique(),

    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
});

export type UserIdentity = (typeof UserIdentityEntity)['~entity'];

/**
 * Convenience type for a UserIdentity with the user relation already populated.
 */
export type UserIdentityWithUser = UserIdentity & { user: User };
