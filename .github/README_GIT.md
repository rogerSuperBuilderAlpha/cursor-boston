# GitHub Templates and Workflows

This directory contains GitHub issue templates, pull request templates, and CI/CD workflows for the Cursor Boston repository.

## Structure

- `ISSUE_TEMPLATE/` - Issue templates (`config.yml` contact links + bug/feature markdown templates)
- `PULL_REQUEST_TEMPLATE.md` - Template for pull requests
- `workflows/` - GitHub Actions CI/CD workflows
- `dependabot.yml` - Automated dependency updates configuration
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Community code of conduct
- `SECURITY.md` - Security policy

## Usage

When creating a new issue or pull request on GitHub, these templates will be automatically used to guide contributors in providing the necessary information.

## Recommended Repository Settings

### Default branch and branching model

- **Default branch:** `develop` — all contributor PRs target `develop`.
- **Production:** merge to `main` only via a **single release PR** (`develop` → `main`) after integration is reviewed, so Vercel production deploys track batched releases.
- **After a release:** sync `develop` with `main` (merge or fast-forward).

### Branch protection rules

Configure branch protection in **Settings** → **Branches** (or via GitHub API). Intended setup:

**`main` (production)**

1. Branch name pattern: `main`
2. Enable:
   - ✅ **Require a pull request before merging** — at least **1** approval; dismiss stale approvals on new commits
   - ✅ **Require status checks to pass before merging** — strict; required checks (use exact names from a recent PR’s checks list):
     - `Lint and Type Check`
     - `Test`
     - `Firestore rules tests`
     - `Security Scanning`
     - `Signed-off-by (DCO)` (from `dco.yml`)
     - `Dependency Review` / `dependency-review` (exact name may vary)
     - CodeQL (if enabled under **Settings → Code security → Code scanning** — check exact job name in the UI)
     - `Build`
   - ✅ **Require conversation resolution before merging**
   - **Admins may bypass** — `enforce_admins` is **off** so the owner can `gh pr merge --admin` until more maintainers can review release PRs. Turn **Include administrators** back on under branch protection when ready.
   - ✅ **Require signed commits** (optional but recommended)

**`develop` (integration)**

1. Branch name pattern: `develop`
2. Enable:
   - ✅ **Require a pull request before merging** — at least **1** approval
   - ✅ **Require status checks** — strict; required checks:
     - `Lint and Type Check`
     - `Test`
     - `Firestore rules tests`
     - `Security Scanning`
     - `Signed-off-by (DCO)`
     - `Dependency Review` (or the job name shown in the UI)
     - CodeQL (from GitHub default setup, if configured)
   - (Optional) Require conversation resolution for develop as well
   - **Scorecard** (`scorecards.yml`) is informational; usually **not** required for merge

**Fork PRs and CI:** Ensure **Actions** → **General** → *Fork pull request workflows from outside collaborators* is set so fork PRs can run workflows; first-time contributors may still need a maintainer to **Approve and run** pending jobs.

**Vercel:** Only **production merges to `main`** should run a real build. [`vercel.json`](../vercel.json) sets `git.deploymentEnabled` to **`"*": false`** and **`"main": true`** so unspecified branches (the default was deploy **on**) do not queue deploys, plus `ignoreCommand` ([`scripts/vercel-ignore-build.sh`](../scripts/vercel-ignore-build.sh)) skips **preview** jobs (`VERCEL_ENV=preview`) even on `main`. See [`docs/VERCEL.md`](../docs/VERCEL.md). To enable PR previews again, change both the script and `deploymentEnabled` together.

**Cursor (optional):** Install the [Vercel plugin for AI agents](https://vercel.com/docs/agent-resources/vercel-plugin) for deployment and Next.js skills: `npx plugins add vercel/vercel-plugin` (user scope; restart the agent after install).

### Secrets Configuration

Required secrets for CI/CD:

| Secret | Purpose | Required |
|--------|---------|----------|
| `CODECOV_TOKEN` | Code coverage reporting | Optional |
| `GITLEAKS_LICENSE` | Enterprise secrets scanning | Optional |

### Dependabot

Dependabot is configured to:
- Update npm dependencies weekly (Mondays 9am EST)
- Update GitHub Actions weekly
- Group minor/patch updates together
- Exclude major version bumps for critical dependencies (Next.js, React, Firebase)

### Security Features

Enable in **Settings** → **Code security and analysis**:
- ✅ Dependency graph
- ✅ Dependabot alerts
- ✅ Dependabot security updates
- ✅ Secret scanning
- ✅ Secret scanning push protection

## CI/CD Workflows

### `ci.yml` - Continuous Integration

Runs on every push and PR to `main` and `develop`:
- Lint and type checking
- Security scanning (npm audit, license check, secrets scan, SBOM)
- Tests with coverage reporting
- Build verification
- Docker build (main branch only)

### `release.yml` - Release Automation

Triggered by version tags (`v*.*.*`) or manual dispatch:
- Same quality gates as CI (lint, typecheck, tests with coverage, Firestore rules tests, validate-env, build)
- Generates SBOM
- Creates GitHub release with changelog
- Attaches `sbom.json`

### Other workflows

- `dco.yml` — DCO / `Signed-off-by` on PR commits
- `dependency-review.yml` — flags vulnerable dependencies on PRs
- `scorecards.yml` — OpenSSF Scorecard (weekly + on push)
- `ci-fork-notice.yml` — welcome comment for fork PRs (no code checkout)
- `validate-hack-a-sprint-submission.yml` — path-scoped validation for hackathon submissions
