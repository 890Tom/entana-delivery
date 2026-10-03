# Contributing to entana-delivery

Thank you for your interest. This project is in early development: please open an issue to discuss a change before sending a large pull request.

## Ground rules

- **Scope.** The scope follows the product specification. A change beyond it needs an issue and a decision first.
- **Tests.** Every behaviour change comes with tests. Domain logic (status transitions, fee computation) needs unit tests; database behaviour needs integration tests against a real PostgreSQL.
- **No secrets, no real data.** Never commit credentials, `.env` files, real customer data or brand assets. Use the fake data in `examples/demo`.
- **Decisions are written.** A significant architectural choice gets an [ADR](docs/adr).

## Workflow

1. Open or pick an issue.
2. Create a short-lived branch from `main`: `feat/short-name`, `fix/short-name`, `docs/short-name`.
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
4. Open a pull request using the template. Keep it small and focused.
5. CI must be green. PRs are squash-merged.

## Local setup

1. Install Node (LTS, see `.nvmrc`), pnpm, Docker and [gitleaks](https://github.com/gitleaks/gitleaks).
2. Enable the repository hooks: `git config core.hooksPath scripts/hooks`
3. Check the secret hook works: stage a file containing a random fake token (a string starting with `ghp_` followed by 36 random letters and digits, which you type yourself and never commit) and confirm the commit is blocked. Do not use the well-known AWS documentation example key: gitleaks ignores it.

## Code style

TypeScript in strict mode, no `any`, small functions with explicit names, comments that explain *why*. Formatting and linting are enforced by tooling (added with the monorepo setup).

## Reporting security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).
