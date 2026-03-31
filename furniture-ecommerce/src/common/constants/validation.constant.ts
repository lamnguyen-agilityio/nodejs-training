/**
 * string length constraints used across DTO validators.
 * centralised here so limits are consistent and easy to update.
 */
export const LENGTH = {
  // ── short text (category name, product name, slug...) ─────────────────────
  SHORT_MIN: 2,
  SHORT_MAX: 100,

  // ── description / long text ────────────────────────────────────────────────
  DESCRIPTION: 500,

  // ── url / long text ────────────────────────────────────────────────────────
  URL_MAX: 200,
} as const;

/**
 * numeric constraints for pagination and quantities.
 */
export const NUMERIC = {
  PAGE_MIN: 1,
  LIMIT_MIN: 1,
  LIMIT_MAX: 100,
  LIMIT_DEFAULT: 20,
  QUANTITY_MIN: 1,
  PRICE_MIN: 0,
} as const;
