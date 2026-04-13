# ADR-0006: develop/main branching over trunk-based development

**Status:** Accepted
**Date:** 2026-04-13
**Authors:** @rogerSuperBuilderAlpha

## Context

The project needs a branching strategy that balances contributor accessibility with deployment safety. [ADR-0003](0003-fork-only-workflow.md) establishes that contributions come through forks, but does not address how changes flow from integration to production.

Trunk-based development (everyone merges to `main`, deploy continuously) is common in teams with strong CI, feature flags, and immediate rollback capability. This project has a small maintainer team, many first-time contributors, and no feature-flag infrastructure. Vercel is configured to deploy only when `main` is updated.

Alternatives considered:

| Model | Pros | Cons |
|-------|------|------|
| **Trunk-based** (single `main` branch) | Simpler model, faster path to production | Every merge deploys immediately, no batch verification, requires feature flags for incomplete work |
| **develop/main** (two long-lived branches) | Maintainers control release cadence, PRs can be batched and verified together, `develop` can break without affecting production | Extra promotion step adds latency, contributors must target the correct branch |

## Decision

Use a **two-branch model**:

- **`develop`** is the default branch on GitHub and the target for all contributor pull requests. CI (lint, type-check, tests) runs on every PR against `develop`.
- **`main`** is the production branch. It is updated only via **release PRs** from `develop` after maintainers batch and verify what should ship.
- Vercel deploys only on `main` merges — configured via `vercel.json` (`git.deploymentEnabled`) and `scripts/vercel-ignore-build.sh`, which rejects non-production builds.
- After a release merge, maintainers sync `develop` with `main` so both branches stay aligned.

## Consequences

- **Controlled releases:** Maintainers batch multiple PRs into a single release PR, test them together, and ship when ready. This is safer for a project where many contributors are making their first open source PR.
- **Safe integration branch:** `develop` can temporarily break (a contributor's PR introduces a regression that is caught in review) without affecting the live site.
- **Deploy latency:** Changes merged to `develop` reach production hours to days later, not minutes. This is acceptable for a community platform that is not latency-sensitive.
- **Branch targeting:** Contributors must open PRs against `develop`, not `main`. This is documented in [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) and reinforced by GitHub's default branch setting.
- **See also:** [ADR-0003](0003-fork-only-workflow.md) covers why contributions come through forks; this ADR covers where they land and how they reach production.
