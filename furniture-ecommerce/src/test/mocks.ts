import type { EntityManager } from '@mikro-orm/postgresql';
import type { PinoLogger } from 'nestjs-pino';

/**
 * creates a fresh jest mock for EntityManager.
 * call inside beforeEach to get isolated mocks per test.
 *
 * usage:
 * ```ts
 * import { createMockEm, createMockLogger } from '@/test/mocks';
 *
 * const mockEm = createMockEm();
 * const mockLogger = createMockLogger();
 *
 * beforeEach(() => {
 *   jest.clearAllMocks();
 *   repository = new MyRepository(
 *     mockEm as unknown as EntityManager,
 *     mockLogger as unknown as PinoLogger,
 *   );
 * });
 * ```
 */
export const createMockEm = (): jest.Mocked<
  Pick<
    EntityManager,
    | 'find'
    | 'findOne'
    | 'findAndCount'
    | 'create'
    | 'persist'
    | 'flush'
    | 'assign'
    | 'clear'
    | 'remove'
    | 'nativeDelete'
    | 'nativeUpdate'
    | 'fork'
    | 'transactional'
  >
> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  persist: jest.fn(),
  flush: jest.fn(),
  assign: jest.fn(),
  clear: jest.fn(),
  remove: jest.fn(),
  nativeDelete: jest.fn(),
  nativeUpdate: jest.fn(),
  fork: jest.fn(),
  transactional: jest.fn(),
});

/**
 * creates a fresh jest mock for PinoLogger.
 */
export const createMockLogger = (): jest.Mocked<
  Pick<PinoLogger, 'setContext' | 'info' | 'warn' | 'error' | 'debug'>
> => ({
  setContext: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});
