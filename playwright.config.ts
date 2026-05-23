import { defineConfig, devices } from '@playwright/test';

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '3000';
const playwrightBaseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${playwrightPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4,
  reporter: process.env.CI ? 'list' : 'html',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',

  use: {
    baseURL: playwrightBaseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run build && npx next start -p ${playwrightPort}`,
    url: playwrightBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test-project.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project-id',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abcdef',
      NEXT_PUBLIC_FIREBASE_DATABASE_URL: 'https://test-project.firebaseio.com',
      UNSUBSCRIBE_SECRET: 'playwright-test-unsubscribe-secret-32b',
    },
  },
});
