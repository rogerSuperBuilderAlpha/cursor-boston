import { expect, test, type Page } from '@playwright/test';

const COHORT_MODAL_STORAGE_KEY =
  'cursor-boston-summer-cohort-modal-shown-date';

async function suppressAutoDialogs(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, new Date().toISOString().slice(0, 10));
  }, COHORT_MODAL_STORAGE_KEY);
}

test.describe('Cookbook', () => {
  test('renders the cookbook header', async ({ page }) => {
    await suppressAutoDialogs(page);
    await page.goto('/cookbook');

    await expect(
      page.getByRole('heading', { name: /Prompt & Rules Cookbook/i })
    ).toBeVisible();

    await expect(
      page.getByText(/A recipe book for AI-native coding/i).first()
    ).toBeVisible();
  });

  test('add-a-prompt accordion expands to the anonymous sign-in prompt', async ({
    page,
  }) => {
    await suppressAutoDialogs(page);
    await page.goto('/cookbook');

    const toggle = page.getByRole('button', {
      name: /Add a Prompt or Rule/i,
    });
    await expect(toggle).toBeVisible();

    await expect(
      page.getByText('Sign in to submit a prompt or rule.')
    ).toBeHidden();

    await toggle.click();

    await expect(
      page.getByText('Sign in to submit a prompt or rule.')
    ).toBeVisible();
    const signInLink = page
      .getByText('Sign in to submit a prompt or rule.')
      .locator('..')
      .getByRole('link', { name: 'Sign In' });
    await expect(signInLink).toHaveAttribute('href', '/login?redirect=/cookbook');
  });

  test('renders search and filter controls with accessible labels', async ({
    page,
  }) => {
    await suppressAutoDialogs(page);
    await page.goto('/cookbook');

    const search = page.getByLabel('Search');
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute('type', 'search');
    await expect(search).toHaveAttribute(
      'placeholder',
      /Search title, description, tags/
    );

    const category = page.getByLabel('Category');
    await expect(category).toBeVisible();
    expect(await category.locator('option').count()).toBeGreaterThan(1);

    const worksWith = page.getByLabel('Works with');
    await expect(worksWith).toBeVisible();
    expect(await worksWith.locator('option').count()).toBeGreaterThan(1);

    const sort = page.getByLabel('Sort by');
    await expect(sort).toBeVisible();
    await expect(sort.locator('option')).toContainText([
      'Top rated',
      'Newest',
      'Oldest',
    ]);
  });

  test('searching locks the sort control to newest', async ({ page }) => {
    await suppressAutoDialogs(page);
    await page.goto('/cookbook');

    const sort = page.getByLabel('Sort by');
    await expect(sort).toBeEnabled();

    await page.getByLabel('Search').fill('prompt');

    await expect(sort).toBeDisabled();
    await expect(sort).toHaveAttribute('aria-disabled', 'true');
    await expect(
      page.getByText(/Sort uses newest first while searching/i)
    ).toBeVisible();
  });
});