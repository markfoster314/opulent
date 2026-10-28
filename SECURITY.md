# Security

Report vulnerabilities through GitHub Security Advisories. Do not open a public issue for a secret leak, auth bypass, authorization flaw, or customer-data exposure.

Include the route or component, reproduction steps, impact, and a suggested fix if you have one. Supported code is `main` and the active production deployment.

CI, settings in [docs/github-setup.md](docs/github-setup.md):

- **Production dependency audit** — `pnpm audit --prod --audit-level high`
- **Secret scan** — gitleaks. Org-owned repos need a `GITLEAKS_LICENSE` secret.
- **Analyze** and **Dependency Review** — need GitHub Advanced Security on private repos. If GHAS is off, do not mark those jobs required.
