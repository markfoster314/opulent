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
          name: 'db',
          environment: 'node',
          include: ['packages/db/src/**/*.test.ts'],
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
      {
        test: {
          name: 'devtools',
          environment: 'jsdom',
          include: ['tools/devtools/src/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['apps/*/src/**/*.{ts,tsx}', 'jobs/*/src/**/*.ts', 'packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/test/**',
        '**/*.d.ts',
        // The database job runs these against Postgres.
        'apps/api/src/smoke/**',
        'apps/api/src/smoke-test.ts',
        'apps/api/src/modules/**/routes.ts',
        'apps/api/src/modules/**/service.ts',
        'apps/api/src/modules/**/{items,lists,generic,import,browse,write,read,notify,value,binder}.ts',
        'apps/api/src/{index,lambda,app}.ts',
        // Token checks need the identity provider. The fast suite does not call it.
        'apps/api/src/middleware/auth.ts',
        // Scripts, table declarations, and the certificate file.
        'packages/db/src/{seed,rds-ca,import-places,bootstrap,bootstrap-sql,migrate-aws,reset,load-env,client,assert-local-db}.ts',
        'packages/db/src/schema/**',
        // Screens and the dev mock server belong to the browser checks.
        'apps/web/src/**/*.tsx',
        'apps/web/src/mocks/**',
        'apps/web/src/devtools/**',
        'apps/web/src/**/queries.ts',
        'apps/web/src/api/queryKeys.ts',
        'apps/web/src/theme/**',
        'tools/devtools/**',
        'jobs/card-sync/src/index.ts',
      ],
    },
  },
});
