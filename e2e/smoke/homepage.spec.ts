import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('renders the hero section with title and CTAs', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /Boston's Cursor Community/i })
    ).toBeVisible();

    await expect(page.getByRole('link', { name: /View Events/i })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Subscribe to Events/i })
    ).toBeVisible();
  });

  test('renders the audience cards section', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /Who's This For/i })
    ).toBeVisible();

    for (const audience of ['Students', 'Startup Founders', 'Developers', 'Designers & PMs', 'AI Agents']) {
      await expect(page.getByRole('heading', { name: audience })).toBeVisible();
    }
  });

  test('renders the community and CTA sections', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /Join Our Community/i })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Join Discord Server/i }).first()
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: /Ready to Level Up/i })
    ).toBeVisible();
  });

  test('skip-to-content link targets main content', async ({ page }) => {
    await page.goto('/');

    const skipLink = page.getByRole('link', { name: /Skip to main content/i });
    await expect(skipLink).toBeAttached();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});
