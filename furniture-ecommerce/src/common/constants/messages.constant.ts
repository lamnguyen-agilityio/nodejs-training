/**
 * application message constants organized by feature
 * contains all error and information messages used throughout the application
 */
export const MESSAGES = {
  // ── messages used by the global exception filter ──────────────────────────────────────────
  VALIDATION_FAILED: 'Validation failed',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  UNEXPECTED_ERROR: 'An unexpected error occurred',
  UNKNOWN_ERROR: 'Unknown error',

  //  ── invalid error messages ───────────────────────────────────────────────────────────────
  INVALID_TOKEN: 'Invalid or expired token',
  INVALID_SOCIAL_ACCOUNT: 'No valid social account found',
  INVALID_EXTERNAL_ACCOUNT: 'No valid external account found',
  EMPTY_PAYLOAD: 'Empty payload',
  INVALID_CURRENT_USER_DECORATOR:
    'CurrentUser decorator requires an authenticated request. Ensure AuthGuard is applied.',
  FORBIDDEN: 'You do not have permission to perform this action',

  //  ── clerk messages ────────────────────────────────────────────────────────────────────────
  INVALID_EMAIL_ADDRESS: 'Clerk user has no verified email address',

  //  ── auth0 messages ────────────────────────────────────────────────────────────────────────
  MISSING_EMAIL: 'Auth0 token is missing email claim',
  INVALID_SUB: 'Unexpected Auth0 sub format',

  // category messages  ────────────────────────────────────────────────────────────────────────
  CATEGORY_SLUG_CONFLICT: 'Category with this name already exists',

  // product messages  ────────────────────────────────────────────────────────────────────────
  PRODUCT_SLUG_CONFLICT: 'Product with this name already exists',
  INSUFFICIENT_STOCK: 'Insufficient stock for requested quantity',
  IMAGE_REQUIRED: 'Image is required',

  // cart messages  ────────────────────────────────────────────────────────────────────────
  CART_ITEM_NOT_FOUND: 'Cart item not found',
  INVALID_QUANTITY: 'Quantity must be greater than 0',
  CART_EMPTY: 'Cart is empty',
} as const;
