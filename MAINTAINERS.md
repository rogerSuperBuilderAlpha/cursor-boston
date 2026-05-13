# Maintainers

## Current maintainers

| Name | GitHub | Role | Since |
|------|--------|------|-------|
| Roger Hunt | [@rogerSuperBuilderAlpha](https://github.com/rogerSuperBuilderAlpha) | Project Lead | 2026-01-27 |

The full role definitions, decision-making process, and code-review tiers live in [`.github/GOVERNANCE.md`](.github/GOVERNANCE.md).

## We're recruiting a second maintainer

Cursor Boston currently runs on a single maintainer, which is fragile for an active community project. **We are actively recruiting a second maintainer** to share review, release, and triage responsibilities.

If you've been contributing regularly and want to step into a maintainer role, see **[Becoming a maintainer](#becoming-a-maintainer)** below. The path is public — you don't need to wait to be tapped on the shoulder.

## Becoming a maintainer

Two paths, both documented in [GOVERNANCE.md](.github/GOVERNANCE.md#becoming-a-maintainer):

1. **Nomination** — an existing maintainer nominates a contributor based on sustained, high-quality contributions. This path has always existed.
2. **Self-nomination via application** — open a PR against the [`maintainer-application`](https://github.com/rogerSuperBuilderAlpha/cursor-boston/tree/maintainer-application) branch using the [Maintainer Application Template](.github/MAINTAINER_APPLICATION_TEMPLATE.md). The existing maintainer-team review process then runs against your application.

Both paths use the same evaluation criteria (sustained contributions, code-review judgment, community fit) and the same decision rule (consensus among maintainers, Project Lead approves).

## CODEOWNERS and area ownership

[`.github/CODEOWNERS`](.github/CODEOWNERS) currently routes every path to `@rogerSuperBuilderAlpha` (the only maintainer). When a second maintainer is added, the file will be split by area — frontend, library code, infrastructure, docs — so review responsibility is shared cleanly. The split is intentionally deferred until there are two people to share it.

## Day-to-day

- [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) — fork workflow, `develop` / `main`, DCO, submission-branch routing
- [`docs/RELEASING.md`](docs/RELEASING.md) — tag-driven releases, GitHub Releases, release PRs
- [`docs/SUBMISSION_BRANCHES.md`](docs/SUBMISSION_BRANCHES.md) — what the persistent contribution branches are and when they're used
- [`.github/ACTIVE_ISSUES.md`](.github/ACTIVE_ISSUES.md) — current roadmap and where to file new issues
