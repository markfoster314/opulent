import { expect, test } from '@playwright/test';

test('landing page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('unknown route shows the not-found page', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByText(/not found/i)).toBeVisible();
});
