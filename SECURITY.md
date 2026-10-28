# Security

Please report vulnerabilities privately through GitHub Security Advisories for this repository.

Do not open a public issue for a suspected secret leak, authentication bypass, authorization flaw, or customer-data exposure.

Include:

- affected route or component
- reproduction steps
- impact
- any suggested fix

We aim to acknowledge reports within two business days. Supported releases are the current `main` branch and the active production deployment.

## CI security checks

Repository settings for these jobs are in [docs/github-setup.md](docs/github-setup.md).

- **Production dependency audit** (`pnpm audit --prod --audit-level high`) must pass.
- **Secret scan** (gitleaks) scans the Git history. Organization-owned repositories need a `GITLEAKS_LICENSE` repository secret.
- **Analyze** (CodeQL) and **Dependency Review** need GitHub Advanced Security on private repositories. If the repository is private without GHAS, keep the audit and secret scan required and do not mark the missing jobs as required.
