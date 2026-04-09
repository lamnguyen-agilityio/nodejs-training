import { defineEntity, p } from '@mikro-orm/core';

import { Role } from '@/common/enums';

export const UserEntity = defineEntity({
  name: 'User',
  tableName: 'users',
  properties: {
    // unique identifier for the user.
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    // user's email address — synced from Clerk on first sign-in.
    email: p.string().unique(),

    // user's phone number.
    phoneNumber: p.string().nullable(),

    // user's display name — synced from Clerk on first sign-in.
    name: p.string(),

    // application-level role. Defaults to USER; elevated to ADMIN manually.
    role: p.enum([Role.Admin, Role.User]).default(Role.User),

    // timestamp when MFA was verified, if applicable.
    mfaVerifiedAt: p.datetime().nullable(),

    // creation timestamp.
    createdAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date()),

    // last update timestamp.
    updatedAt: p
      .datetime()
      .defaultRaw('now()')
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),

    // soft-delete timestamp. NULL = active, non-NULL = deleted.
    deletedAt: p.datetime().nullable(),
  },
});

export type User = (typeof UserEntity)['~entity'];
