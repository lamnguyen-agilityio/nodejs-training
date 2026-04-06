import { defineEntity, p } from '@mikro-orm/core';

export const CategoryEntity = defineEntity({
  name: 'Category',
  tableName: 'categories',
  properties: {
    // unique identifier for the category.
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    // category name.
    name: p.string(),

    // category slug — used in URLs and unique identifier.
    slug: p.string().unique(),

    // category description.
    description: p.string().nullable(),

    // image URL for the category.
    image: p.string(),

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

export type Category = (typeof CategoryEntity)['~entity'];
