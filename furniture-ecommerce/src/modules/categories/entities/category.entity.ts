import { defineEntity, p } from '@mikro-orm/core';

export const CategoryEntity = defineEntity({
  name: 'Category',
  tableName: 'categories',
  properties: {
    /** Internal database primary key — not exposed in API responses. */
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    /** Category name. */
    name: p.string(),

    /** Category slug — used in URLs and unique identifier. */
    slug: p.string().unique(),

    /** Category description. */
    description: p.string().nullable(),

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

export type Category = (typeof CategoryEntity)['~entity'];
