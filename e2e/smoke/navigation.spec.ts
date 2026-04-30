import { test, expect } from '@playwright/test';

const NAV_ROUTES = [
  { label: /Events/i, path: '/events' },
  { label: /Members/i, path: '/members' },
  { label: /Hackathons/i, path: '/hackathons' },
  { label: /About/i, path: '/about' },
];

test.describe('Sidebar navigation', () => {
  test('navigates to key pages via sidebar links', async ({ page }) => {
    await page.goto('/');

    // Dismiss any auto-opening dialogs (Welcome modal, Summer Cohort modal, etc.).
    // When multiple dialogs render concurrently, later ones stack on top — close
    // the topmost (last) first so its backdrop doesn't intercept our click.
    // Locators re-resolve on each call, so assert by count decreasing rather
    // than checking a specific dialog handle.
    const dialogs = page.getByRole('dialog');
    for (let i = 0; i < 5; i++) {
      const before = await dialogs.count();
      if (before === 0) break;
      const top = dialogs.last();
      if (!(await top.isVisible({ timeout: 1_000 }).catch(() => false))) break;
      const closeBtn = top.getByRole('button', { name: /close/i }).first();
      if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await closeBtn.click();
      } else {
        await top.getByRole('button').first().click();
      }
      await expect.poll(() => dialogs.count(), { timeout: 5_000 }).toBeLessThan(before);
    }
    await expect(dialogs).toHaveCount(0);

    const sidebar = page.locator('aside[aria-label="Site navigation"]');

    for (const route of NAV_ROUTES) {
      const link = sidebar.getByRole('link', { name: route.label }).first();
      await link.click();
      await page.waitForURL(`**${route.path}`);
      await expect(page.locator('#main-content')).toBeAttached();
    }
  });

  test('each navigated page has a proper heading', async ({ page }) => {
    for (const route of NAV_ROUTES) {
      await page.goto(route.path);
      const heading = page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).first();
      await expect(heading).toBeVisible();
    }
  });
});
