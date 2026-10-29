import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import turbo from 'eslint-plugin-turbo';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const importResolver = fileURLToPath(new URL('./eslint/import-resolver.cjs', import.meta.url));

const apiModules = [
  'users',
  'places',
  'cards',
  'collection',
  'groups',
  'wants',
  'matches',
  'trades',
  'health',
];

/** Another module's files, except service.ts. Same-folder imports stay allowed. */
const apiModuleImportGroup = apiModules.flatMap((name) => [
  `../${name}/*`,
  `!../${name}/service`,
  `!../${name}/service.ts`,
]);

const boundaryPolicy = [
  'error',
  {
    default: 'allow',
    policies: [
      {
        from: { element: { type: 'app' } },
        disallow: { to: { element: { types: { anyOf: ['app', 'job', 'infra'] } } } },
      },
      {
        from: { element: { type: 'package' } },
        disallow: { to: { element: { types: { anyOf: ['app', 'job', 'infra'] } } } },
      },
      {
        from: { element: { type: 'job' } },
        disallow: { to: { element: { types: { anyOf: ['app', 'infra'] } } } },
      },
      {
        from: { element: { type: 'infra' } },
        disallow: { to: { element: { types: { anyOf: ['app', 'package', 'job'] } } } },
      },
      {
        from: { element: { type: 'web-shared' } },
        disallow: { to: { element: { type: 'web-feature' } } },
      },
      {
        from: { element: { type: 'web-feature' } },
        disallow: { to: { element: { type: 'web-feature' } } },
      },
      // The last match wins, so these exceptions sit after the feature ban.
      {
        from: { element: { type: 'web-feature', captured: { elementName: 'groups' } } },
        allow: {
          to: { element: { type: 'web-feature', captured: { elementName: 'collection' } } },
        },
      },
      {
        from: { element: { type: 'web-feature', captured: { elementName: 'home' } } },
        allow: {
          to: {
            element: { type: 'web-feature', captured: { elementName: ['matches', 'auth'] } },
          },
        },
      },
      {
        from: { element: { type: 'web-feature', captured: { elementName: 'collection' } } },
        allow: {
          to: {
            element: { type: 'web-feature', captured: { elementName: ['profile', 'auth'] } },
          },
        },
      },
      {
        from: { element: { type: 'web-feature', captured: { elementName: 'profile' } } },
        allow: { to: { element: { type: 'web-feature', captured: { elementName: 'matches' } } } },
      },
      {
        allow: { to: { file: { categories: 'web-queries' } } },
      },
    ],
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/cdk.out/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '.dsh-worktrees/**',
      'packages/db/migrations/**',
      'playwright-report/**',
      'test-results/**',
      'apps/web/public/mockServiceWorker.js',
      '*.jsonl',
      'eslint.config.mjs',
      'eslint/**',
      'commitlint.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { boundaries, turbo },
    settings: {
      'import/resolver': {
        [importResolver]: {},
      },
      'boundaries/elements': [
        { type: 'web-shared', pattern: 'apps/web/src/shared/*' },
        { type: 'web-feature', pattern: 'apps/web/src/features/*', capture: ['elementName'] },
        { type: 'app', pattern: 'apps/*' },
        { type: 'package', pattern: 'packages/*' },
        { type: 'job', pattern: 'jobs/*' },
        { type: 'infra', pattern: 'infra' },
      ],
      'boundaries/files': [{ category: 'web-queries', pattern: 'apps/web/src/**/queries.ts' }],
      'boundaries/elements-single-match': true,
    },
    rules: {
      'boundaries/dependencies': boundaryPolicy,
      'turbo/no-undeclared-env-vars': [
        'error',
        { allowList: ['^CI$', '^DEV$', '^E2E_AUTH0_', '^GITHUB_ACTIONS$'] },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      ...reactRefresh.configs.vite.rules,
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['apps/api/src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: apiModuleImportGroup,
              message: 'Import another module through service.ts only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/smoke/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../modules/*/*', '!../modules/*/service', '!../modules/*/service.ts'],
              message: 'Import a module through service.ts only.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended,
    // Plain scripts are not in a tsconfig. Typed rules need one, so they stay off here.
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
