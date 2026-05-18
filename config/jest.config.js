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
  // Current totals (2026-05-18 CI, after coverage pushes #23-58): statements ~40.7%,
  // branches ~31.4%, lines ~41.9%, functions ~33.2%. Pushes #45-58 lifted
  // statements ~3.3pp via lib/game/{data-server-{constants,errors,reads},
  // community,hero-lore,world-snapshot,armageddon-resolve,reactions} +
  // lib/{maintainer-github-queue,cursor/cloud-agents,summer-cohort-{intake,
  // submissions},hackathon-asprint-2026-credit-eligibility,blog}.
  // Floors set ~0.5pp below current → any regression fails CI.
  // Ratchet these UP as tests are added; the OSS-readiness lift (Phase 5.4)
  // targets statements ≥80% (OpenSSF Silver `test_statement_coverage80`) by
  // adding tests across the 95 untested API route handlers and the game data
  // layer at lib/game/data-server.ts etc.
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 32,
      lines: 41,
      statements: 40,
    },
  },
  // Generate JSON summary for CI coverage checks
  coverageReporters: ['text', 'lcov', 'json-summary'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
