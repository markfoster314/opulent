# GitHub setup

Settings that match `.github` workflows. Production deploy: [deploy.md](deploy.md).

## `main`

Settings → Branches, rule for `main`:

- Pull request required
- One approval
- Conversation resolution
- Linear history
- No force pushes
- Squash merge only (Settings → General → Pull Requests)

## Required checks

Exact job names:

| Job                         | Workflow          | Required                                                |
| --------------------------- | ----------------- | ------------------------------------------------------- |
| Quality                     | CI                | Yes                                                     |
| Database                    | CI                | Yes                                                     |
| Analyze                     | CodeQL            | No. The job is skipped until code scanning is available |
| Dependency Review           | Dependency Review | Yes, when GHAS is on                                    |
| Secret scan                 | Security          | Yes                                                     |
| Production dependency audit | Security          | Yes                                                     |
| PR title                    | CI                | Pull requests only                                      |
| Browser smoke               | CI                | No. The job is skipped until Auth0 login works here     |

Private repos: CodeQL and Dependency Review need GitHub Advanced Security. If it is off, leave **Analyze** and **Dependency Review** off the required list.

## Secrets and variables

Secrets: `TURBO_TOKEN`, `E2E_AUTH0_EMAIL`, `E2E_AUTH0_PASSWORD`, `GITLEAKS_LICENSE` (org repos). Production deploy secrets live on the `production` environment. [deploy.md](deploy.md).

Variables: `TURBO_TEAM`, `E2E_AUTH0_DOMAIN`, `E2E_AUTH0_CLIENT_ID`, `E2E_AUTH0_AUDIENCE`.

`TURBO_TOKEN` stays a GitHub secret, not a `VITE_` value. Missing Turbo values: CI runs with a local cache. Missing E2E Auth0 values: public Playwright still runs; authenticated tests skip.

Local remote cache: `pnpm exec turbo login` then `pnpm exec turbo link`.

## Renovate

Install the Renovate GitHub App. Allow automerge. Schedule is in `renovate.json`.

## CODEOWNERS

[`.github/CODEOWNERS`](../.github/CODEOWNERS) is `@markfoster314` on every path until GitHub teams exist.
