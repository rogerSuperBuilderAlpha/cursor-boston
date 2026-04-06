# Releasing (maintainers)

Releases are **tag-driven**. The workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) runs the same quality gates as CI (lint, typecheck, tests + coverage, Firestore rules tests, `validate-env`, production build), generates an SBOM, builds release notes from merged PRs, and publishes a **GitHub Release** with `sbom.json` attached.

## When to cut a release

- After `develop` has been reviewed and you are ready to ship a version (typically after the batch `develop` → `main` release process described in [CONTRIBUTING](../.github/CONTRIBUTING.md)).
- Use [Semantic Versioning](https://semver.org/) (`vMAJOR.MINOR.PATCH`).

## Steps

1. Ensure `develop` is green (all required checks passing).
2. From the commit you want to tag (usually the merge commit on `main` or `develop` per your policy), create an annotated tag:
   ```bash
   git checkout develop   # or main, per your release policy
   git pull
   git tag -a v0.2.0 -m "release: v0.2.0"
   git push origin v0.2.0
   ```
3. The **Release** workflow creates the GitHub Release. Verify assets and notes on the [Releases](https://github.com/rogerSuperBuilderAlpha/cursor-boston/releases) page.
4. Update [CHANGELOG.md](../CHANGELOG.md) with the released version (keep [Keep a Changelog](https://keepachangelog.com/) style).

### Manual dispatch

Maintainers can also run the workflow from **Actions → Release → Run workflow**, passing a version string (e.g. `v0.2.0`). Ensure the checked-out ref matches the code you intend to release.

## Notes

- **OpenSSF Scorecard** runs on a schedule and on pushes to `main`; **CodeQL** may run via GitHub default code scanning — they complement but do not replace the release job’s checks.
- Container images are built in CI on `main` for validation only (`push: false`); publishing signed images to a registry is optional future work.
