# GitHub Templates and Workflows

This directory contains GitHub issue templates, pull request templates, and CI/CD workflows for the Cursor Boston repository.

## Structure

- `ISSUE_TEMPLATE/` - Issue templates for bug reports and feature requests
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
   - ✅ **Require status checks to pass before merging** — strict; required checks:
     - `Lint and Type Check`
     - `Test`
     - `Firestore rules tests`
     - `Build`
   - ✅ **Require conversation resolution before merging**
   - ✅ **Do not allow bypassing** (including admins) — `enforce_admins`
   - ✅ **Require signed commits** (optional but recommended)

**`develop` (integration)**

1. Branch name pattern: `develop`
2. Enable:
   - ✅ **Require a pull request before merging** — at least **1** approval
   - ✅ **Require status checks** — strict; required checks:
     - `Lint and Type Check`
     - `Test`
     - `Firestore rules tests`
   - (Optional) Require conversation resolution for develop as well

**Fork PRs and CI:** Ensure **Actions** → **General** → *Fork pull request workflows from outside collaborators* is set so fork PRs can run workflows; first-time contributors may still need a maintainer to **Approve and run** pending jobs.

**Vercel:** Only **`main`** triggers deployments (production). [`vercel.json`](../vercel.json) sets `ignoreCommand` ([`scripts/vercel-ignore-build.sh`](../scripts/vercel-ignore-build.sh)) so pushes to `develop`, Dependabot branches, and feature branches do **not** start Vercel builds. To add preview deploys for `develop` again, relax that script and `git.deploymentEnabled` in `vercel.json`.

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
- Runs full test suite
- Generates SBOM
- Creates GitHub release with changelog
- Attaches artifacts
