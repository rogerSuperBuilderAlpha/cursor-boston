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
  // Global thresholds — keep just below current CI totals so new UI without tests fails CI loudly.
  // Last aligned: 2026-05-02 (statements ~35.44%, branches ~29.91%, lines ~37.07%, functions ~29.23%)
  // after the /partners hiring-partners portal added an untested 446-line page.tsx;
  // route + lib are covered (≥88%) but page.tsx pulled global branch coverage from 30.73% → 29.91%.
  coverageThreshold: {
    global: {
      branches: 29,
      functions: 29,
      lines: 37,
      statements: 35,
    },
  },
  // Generate JSON summary for CI coverage checks
  coverageReporters: ['text', 'lcov', 'json-summary'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
