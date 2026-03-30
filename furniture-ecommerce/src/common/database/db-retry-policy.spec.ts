import { faker } from '@faker-js/faker';
import { ConflictException } from '@nestjs/common';

import { DB_ERROR_CODES } from './db-error-codes.constant';
import { classifyDbError, toConflictException } from './db-retry-policy';

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeError = (code: string, detail?: string) =>
  Object.assign(new Error('db error'), { code, detail });

const makeWrappedError = (code: string, detail?: string) =>
  Object.assign(new Error('wrapper'), {
    cause: Object.assign(new Error('cause'), { code, detail }),
  });

// ─── suite ───────────────────────────────────────────────────────────────────

describe('db-retry-policy', () => {
  // ── classifyDbError ────────────────────────────────────────────────────────

  describe('classifyDbError', () => {
    describe('conflict — unique violation', () => {
      it('should return conflict for unique violation (23505)', () => {
        expect(classifyDbError(makeError(DB_ERROR_CODES.UNIQUE_VIOLATION))).toBe('conflict');
      });

      it('should return conflict for unique violation wrapped in cause', () => {
        expect(classifyDbError(makeWrappedError(DB_ERROR_CODES.UNIQUE_VIOLATION))).toBe('conflict');
      });
    });

    describe('retry — transient errors', () => {
      it('should return retry for FK violation (23503)', () => {
        expect(classifyDbError(makeError(DB_ERROR_CODES.FOREIGN_KEY_VIOLATION))).toBe('retry');
      });

      it('should return retry for deadlock (40P01)', () => {
        expect(classifyDbError(makeError(DB_ERROR_CODES.DEADLOCK_DETECTED))).toBe('retry');
      });

      it('should return retry for serialization failure (40001)', () => {
        expect(classifyDbError(makeError(DB_ERROR_CODES.SERIALIZATION_FAILURE))).toBe('retry');
      });

      it('should return retry for connection exception (08000)', () => {
        expect(classifyDbError(makeError(DB_ERROR_CODES.CONNECTION_EXCEPTION))).toBe('retry');
      });

      it('should return retry for connection does not exist (08003)', () => {
        expect(classifyDbError(makeError(DB_ERROR_CODES.CONNECTION_DOES_NOT_EXIST))).toBe('retry');
      });

      it('should return retry for connection failure (08006)', () => {
        expect(classifyDbError(makeError(DB_ERROR_CODES.CONNECTION_FAILURE))).toBe('retry');
      });

      it('should return retry for query canceled (57014)', () => {
        expect(classifyDbError(makeError(DB_ERROR_CODES.QUERY_CANCELED))).toBe('retry');
      });

      it('should return retry for retryable error wrapped in cause', () => {
        expect(classifyDbError(makeWrappedError(DB_ERROR_CODES.DEADLOCK_DETECTED))).toBe('retry');
      });
    });

    describe('throw — unknown errors', () => {
      it('should return throw for unknown pg error code', () => {
        expect(classifyDbError(makeError('99999'))).toBe('throw');
      });

      it('should return throw when error has no code', () => {
        expect(classifyDbError(new Error('no code'))).toBe('throw');
      });

      it('should return throw for null', () => {
        expect(classifyDbError(null)).toBe('throw');
      });

      it('should return throw for undefined', () => {
        expect(classifyDbError(undefined)).toBe('throw');
      });

      it('should return throw for primitive string', () => {
        expect(classifyDbError('some string error')).toBe('throw');
      });

      it('should return throw for primitive number', () => {
        expect(classifyDbError(42)).toBe('throw');
      });

      it('should return throw when code is not a string', () => {
        expect(classifyDbError({ code: 23505 })).toBe('throw');
      });

      it('should return throw when cause code is not a string', () => {
        expect(classifyDbError({ cause: { code: 23505 } })).toBe('throw');
      });
    });
  });

  // ── toConflictException ────────────────────────────────────────────────────

  describe('toConflictException', () => {
    it('should return ConflictException', () => {
      const result = toConflictException(makeError(DB_ERROR_CODES.UNIQUE_VIOLATION));
      expect(result).toBeInstanceOf(ConflictException);
    });

    it('should use detail from direct error', () => {
      const detail = faker.lorem.sentence();
      const error = makeError(DB_ERROR_CODES.UNIQUE_VIOLATION, detail);
      const result = toConflictException(error);
      expect(result.message).toBe(detail);
    });

    it('should use detail from nested cause when direct detail is missing', () => {
      const detail = faker.lorem.sentence();
      const error = makeWrappedError(DB_ERROR_CODES.UNIQUE_VIOLATION, detail);
      const result = toConflictException(error);
      expect(result.message).toBe(detail);
    });

    it('should fallback to default message when no detail present', () => {
      const result = toConflictException(makeError(DB_ERROR_CODES.UNIQUE_VIOLATION));
      expect(result.message).toBe('Resource already exists');
    });

    it('should return 409 status code', () => {
      const result = toConflictException(makeError(DB_ERROR_CODES.UNIQUE_VIOLATION));
      expect(result.getStatus()).toBe(409);
    });
  });
});
