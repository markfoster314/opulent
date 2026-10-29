import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const authEnabled = Boolean(process.env.E2E_AUTH0_EMAIL && process.env.E2E_AUTH0_PASSWORD);
const authFile = 'playwright/.auth/user.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      timeout: 120_000,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.ts|authenticated\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testIgnore: /auth\.setup\.ts|authenticated\//,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'authenticated',
      testMatch: /authenticated\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...(authEnabled ? { storageState: authFile } : {}),
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'pnpm --filter @opulent/web exec vite --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
