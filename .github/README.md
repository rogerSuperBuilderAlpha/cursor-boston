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

### Branch Protection Rules

For production deployments, configure branch protection on `main`:

1. Go to **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. Enable:
   - ✅ **Require a pull request before merging**
     - Require at least 1 approval
     - Dismiss stale pull request approvals when new commits are pushed
   - ✅ **Require status checks to pass before merging**
     - Required checks: `Lint and Type Check`, `Test`, `Build`
   - ✅ **Require conversation resolution before merging**
   - ✅ **Require signed commits** (optional but recommended)
   - ✅ **Do not allow bypassing the above settings**

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
