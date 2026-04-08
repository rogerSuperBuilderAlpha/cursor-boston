# ADR-0003: Fork-only contribution workflow

**Status:** Accepted
**Date:** 2026-02-16
**Authors:** @rogerSuperBuilderAlpha

## Context

As an open source community project welcoming first-time contributors, we need a git workflow that:

- Prevents accidental pushes to protected branches.
- Teaches contributors real-world open source practices.
- Keeps the upstream repository clean (no stale feature branches from dozens of contributors).
- Works with Vercel's production-only deployment model (only `main` triggers builds).

Two models were considered:

| Model | Pros | Cons |
|-------|------|------|
| **Shared repo** (branch per contributor) | Simpler for beginners, no fork setup | Branch clutter, requires write access for all, risk of accidental pushes |
| **Fork workflow** (fork → branch → PR) | Clean upstream, standard OSS practice, no write access needed | Extra setup step for beginners |

## Decision

Require **all contributions** to come through forked repositories via pull requests targeting the `develop` branch.

- `develop` is the integration branch and the default PR target.
- `main` is the production branch — only updated via merge from `develop`.
- Vercel deploys only on `main` merges (configured in `vercel.json` and the ignore script).
- No direct push access is granted to external contributors.
- Branch naming convention: `feature/`, `fix/`, `docs/`, `refactor/`, `style/`.
- The `ci-fork-notice.yml` workflow posts a welcome comment on fork PRs with guidance.

## Consequences

- **Clean upstream:** The main repository only has `main` and `develop` — no contributor branches to clean up.
- **Standard OSS practice:** Contributors learn the fork workflow used by most major open source projects, which is a transferable skill.
- **Beginner friction:** Forking and configuring an upstream remote is an extra step. We mitigate this with `docs/GET_STARTED.md` and `docs/FIRST_CONTRIBUTION.md`, both written in plain language.
- **CI considerations:** `pull_request_target` is needed for some workflows (fork PRs don't have access to repo secrets). We use this carefully and only for non-sensitive operations (posting comments).
- **Two-stage deployment:** Changes land in `develop` first, then get merged to `main` for production. This adds a manual promotion step but gives maintainers a chance to batch and verify before shipping.
