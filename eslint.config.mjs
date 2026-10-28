import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import turbo from 'eslint-plugin-turbo';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
      '*.jsonl',
      'eslint.config.mjs',
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
      'boundaries/elements': [
        { type: 'app', pattern: 'apps/*' },
        { type: 'package', pattern: 'packages/*' },
        { type: 'job', pattern: 'jobs/*' },
        { type: 'infra', pattern: 'infra' },
      ],
    },
    rules: {
      'boundaries/dependencies': boundaryPolicy,
      'turbo/no-undeclared-env-vars': ['error', { allowList: ['^CI$', '^E2E_AUTH0_'] }],
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
    files: ['**/*.{js,mjs,cjs}'],
    ...js.configs.recommended,
    languageOptions: { globals: globals.node },
  },
  prettier,
);
