import { test, expect } from '@playwright/test';

test.describe('Hackathons', () => {
  test('/hackathons loads with a heading', async ({ page }) => {
    const response = await page.goto('/hackathons');
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole('heading', { name: /hackathon/i }).first()
    ).toBeVisible();
  });

  test('hack-a-sprint-2026 sub-pages are accessible', async ({ page }) => {
    const subPages = [
      '/hackathons/hack-a-sprint-2026',
      '/hackathons/hack-a-sprint-2026/instructions',
    ];

    for (const path of subPages) {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);

      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    }
  });
});
