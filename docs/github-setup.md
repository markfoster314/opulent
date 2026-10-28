# GitHub setup

Apply these settings in the GitHub UI. The workflows in `.github` match the names on this page.

Deploy and AWS OIDC are not part of this setup. Those come later.

## Protect `main`

Settings → Branches → Branch protection rule for `main`:

- Require a pull request
- Require one approval
- Require conversation resolution
- Require linear history
- Do not allow force pushes
- Squash merge only (Settings → General → Pull Requests)

## Required status checks

Require these checks by **exact job name**:

| Job name                    | Workflow          | Required                                 |
| --------------------------- | ----------------- | ---------------------------------------- |
| Quality                     | CI                | Yes                                      |
| Database                    | CI                | Yes                                      |
| Analyze                     | CodeQL            | Yes, when GitHub Advanced Security is on |
| Dependency Review           | Dependency Review | Yes, when GitHub Advanced Security is on |
| Secret scan                 | Security          | Yes                                      |
| Production dependency audit | Security          | Yes                                      |
| PR title                    | CI                | Pull requests only                       |
| Browser smoke               | CI                | No, until the run history is stable      |

On a private repository, CodeQL and Dependency Review need GitHub Advanced Security (GHAS). If GHAS is off, do not mark **Analyze** or **Dependency Review** as required. Keep **Secret scan** and **Production dependency audit**.

## Secrets and variables

Repository secrets:

| Name                 | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `TURBO_TOKEN`        | Optional remote Turbo cache                 |
| `E2E_AUTH0_EMAIL`    | Authenticated Playwright                    |
| `E2E_AUTH0_PASSWORD` | Authenticated Playwright                    |
| `GITLEAKS_LICENSE`   | Required on organization-owned repositories |

Repository variables:

| Name                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `TURBO_TEAM`          | Turbo team slug for the remote cache |
| `E2E_AUTH0_DOMAIN`    | Auth0 tenant for browser tests       |
| `E2E_AUTH0_CLIENT_ID` | Auth0 SPA client for browser tests   |
| `E2E_AUTH0_AUDIENCE`  | Auth0 API audience for browser tests |

Do not put `TURBO_TOKEN` in `.env`. Turbo does not read the app `.env` for this, and a `VITE_` prefix would expose the token to the browser.

Without the Turbo values, CI still runs. It uses a local cache only.

Without the E2E Auth0 values, public Playwright tests still run. Authenticated tests are skipped.

## Remote Turbo cache

On a laptop:

```bash
pnpm exec turbo login
pnpm exec turbo link
```

CI already reads `TURBO_TOKEN` and `TURBO_TEAM` in the Quality job.

## Renovate

1. Install the Renovate GitHub App on the repository.
2. Allow automerge so patch `devDependencies` can merge when checks pass.
3. Confirm the weekly schedule in `renovate.json`.

## CODEOWNERS

[`.github/CODEOWNERS`](../.github/CODEOWNERS) assigns `@markfoster314` on every path. Keep that handle until GitHub teams exist. Then replace the handle on each path. Do not invent team slugs in the file before the teams exist.

## Later

- GitHub OIDC for AWS
- A deploy workflow
- Uploading `apps/web/dist` to the CloudFront distribution
