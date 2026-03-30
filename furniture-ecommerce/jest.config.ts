import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
      },
    ],
    '^.+\\.js$': [
      'babel-jest',
      {
        plugins: ['babel-plugin-transform-import-meta'],
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(.pnpm|jose|@mikro-orm|jwks-rsa))'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',

    // ── exclude: config & bootstrap ──────────────────────────────────────
    '!main.ts',
    '!**/*.module.ts',
    '!**/config/**',
    '!**/logger/**',

    // ── exclude: static definitions (no logic to test) ───────────────────
    '!**/constants/**',
    '!**/enums/**',
    '!**/interfaces/**',
    '!**/dtos/**',
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
  setupFilesAfterEnv: ['<rootDir>/../test-setup.ts'],
};

export default config;
