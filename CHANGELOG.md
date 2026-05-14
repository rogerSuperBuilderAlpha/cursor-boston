# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — targeting 0.2.0

Tracks work accumulated since the v0.1.0 tag (2026-01-27). The next tagged release will be cut from this section.

### Added

- Three additional maintainers onboarded (Brad Egan, Neha Chaudhari, Aaron Grace) — see [`MAINTAINERS.md`](MAINTAINERS.md) for area ownership
- `docs/VERCEL.md` — production-only Vercel policy and dashboard checklist
- `NOTICE` file for project copyright and SPDX identifier
- `MAINTAINERS.md` canonical maintainer roster with per-area ownership
- `docs/README.md` documentation index
- `docs/RELEASING.md` maintainer release runbook
- `docs/SUPPLY_CHAIN.md` overview of security and dependency automation
- `docs/OPENSOURCE_REVIEW.md` + `docs/REVIEW_ACTION_PLAN.md` — published OSS health review and 12-week action plan
- `docs/SECURITY_OPERATIONS.md` rotation cadence and runbook
- `public/.well-known/security.txt` for standardized security contact discovery
- GitHub Actions: DCO check, Dependency Review, OpenSSF Scorecard, Firestore-deploy-on-push-to-main
- `.github/ISSUE_TEMPLATE/config.yml` with contact links (Discord, security policy, dev guide)
- Per-area `CODEOWNERS` split across the four maintainers
- Rate-limit hardening on the unauthenticated `/api/auth/resolve-email` endpoint
- API.md drift guard in CI (fails the build if generated OpenAPI docs diverge from checked-in `docs/API.md`)

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
- **Security policy**: documents GitHub private vulnerability reporting alongside email; clarifies fallback contact if the dedicated security inbox doesn't acknowledge within 48h
- **Governance**: removed the now-obsolete "when there is only one maintainer" section; documented the no-self-approval rule explicitly and added a solo-emergency-merge exception path
- **CI hygiene**: `postinstall` no longer auto-installs Playwright Chromium in CI environments (the e2e job has its own cache + install)
- **Stale workflow**: narrowed `exempt-all-milestones` so ancient milestoned issues can still be triaged
- **Action SHA pins**: aligned `actions/checkout` and `actions/setup-node` across workflows

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
