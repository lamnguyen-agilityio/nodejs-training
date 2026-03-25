import { defineEntity, p } from '@mikro-orm/core';

import { Role } from '../../../enums';

export const UserEntity = defineEntity({
  name: 'User',
  tableName: 'users',
  properties: {
    /** Internal database primary key — not exposed in API responses. */
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    /** User's email address — synced from Clerk on first sign-in. */
    email: p.string().unique(),

    /** User's display name — synced from Clerk on first sign-in. */
    name: p.string(),

    /** Application-level role. Defaults to USER; elevated to ADMIN manually. */
    role: p.enum([Role.Admin, Role.User]).default(Role.User),

    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),

    /** Soft-delete timestamp. NULL = active, non-NULL = deleted. */
    deletedAt: p.datetime().nullable(),
  },
});

export type User = (typeof UserEntity)['~entity'];
