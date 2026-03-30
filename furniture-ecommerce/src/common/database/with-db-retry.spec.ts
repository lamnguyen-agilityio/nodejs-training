import { faker } from '@faker-js/faker';
import { ConflictException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { DB_ERROR_CODES } from './db-error-codes.constant';
import { withDbRetry } from './with-db-retry';

// override the module-level sleep by mocking setTimeout
jest.useFakeTimers();

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeRetryableError = (code: string = DB_ERROR_CODES.DEADLOCK_DETECTED) =>
  Object.assign(new Error('transient'), { code });

const makeConflictError = () =>
  Object.assign(new Error('duplicate'), { code: DB_ERROR_CODES.UNIQUE_VIOLATION });

const makeUnknownError = () => new Error('unknown error');

const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
} satisfies Partial<jest.Mocked<PinoLogger>>;

// helper: run withDbRetry and advance all timers concurrently
const runWithRetry = <T>(operation: () => Promise<T>, options = {}): Promise<T> => {
  const promise = withDbRetry(operation, options);
  jest.runAllTimersAsync();
  return promise;
};

// ─── suite ───────────────────────────────────────────────────────────────────

describe('withDbRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  // ── success ────────────────────────────────────────────────────────────────

  describe('success', () => {
    it('should return result when operation succeeds on first attempt', async () => {
      const expected = faker.string.uuid();
      const operation = jest.fn().mockResolvedValue(expected);

      const result = await runWithRetry(operation);

      expect(result).toBe(expected);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should return result when operation succeeds after one retry', async () => {
      const expected = faker.string.uuid();
      const operation = jest
        .fn()
        .mockRejectedValueOnce(makeRetryableError())
        .mockResolvedValueOnce(expected);

      const result = await runWithRetry(operation);

      expect(result).toBe(expected);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  // ── conflict — unique violation ────────────────────────────────────────────

  describe('conflict', () => {
    it('should throw ConflictException immediately for unique violation', async () => {
      const operation = jest.fn().mockRejectedValue(makeConflictError());

      await expect(runWithRetry(operation)).rejects.toThrow(ConflictException);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry on unique violation', async () => {
      const operation = jest.fn().mockRejectedValue(makeConflictError());

      await expect(runWithRetry(operation)).rejects.toThrow(ConflictException);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  // ── unknown error — no retry ───────────────────────────────────────────────

  describe('unknown error', () => {
    it('should rethrow unknown error immediately without retry', async () => {
      const error = makeUnknownError();
      const operation = jest.fn().mockRejectedValue(error);

      await expect(runWithRetry(operation)).rejects.toThrow('unknown error');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not be a ConflictException for unknown errors', async () => {
      const operation = jest.fn().mockRejectedValue(makeUnknownError());

      await expect(runWithRetry(operation)).rejects.not.toThrow(ConflictException);
    });
  });

  // ── retry — transient errors ───────────────────────────────────────────────

  describe('retry behavior', () => {
    it('should retry on deadlock (40P01)', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(makeRetryableError(DB_ERROR_CODES.DEADLOCK_DETECTED))
        .mockResolvedValueOnce('success');

      const result = await runWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on FK violation (23503)', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(makeRetryableError(DB_ERROR_CODES.FOREIGN_KEY_VIOLATION))
        .mockResolvedValueOnce('success');

      const result = await runWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on connection failure (08006)', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(makeRetryableError(DB_ERROR_CODES.CONNECTION_FAILURE))
        .mockResolvedValueOnce('success');

      const result = await runWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should exhaust all 3 retries and throw when all attempts fail', async () => {
      const error = makeRetryableError();
      const operation = jest.fn().mockRejectedValue(error);

      await expect(runWithRetry(operation, { maxRetries: 3 })).rejects.toThrow('transient');
      // initial + 3 retries = 4 total
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it('should respect custom maxRetries', async () => {
      const operation = jest.fn().mockRejectedValue(makeRetryableError());

      await expect(runWithRetry(operation, { maxRetries: 1 })).rejects.toThrow();
      // initial + 1 retry = 2 total
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  // ── logging ────────────────────────────────────────────────────────────────

  describe('logging', () => {
    it('should log warn on each retry attempt', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(makeRetryableError())
        .mockResolvedValueOnce('ok');

      await runWithRetry(operation, { logger: mockLogger as unknown as PinoLogger, label: 'test' });

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'test' }),
        expect.stringContaining('retrying'),
      );
    });

    it('should log error when all retries are exhausted', async () => {
      const operation = jest.fn().mockRejectedValue(makeRetryableError());

      await expect(
        runWithRetry(operation, {
          logger: mockLogger as unknown as PinoLogger,
          label: 'exhausted',
          maxRetries: 1,
        }),
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'exhausted' }),
        expect.stringContaining('exhausted'),
      );
    });

    it('should not log when no logger is provided', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(makeRetryableError())
        .mockResolvedValueOnce('ok');

      await expect(runWithRetry(operation, { maxRetries: 1 })).resolves.toBe('ok');
    });

    it('should use default label when label is not provided', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(makeRetryableError())
        .mockResolvedValueOnce('ok');

      await runWithRetry(operation, { logger: mockLogger as unknown as PinoLogger });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'db operation' }),
        expect.any(String),
      );
    });
  });
});
