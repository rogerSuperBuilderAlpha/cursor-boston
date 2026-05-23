import { expect, test, type Page } from '@playwright/test';

const SUMMER_COHORT_MODAL_STORAGE_KEY =
  'cursor-boston-summer-cohort-modal-shown-date';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function dismissDialogs(page: Page): Promise<void> {
  const dialogs = page.getByRole('dialog');

  for (let i = 0; i < 5; i += 1) {
    const before = await dialogs.count();
    if (before === 0) break;

    const top = dialogs.last();
    if (!(await top.isVisible({ timeout: 1_000 }).catch(() => false))) break;

    const closeButton = top.getByRole('button', { name: /close/i }).first();
    if (await closeButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeButton.click();
    } else {
      await top.getByRole('button').first().click();
    }

    await expect.poll(() => dialogs.count(), { timeout: 5_000 }).toBeLessThan(before);
  }

  await expect(dialogs).toHaveCount(0);
}

async function openWithTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ initialTheme, modalStorageKey, modalShownDate }) => {
      window.localStorage.setItem('theme', initialTheme);
      window.localStorage.setItem(modalStorageKey, modalShownDate);
    },
    {
      initialTheme: theme,
      modalStorageKey: SUMMER_COHORT_MODAL_STORAGE_KEY,
      modalShownDate: todayKey(),
    }
  );
  await page.reload();
  await dismissDialogs(page);
}

async function selectTheme(page: Page, themeName: 'Light' | 'Dark'): Promise<void> {
  await page.getByRole('button', { name: /toggle theme/i }).click();
  await page.getByRole('menuitem', { name: themeName }).click();
}

async function expectTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('theme')))
    .toBe(theme);

  const html = page.locator('html');
  if (theme === 'dark') {
    await expect(html).toHaveClass(/dark/);
  } else {
    await expect(html).not.toHaveClass(/dark/);
  }
}

test.describe('theme persistence', () => {
  test('persists dark theme selection after reload', async ({ page }) => {
    await openWithTheme(page, 'light');

    await selectTheme(page, 'Dark');
    await expectTheme(page, 'dark');

    await page.reload();
    await dismissDialogs(page);
    await expectTheme(page, 'dark');
  });

  test('persists light theme selection after reload', async ({ page }) => {
    await openWithTheme(page, 'dark');

    await selectTheme(page, 'Light');
    await expectTheme(page, 'light');

    await page.reload();
    await dismissDialogs(page);
    await expectTheme(page, 'light');
  });

  test('syncs theme changes across tabs in the same browser context', async ({
    context,
    page,
  }) => {
    await openWithTheme(page, 'light');
    const secondPage = await context.newPage();
    await openWithTheme(secondPage, 'light');

    await selectTheme(page, 'Dark');

    await expectTheme(page, 'dark');
    await expectTheme(secondPage, 'dark');
  });
});
