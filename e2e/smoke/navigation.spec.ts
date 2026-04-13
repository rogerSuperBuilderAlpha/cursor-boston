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

    const welcomeDialog = page.getByRole('dialog');
    if (await welcomeDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await welcomeDialog.getByRole('button').first().click();
      await expect(welcomeDialog).toBeHidden();
    }

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
