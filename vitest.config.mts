import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const webSrc = fileURLToPath(new URL('./apps/web/src', import.meta.url));

export default defineConfig({
  test: {
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
    projects: [
      {
        test: {
          name: 'shared',
          environment: 'node',
          include: ['packages/shared/src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'card-sync',
          environment: 'node',
          include: ['jobs/card-sync/src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'infra',
          environment: 'node',
          include: ['infra/lib/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'api',
          environment: 'node',
          include: ['apps/api/src/**/*.test.ts'],
        },
      },
      {
        resolve: {
          alias: {
            '@': webSrc,
          },
        },
        define: {
          'import.meta.env.VITE_AUTH0_DOMAIN': JSON.stringify('test.auth0.example'),
          'import.meta.env.VITE_AUTH0_CLIENT_ID': JSON.stringify('test-client'),
          'import.meta.env.VITE_AUTH0_AUDIENCE': JSON.stringify('test-audience'),
          'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:8787'),
        },
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.{ts,tsx}'],
          setupFiles: ['apps/web/src/test/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      // Regression floor for the current suite. Raise these numbers as coverage grows.
      thresholds: {
        statements: 2,
        branches: 0.5,
        functions: 1,
        lines: 2,
      },
      include: ['apps/*/src/**/*.{ts,tsx}', 'jobs/*/src/**/*.ts', 'packages/*/src/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/test/**', '**/*.d.ts'],
    },
  },
});
