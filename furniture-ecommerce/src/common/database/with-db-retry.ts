import { PinoLogger } from 'nestjs-pino';

import { classifyDbError, toConflictException } from './db-retry-policy';

// exponential backoff delays in ms: attempt 1 = 100ms, 2 = 200ms, 3 = 400ms
const BACKOFF_DELAYS_MS = [100, 200, 400];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface DbRetryOptions {
  maxRetries?: number;
  label?: string;
  logger?: PinoLogger;
}

/**
 * execute a database operation with automatic retry on transient errors.
 *
 * classification:
 *  - unique violation (23505) → throw ConflictException (409) immediately.
 *  - FK / deadlock / connection → retry up to maxRetries times with
 *    exponential backoff (100ms → 200ms → 400ms).
 *  - unknown → rethrow immediately.
 */
export const withDbRetry = async <T>(
  operation: () => Promise<T>,
  options: DbRetryOptions = {},
): Promise<T> => {
  const { maxRetries = 3, label = 'db operation', logger } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      const classification = classifyDbError(err);

      if (classification === 'conflict') {
        throw toConflictException(err);
      }

      if (classification === 'throw') {
        throw err;
      }

      // classification === 'retry'
      if (attempt === maxRetries) {
        logger?.error(
          { err, label, attempt },
          `[${label}] All ${maxRetries} retries exhausted — giving up`,
        );
        throw err;
      }

      const delayMs = BACKOFF_DELAYS_MS[attempt] ?? BACKOFF_DELAYS_MS.at(-1)!;

      logger?.warn(
        { label, attempt: attempt + 1, maxRetries: maxRetries + 1, delayMs },
        `[${label}] Transient DB error on attempt ${attempt + 1}/${maxRetries + 1} — retrying in ${delayMs}ms`,
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
};
