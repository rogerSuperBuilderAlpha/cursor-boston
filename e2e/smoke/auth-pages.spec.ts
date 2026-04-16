import { test, expect } from '@playwright/test';

test.describe('Auth pages', () => {
  test('/login renders sign-in form', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);

    const heading = page.getByRole('heading', { name: /sign in|log in|welcome/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('/signup renders sign-up form', async ({ page }) => {
    const response = await page.goto('/signup');
    expect(response?.status()).toBe(200);

    const heading = page.getByRole('heading', { name: /sign up|create|get started|join/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
