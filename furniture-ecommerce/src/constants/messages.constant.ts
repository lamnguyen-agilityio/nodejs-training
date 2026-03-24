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
} as const;
