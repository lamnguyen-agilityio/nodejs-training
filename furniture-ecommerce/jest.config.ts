import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',

    // ── exclude: config & bootstrap ──────────────────────────────────────
    '!main.ts',
    '!**/*.module.ts',
    '!**/config/**',

    // ── exclude: static definitions (no logic to test) ───────────────────
    '!**/constants/**',
    '!**/enums/**',
    '!**/interfaces/**',
    '!**/dto/**',
    '!**/entities/**',

    // ── exclude: barrel files (re-exports only, no logic) ────────────────
    '!**/index.ts',

    // ── exclude: database migrations ─────────────────────────────────────
    '!**/migrations/**',

    // ── exclude: test files themselves ───────────────────────────────────
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
  clearMocks: true,
  restoreMocks: true,
};

export default config;
