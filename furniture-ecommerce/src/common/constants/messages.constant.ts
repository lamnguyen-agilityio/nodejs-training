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

  // cart messages  ───────────────────────────────────────────────────────────────────────────
  CART_ITEM_NOT_FOUND: 'Cart item not found',
  INVALID_QUANTITY: 'Quantity must be greater than 0',
  CART_EMPTY: 'Cart is empty',

  // user messages  ───────────────────────────────────────────────────────────────────────────
  USER_NOT_FOUND: 'User not found',

  // MFA messages  ────────────────────────────────────────────────────────────────────────────
  MFA_REQUIRED: 'MFA verification required — call POST /auth/mfa/send then POST /auth/mfa/verify',
  OTP_SENT: 'OTP sent — check your phone',
  OTP_SEND_FAILED: 'Failed to send OTP — please try again',
  NO_ACTIVE_OTP: 'No active OTP — request a new code first',
  OPT_EXPIRED: 'OTP expired — request a new code',
  OPT_FAILED_ATTEMPTS: 'Too many failed attempts — request a new code',
  INVALID_REMAINING: 'Invalid code — no attempts remaining, request a new code',
  MISSING_PHONE: 'Phone number not set — update your profile before using SMS MFA',
  INVALID_CODE: (remaining: number) => `Invalid code — ${remaining} attempt(s) remaining`,
  INVALID_OTP_METHOD: (method: string) => `MFA method '${method}' is not supported`,
  MFA_VERIFIED: (hours: number) => `MFA verified — session valid for ${hours} hours`,
} as const;
