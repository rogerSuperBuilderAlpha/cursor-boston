import { expect, test, type Page } from '@playwright/test';

const TEST_PROJECT_ID = 'demo-playwright-project';

type FirebaseAuthResponse =
  | { type: 'error'; message: string }
  | { type: 'network-error' }
  | { type: 'success'; email: string; uid: string; displayName?: string };

type FirebaseAuthSuccessResponse = Extract<
  FirebaseAuthResponse,
  { type: 'success' }
>;

function base64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeIdToken({
  displayName,
  email,
  uid,
}: {
  displayName?: string;
  email: string;
  uid: string;
}): string {
  const nowSeconds = Math.floor(Date.now() / 1000);

  return [
    base64Url({ alg: 'none', typ: 'JWT' }),
    base64Url({
      aud: TEST_PROJECT_ID,
      auth_time: nowSeconds,
      email,
      email_verified: true,
      exp: nowSeconds + 3600,
      firebase: { sign_in_provider: 'password' },
      iat: nowSeconds,
      iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
      name: displayName,
      sub: uid,
      user_id: uid,
    }),
    'signature',
  ].join('.');
}

async function mockResolveEmail(page: Page): Promise<void> {
  await page.route('**/api/auth/resolve-email', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {},
      status: 200,
    });
  });
}

async function mockFirebaseEndpoint(
  page: Page,
  endpoint: string,
  responses: FirebaseAuthResponse[]
): Promise<void> {
  let responseIndex = 0;
  let currentUser: FirebaseAuthSuccessResponse | null = null;

  await page.route('**/v1/accounts:lookup**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: currentUser
        ? {
            users: [
              {
                createdAt: String(Date.now()),
                displayName: currentUser.displayName,
                email: currentUser.email,
                emailVerified: true,
                lastLoginAt: String(Date.now()),
                localId: currentUser.uid,
                providerUserInfo: [
                  {
                    email: currentUser.email,
                    providerId: 'password',
                    rawId: currentUser.email,
                  },
                ],
              },
            ],
          }
        : { users: [] },
      status: 200,
    });
  });

  await page.route('**/v1/token**', async (route) => {
    if (!currentUser) {
      await route.abort('failed');
      return;
    }

    const idToken = makeIdToken(currentUser);

    await route.fulfill({
      contentType: 'application/json',
      json: {
        access_token: idToken,
        expires_in: '3600',
        id_token: idToken,
        project_id: TEST_PROJECT_ID,
        refresh_token: `refresh-token-${currentUser.uid}`,
        token_type: 'Bearer',
        user_id: currentUser.uid,
      },
      status: 200,
    });
  });

  await page.route(`**/v1/${endpoint}**`, async (route) => {
    const response = responses[Math.min(responseIndex, responses.length - 1)];
    responseIndex += 1;

    if (response.type === 'network-error') {
      await route.abort('failed');
      return;
    }

    if (response.type === 'error') {
      await route.fulfill({
        contentType: 'application/json',
        json: { error: { message: response.message } },
        status: 400,
      });
      return;
    }

    currentUser = response;

    await route.fulfill({
      contentType: 'application/json',
      json: {
        displayName: response.displayName,
        email: response.email,
        expiresIn: '3600',
        idToken: makeIdToken(response),
        kind: 'identitytoolkit#VerifyPasswordResponse',
        localId: response.uid,
        refreshToken: `refresh-token-${response.uid}`,
        registered: true,
      },
      status: 200,
    });
  });
}

async function fillLoginForm(page: Page, password: string): Promise<void> {
  await page.getByLabel('Email').fill('member@example.com');
  await page.getByLabel('Password').fill(password);
}

function alertWithText(page: Page, text: RegExp) {
  return page.locator('[role="alert"]').filter({ hasText: text });
}

async function expectPath(page: Page, pathname: string): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
}

test.describe('auth form error recovery', () => {
  test.beforeEach(async ({ page }) => {
    await mockResolveEmail(page);
  });

  test('clears an invalid-password alert after a successful login retry', async ({
    page,
  }) => {
    await mockFirebaseEndpoint(page, 'accounts:signInWithPassword', [
      { type: 'error', message: 'INVALID_PASSWORD' },
      { type: 'success', email: 'member@example.com', uid: 'member-1' },
    ]);

    await page.goto('/login?redirect=/about');
    await fillLoginForm(page, 'wrong-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(
      alertWithText(page, /invalid email or password/i)
    ).toBeVisible();

    await page.getByLabel('Password').fill('correct-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expectPath(page, '/about');
    await expect(
      alertWithText(page, /invalid email or password/i)
    ).toHaveCount(0);
  });

  test('recovers from a transient login network error on retry', async ({ page }) => {
    await mockFirebaseEndpoint(page, 'accounts:signInWithPassword', [
      { type: 'network-error' },
      { type: 'success', email: 'member@example.com', uid: 'member-2' },
    ]);

    await page.goto('/login?redirect=/about');
    await fillLoginForm(page, 'correct-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(
      alertWithText(page, /network error/i)
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sign In' }).click();

    await expectPath(page, '/about');
    await expect(alertWithText(page, /network error/i)).toHaveCount(0);
  });

  test('clears signup password mismatch before showing the next helpful error', async ({
    page,
  }) => {
    await mockFirebaseEndpoint(page, 'accounts:signUp', [
      { type: 'error', message: 'EMAIL_EXISTS' },
    ]);

    await page.goto('/signup');
    await page.getByLabel('Name').fill('New Member');
    await page.getByLabel('Email').fill('new-member@example.com');
    await page.getByLabel('Password', { exact: true }).fill('strong-password');
    await page.getByLabel('Confirm Password').fill('different-password');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(
      alertWithText(page, /passwords do not match/i)
    ).toBeVisible();

    await page.getByLabel('Confirm Password').fill('strong-password');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText('Passwords do not match')).toHaveCount(0);
    await expect(
      alertWithText(page, /account with this email already exists/i)
    ).toBeVisible();
  });
});
