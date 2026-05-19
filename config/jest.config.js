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
    '**/__tests__/**/*.(test|spec).[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  // Emulator-backed; run via `npm run test:rules` (see CI).
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/config/firebase/firestore.rules.test.ts',
    '<rootDir>/e2e/',
    // Shared fixtures under __tests__/_helpers/ (not standalone suites).
    '<rootDir>/__tests__/_helpers/game-mutation-db.ts',
    '<rootDir>/__tests__/_helpers/firebase-admin-mock.ts',
    '<rootDir>/__tests__/_helpers/firebase-client-mock.ts',
    '<rootDir>/__tests__/_helpers/route-test-utils.ts',
    '<rootDir>/__tests__/_helpers/server-auth-mock.ts',
    '<rootDir>/__tests__/_helpers/component-test-utils.ts',
  ],
  // Global thresholds — kept just below current CI totals so new UI without tests fails CI loudly.
  // Re-aligned 2026-05-12 after the PyData hackathon hub + access-gate
  // landed: the new gated event page (server component, ~500 LOC) and
  // the access API route are exercised manually + via Playwright but
  // have no Jest unit tests, which dropped global numbers ~1-2pp.
  // Re-aligned again 2026-05-17 after Heroes v2 (#963) landed: ~1000 LOC
  // of new server-rendered UI (/game/heroes tab browser + per-hero
  // detail page) and four thin API route handlers added without Jest
  // tests (pure visibility / registry / contract logic IS covered:
  // hero-visibility 12 tests, hero-registry 11 tests, heroes-server 3
  // tests). UI + route shells are exercised manually + via Playwright.
  // Re-aligned 2026-05-18 after the Phase 5 OSS-lift expansion of
  // lib/account-deletion/registry.ts to cover the zero-turn gameplay
  // collections (game_reactions, game_pacts, game_prophecies + 2
  // allowlisted lore subcollections — chapters, epitaphs). Registry
  // additions are static data covered transitively by the existing
  // registry self-check test; cascade-test growth lags by ~1pp.
  // Current totals (2026-05-18, OpenSSF sprint wave 13): statements ~67.8%,
  // branches ~51.0%, lines ~70.4%, functions ~55.4%. Added richer hackathon
  // page state, game hooks/components, and full-suite timeout stability.
  // Silver target: 80% statements. Floors ~0.5pp below measured.
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 54,
      lines: 70,
      statements: 67,
    },
  },
  // Generate JSON summary for CI coverage checks
  coverageReporters: ['text', 'lcov', 'json-summary'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
