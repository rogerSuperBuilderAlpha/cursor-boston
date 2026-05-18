# Releasing (maintainers)

Releases are **tag-driven**. The workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) runs the same quality gates as CI (lint, typecheck, tests + coverage, Firestore rules tests, `validate-env`, production build), generates an SBOM, builds release notes from merged PRs, and publishes a **GitHub Release** with `sbom.json` attached.

## When to cut a release

- After `develop` has been reviewed and you are ready to ship a version (typically after the batch `develop` → `main` release process described in [CONTRIBUTING](../.github/CONTRIBUTING.md)).
- Use [Semantic Versioning](https://semver.org/) (`vMAJOR.MINOR.PATCH`).

## Steps

1. Ensure `develop` is green (all required checks passing).
2. From the commit you want to tag (usually the merge commit on `main` or `develop` per your policy), create a **signed** annotated tag (see [§ Signed tags](#signed-tags) below for one-time setup):
   ```bash
   git checkout main   # release from main; develop is also acceptable per repo policy
   git pull
   git tag -s v0.3.0 -m "release: v0.3.0"
   git push origin v0.3.0
   ```
   The `-s` flag is required for releases from v0.3.0 forward — the release workflow rejects unsigned tags. The signature uses [gitsign](https://github.com/sigstore/gitsign) (keyless OIDC via Sigstore) by default; GPG also works.
3. The **Release** workflow creates the GitHub Release. Verify assets, signed SBOMs (`.cosign.bundle`), and notes on the [Releases](https://github.com/rogerSuperBuilderAlpha/cursor-boston/releases) page.
4. Update [CHANGELOG.md](../CHANGELOG.md) with the released version (keep [Keep a Changelog](https://keepachangelog.com/) style).

## Signed tags

From v0.3.0 forward, all release tags **MUST** be cryptographically signed. The release workflow (`.github/workflows/release.yml`) verifies the tag signature and refuses to publish unsigned tags.

Two supported signing paths — pick one and configure it once per maintainer machine:

### Option A — gitsign (recommended, no key management)

[gitsign](https://github.com/sigstore/gitsign) signs git objects via Sigstore (the same trust root used by `cosign` for the release SBOMs). The signature is a short-lived x509 cert tied to your OIDC identity (GitHub / Google / Microsoft); there is no long-lived private key to protect or rotate.

```bash
# one-time install (macOS)
brew install sigstore/tap/gitsign

# one-time config for this repo (or use --global to apply everywhere)
git config --local commit.gpgsign true
git config --local tag.gpgsign true
git config --local gpg.x509.program gitsign
git config --local gpg.format x509
```

When you run `git tag -s …`, gitsign opens an OIDC flow in your browser; pick your maintainer identity. The signature is verifiable later via:

```bash
gitsign verify --certificate-identity=<your-oidc-email> --certificate-oidc-issuer=https://github.com/login/oauth v0.3.0
```

### Option B — GPG

If you already maintain a GPG key for other projects, that works too. Upload the public key to your GitHub account so tags display the **Verified** badge on the Releases page.

```bash
# one-time config
git config --local user.signingkey <your-gpg-keyid>
git config --local commit.gpgsign true
git config --local tag.gpgsign true
```

Record the key fingerprint in [`.github/MAINTAINERS.md`](../.github/MAINTAINERS.md) so reporters can pin it.

### Verifying any release tag

```bash
git fetch --tags --quiet
git tag -v v0.3.0
```

### Manual dispatch

Maintainers can also run the workflow from **Actions → Release → Run workflow**, passing a version string (e.g. `v0.2.0`). Ensure the checked-out ref matches the code you intend to release.

## Notes

- **OpenSSF Scorecard** runs on a schedule and on pushes to `main`; **CodeQL** may run via GitHub default code scanning — they complement but do not replace the release job's checks.
- Container images are built in CI on `main` for validation only (`push: false`); publishing signed images to a registry is optional future work.

## Rollback

If a release breaks production or ships an issue that warrants pulling:

1. **Don't delete the GitHub Release immediately.** A deleted release page breaks any link a downstream consumer (or attacker scanning for missing tags) may have cached. Mark it as **pre-release** first via the GitHub UI to remove it from "Latest".
2. **Cut a follow-up release** with the fix — a `vX.Y.Z+1` patch is faster and clearer than reverting the tag. The original CHANGELOG entry stays; the new entry references it (e.g. *"Reverts the X behavior introduced in v0.2.0; see [v0.2.0 notes](…) for context."*).
3. **If the issue is security-grade**, follow the disclosure flow in [`SECURITY.md`](../.github/SECURITY.md) and coordinate the rollback with the disclosure timeline — public revert commit messages should not name the vulnerability before the embargoed advisory date.
4. **If Sigstore signing failed mid-release** (the workflow produced a tag + GitHub Release but the cosign step errored), re-run the release workflow via **Actions → Release → Run workflow** with the same version. Sigstore signing is idempotent against the same artifact hash.
5. **Communicate the rollback** — post in `#announcements` on Discord and add a note to the next release's CHANGELOG entry. Don't silently ship a fix.

Never:

- `git push --force` to delete a tag on the remote. Tags are public artifacts; force-deleting them invalidates SBOM signatures and breaks downstream attestation. Cut a new release instead.
- Skip the CHANGELOG entry for a hotfix. Even one-line "reverts X" notes earn their keep when the next reviewer reads the history.
