import { test, expect } from '@playwright/test';

const PUBLIC_PAGES = [
  { path: '/events', heading: /events/i },
  { path: '/members', heading: /community/i },
  { path: '/about', heading: /about/i },
  { path: '/cookbook', heading: /cookbook/i },
  { path: '/blog', heading: /blog/i },
  { path: '/analytics', heading: /analytics/i },
  { path: '/showcase', heading: /showcase/i },
  { path: '/open-source', heading: /build with us/i },
];

test.describe('Public pages load without errors', () => {
  for (const { path, heading } of PUBLIC_PAGES) {
    test(`${path} loads and renders a heading`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => {
        if (/config-fetch-failed|API key not valid/i.test(err.message)) return;
        errors.push(err.message);
      });

      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);

      const h = page.getByRole('heading', { name: heading }).first();
      await expect(h).toBeVisible({ timeout: 10_000 });

      expect(errors).toHaveLength(0);
    });
  }
});
