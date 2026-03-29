import { defineEntity, p } from '@mikro-orm/core';

import { PRODUCT_DEFAULTS, PRICE_DECIMAL } from '@/common/constants';
import { CategoryEntity } from '@/modules/categories/entities/category.entity';

const { PRECISION, SCALE } = PRICE_DECIMAL;

export const ProductEntity = defineEntity({
  name: 'Product',
  tableName: 'products',
  properties: {
    // identity product in the database.
    id: p.uuid().primary().defaultRaw('uuid_generate_v7()'),

    // product name
    name: p.string(),

    // product slug — used in URLs and unique identifier.
    slug: p.string().unique(),

    // product description.
    description: p.string().nullable(),

    // product price.
    price: p.decimal().precision(PRECISION).scale(SCALE),

    // product image URL.
    image: p.string().nullable(),

    // quantity in stock.
    quantityInStock: p.integer().default(PRODUCT_DEFAULTS.QTY_IN_STOCK),

    /**
     * the category this product belongs to.
     * the FK column in the database is `category_id`.
     */
    category: p.manyToOne(CategoryEntity).fieldName('category_id'),

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

export type Product = (typeof ProductEntity)['~entity'];
