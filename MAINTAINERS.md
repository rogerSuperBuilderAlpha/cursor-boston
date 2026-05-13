# Maintainers

## Current maintainers

| Name | GitHub | Role | Since |
|------|--------|------|-------|
| Roger Hunt | [@rogerSuperBuilderAlpha](https://github.com/rogerSuperBuilderAlpha) | Project Lead | 2026-01-27 |
| Brad Egan  | [@bradAGI](https://github.com/bradAGI) | Maintainer | 2026-05-13 |

The full role definitions, decision-making process, and code-review tiers live in [`.github/GOVERNANCE.md`](.github/GOVERNANCE.md).

## Becoming a maintainer

Two paths, both documented in [GOVERNANCE.md](.github/GOVERNANCE.md#becoming-a-maintainer):

1. **Nomination** — an existing maintainer nominates a contributor based on sustained, high-quality contributions. This path has always existed.
2. **Self-nomination via application** — open a PR against the [`maintainer-application`](https://github.com/rogerSuperBuilderAlpha/cursor-boston/tree/maintainer-application) branch using the [Maintainer Application Template](.github/MAINTAINER_APPLICATION_TEMPLATE.md). The existing maintainer-team review process then runs against your application.

Both paths use the same evaluation criteria (sustained contributions, code-review judgment, community fit) and the same decision rule (consensus among maintainers, Project Lead approves).

## CODEOWNERS and area ownership

[`.github/CODEOWNERS`](.github/CODEOWNERS) now lists both maintainers as default owners, with Brad as the primary reviewer for the test surface (`__tests__/`), CI/release workflows (`.github/workflows/`), and the security-adjacent middleware (`lib/middleware.ts`, `lib/sanitize.ts`) — the areas he established expertise in through the test-coverage and security-hardening work that preceded his application. Roger remains primary on governance docs, README/marketing copy, and the game subsystem.

## Day-to-day

- [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) — fork workflow, `develop` / `main`, DCO, submission-branch routing
- [`docs/RELEASING.md`](docs/RELEASING.md) — tag-driven releases, GitHub Releases, release PRs
- [`docs/SUBMISSION_BRANCHES.md`](docs/SUBMISSION_BRANCHES.md) — what the persistent contribution branches are and when they're used
- [`.github/ACTIVE_ISSUES.md`](.github/ACTIVE_ISSUES.md) — current roadmap and where to file new issues
