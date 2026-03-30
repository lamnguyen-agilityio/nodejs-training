import { ConflictException } from '@nestjs/common';

import { DB_ERROR_CODES } from './db-error-codes.constant';

/**
 * result of classifying a database error.
 *
 * - `retry`    — transient error, safe to retry (deadlock, FK violation, connection loss).
 * - `conflict` — unique constraint violation, throw 409 immediately.
 * - `throw`    — unknown or unrecoverable error, rethrow as-is.
 */
export type DbErrorClassification = 'retry' | 'conflict' | 'throw';

/**
 * PostgreSQL error codes that are safe to retry.
 * these are transient — the same operation may succeed on a subsequent attempt.
 */
const RETRYABLE_CODES = new Set<string>([
  DB_ERROR_CODES.FOREIGN_KEY_VIOLATION,
  DB_ERROR_CODES.DEADLOCK_DETECTED,
  DB_ERROR_CODES.SERIALIZATION_FAILURE,
  DB_ERROR_CODES.CONNECTION_EXCEPTION,
  DB_ERROR_CODES.CONNECTION_DOES_NOT_EXIST,
  DB_ERROR_CODES.CONNECTION_FAILURE,
  DB_ERROR_CODES.QUERY_CANCELED,
]);

/**
 * extract the PostgreSQL error code from a raw error object.
 * MikroORM wraps driver errors — the pg error code is on the nested cause.
 */
const extractPgCode = (err: unknown): string | undefined => {
  if (!err || typeof err !== 'object') return undefined;

  const e = err as Record<string, unknown>;

  // direct pg error code
  if (typeof e['code'] === 'string') return e['code'];

  // MikroORM wraps driver error in .cause
  if (e['cause'] && typeof e['cause'] === 'object') {
    const cause = e['cause'] as Record<string, unknown>;
    if (typeof cause['code'] === 'string') return cause['code'];
  }

  return undefined;
};

/**
 * classify a database error to determine retry behavior.
 */
export const classifyDbError = (err: unknown): DbErrorClassification => {
  const code = extractPgCode(err);

  if (!code) return 'throw';

  if (code === DB_ERROR_CODES.UNIQUE_VIOLATION) return 'conflict';
  if (RETRYABLE_CODES.has(code)) return 'retry';

  return 'throw';
};

/**
 * convert a classified conflict error into a NestJS ConflictException (409).
 */
export const toConflictException = (err: unknown): ConflictException => {
  const e = err as Record<string, unknown>;
  let detail: string = 'Resource already exists';

  if (typeof e['detail'] === 'string') {
    detail = e['detail'];
  } else if (e['cause'] && typeof e['cause'] === 'object') {
    const cause = e['cause'] as Record<string, unknown>;

    if (typeof cause['detail'] === 'string') {
      detail = cause['detail'];
    }
  }

  return new ConflictException(detail);
};
