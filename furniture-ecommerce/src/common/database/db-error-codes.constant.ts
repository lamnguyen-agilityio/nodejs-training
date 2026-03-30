/**
 * PostgreSQL error codes relevant to retry logic.
 * full list: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const DB_ERROR_CODES = {
  // class 23 — integrity constraint violation
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',

  // class 40 — transaction rollback
  DEADLOCK_DETECTED: '40P01',
  SERIALIZATION_FAILURE: '40001',

  // class 08 — connection exception
  CONNECTION_EXCEPTION: '08000',
  CONNECTION_DOES_NOT_EXIST: '08003',
  CONNECTION_FAILURE: '08006',

  // class 57 — operator intervention
  QUERY_CANCELED: '57014',
} as const;

export type DbErrorCode = (typeof DB_ERROR_CODES)[keyof typeof DB_ERROR_CODES];
