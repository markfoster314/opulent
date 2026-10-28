import { expect, test } from '@playwright/test';

test.skip(
  !process.env.E2E_AUTH0_EMAIL || !process.env.E2E_AUTH0_PASSWORD,
  'Auth0 test credentials are not set',
);

test('reuses the saved Auth0 session', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();
});
