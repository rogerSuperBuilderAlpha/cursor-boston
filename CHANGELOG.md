# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `docs/VERCEL.md` — production-only Vercel policy and dashboard checklist
- `NOTICE` file for project copyright and SPDX identifier
- `MAINTAINERS.md` entry point linking to governance and release docs
- `docs/README.md` documentation index
- `docs/RELEASING.md` maintainer release runbook
- `docs/SUPPLY_CHAIN.md` overview of security and dependency automation
- `public/.well-known/security.txt` for standardized security contact discovery
- GitHub Actions: DCO check, Dependency Review, OpenSSF Scorecard
- `.github/ISSUE_TEMPLATE/config.yml` with contact links (Discord, security policy, dev guide)

### Changed

- Removed `.github/workflows/codeql.yml` — it conflicted with GitHub **default** Code scanning (SARIF upload error). Use default setup or one advanced workflow, not both.
- **Vercel**: `git.deploymentEnabled` now sets `"*": false` and `"main": true` (unspecified branches defaulted to deploy **on** before); ignore script skips `VERCEL_ENV=preview` so only production builds on `main`
- **GitHub Actions**: Dependency Review runs only when npm lockfiles change; Scorecard no longer runs on every `develop` push
- **LICENSE**: standardized to verbatim GPLv3 text so GitHub can detect **GPL-3.0**; project copyright moved to `NOTICE`
- **CI**: security scanning (npm audit, license allowlist, Gitleaks, SBOM) is **blocking**; expanded license allowlist for real transitive licenses; build gates on successful security job
- **Release workflow**: aligned with CI (lint, typecheck, coverage tests, Firestore rules tests, validate-env, build); clone URL uses `${{ github.repository }}`
- **Docker**: base image updated to **Node 22** to match `.nvmrc`
- **package.json**: `license` set to `GPL-3.0-only`; `engines.node` set to `>=22.0.0`
- **Docs**: beginner guide (`docs/GET_STARTED.md`) uses feature branches and correct push instructions; support docs no longer reference disabled GitHub Discussions
- **Security policy**: documents GitHub private vulnerability reporting alongside email

### Fixed

- Contradictory contributor git instructions (push to `main` vs PR base `develop`) in the get-started guide

## [0.1.0] - 2026-01-27

### Added

- Initial release
- Next.js 14 with App Router
- Firebase Authentication (Email, Google, GitHub)
- Cloud Firestore database
- Events management
- Talk submissions
- Blog system with Markdown support
- Member directory
- Discord and GitHub OAuth integration
- Dark theme UI with Tailwind CSS
- Mobile-responsive design

[Unreleased]: https://github.com/rogerSuperBuilderAlpha/cursor-boston/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rogerSuperBuilderAlpha/cursor-boston/releases/tag/v0.1.0
