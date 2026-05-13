const path = require('path')
const nextJest = require('next/jest')

// Root directory is the parent of config/
const rootDir = path.join(__dirname, '..')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: rootDir,
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  rootDir,
  setupFilesAfterEnv: ['<rootDir>/config/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'contexts/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  // Emulator-backed; run via `npm run test:rules` (see CI).
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/config/firebase/firestore.rules.test.ts',
    '<rootDir>/e2e/',
  ],
  // Global thresholds — kept just below current CI totals so new UI without tests fails CI loudly.
  // Re-aligned 2026-05-12 after the PyData hackathon hub + access-gate
  // landed: the new gated event page (server component, ~500 LOC) and
  // the access API route are exercised manually + via Playwright but
  // have no Jest unit tests, which dropped global numbers ~1-2pp.
  // Pure lib pieces (pydata-2026-access, pydata-submissions) have full
  // unit tests; the gate + banner components are tested via RTL.
  // Current totals: statements 32.37%, branches 25.22%, lines 33.62%, functions 24.49%.
  // Floors set ~1pp below current → any regression fails CI.
  // Ratchet these UP as tests are added; the OSS-readiness lift (Sprints 2-5)
  // targets statements ≥75% by adding ~150 tests across the 95 untested API
  // route handlers and the game data layer at lib/game/data-server.ts etc.
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 24,
      lines: 33,
      statements: 32,
    },
  },
  // Generate JSON summary for CI coverage checks
  coverageReporters: ['text', 'lcov', 'json-summary'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
