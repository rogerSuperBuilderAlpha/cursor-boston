import { test, expect } from '@playwright/test';

const LEGAL_PAGES = [
  { path: '/privacy', heading: /privacy/i },
  { path: '/terms', heading: /terms/i },
  { path: '/code-of-conduct', heading: /code of conduct/i },
  { path: '/cookies', heading: /cookie/i },
  { path: '/disclaimer', heading: /disclaimer/i },
];

test.describe('Legal pages', () => {
  for (const { path, heading } of LEGAL_PAGES) {
    test(`${path} renders with correct heading`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      await expect(
        page.getByRole('heading', { name: heading }).first()
      ).toBeVisible();
    });
  }
});
