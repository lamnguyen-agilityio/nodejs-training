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

  //  ── clerk messages ────────────────────────────────────────────────────────────────────────
  INVALID_EMAIL_ADDRESS: 'Clerk user has no verified email address',
} as const;
