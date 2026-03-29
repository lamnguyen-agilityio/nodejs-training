/**
 * apply decimal precision and scale for price fields in the database
 */
export const PRICE_DECIMAL = {
  PRECISION: 10,
  SCALE: 2,
} as const;

/**
 * apply default values for product tables in the database
 */
export const PRODUCT_DEFAULTS = {
  QTY_IN_STOCK: 0,
} as const;
