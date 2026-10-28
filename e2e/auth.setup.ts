import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';
const email = process.env.E2E_AUTH0_EMAIL;
const password = process.env.E2E_AUTH0_PASSWORD;

setup.skip(!email || !password, 'E2E_AUTH0_EMAIL and E2E_AUTH0_PASSWORD are not set');

setup('authenticate with Auth0', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();

  const emailInput = page.locator('input[name="email"], input[name="username"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 90_000 });
  await emailInput.fill(email!);

  const passwordInput = page.locator('input[name="password"]');
  if (!(await passwordInput.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /continue|next/i }).click();
  }
  await passwordInput.waitFor({ state: 'visible', timeout: 30_000 });
  await passwordInput.fill(password!);
  await page.getByRole('button', { name: /continue|log in|sign in/i }).click();

  const consent = page.getByRole('button', { name: /accept|allow/i });
  if (await consent.isVisible().catch(() => false)) await consent.click();

  await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible({
    timeout: 90_000,
  });

  mkdirSync(dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
