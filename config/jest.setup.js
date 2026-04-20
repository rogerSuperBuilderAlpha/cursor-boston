// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// jsdom does not expose Node's TextEncoder/TextDecoder on the global scope,
// but next/cache (pulled in transitively by lib/hackathon-showcase) requires them.
if (typeof globalThis.TextEncoder === 'undefined') {
  const util = require('util')
  globalThis.TextEncoder = util.TextEncoder
  globalThis.TextDecoder = util.TextDecoder
}

// Stub next/cache for unit tests. `unstable_cache` and `revalidateTag` need
// Next's request-scoped incremental cache store, which Jest route-handler
// tests don't set up. Pass-through unstable_cache (no caching — every call
// executes the fn fresh) and no-op revalidateTag/revalidatePath is accurate
// for unit-test assertions; cache behavior itself is integration-verified.
jest.mock('next/cache', () => ({
  unstable_cache: (fn) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}))

// Mock environment variables for tests
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key'
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test-project.firebaseapp.com'
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project-id'
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test-project.appspot.com'
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'test-sender-id'
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'test-app-id'
process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = 'https://test-project.firebaseio.com'
