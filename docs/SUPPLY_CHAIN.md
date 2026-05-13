# Supply chain and security automation

This project layers multiple controls to reduce supply-chain risk: dependency review, vulnerability scanning, license compliance, secrets detection, SBOM generation in two formats, cosign-signed release artifacts, and SLSA build-provenance attestations.

For the project-wide security policy and disclosure flow, see [`.github/SECURITY.md`](../.github/SECURITY.md). For secret-rotation cadence and branch-protection settings, see [`SECURITY_OPERATIONS.md`](SECURITY_OPERATIONS.md) and [`BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md).

---

## Dependency updates

- **Dependabot** ([`.github/dependabot.yml`](../.github/dependabot.yml)) opens weekly update PRs against `develop` for npm and GitHub Actions. Major-version updates to `next`, `react`, `react-dom`, and `firebase` are ignored and reviewed manually.
- **Dependency Review** ([`.github/workflows/dependency-review.yml`](../.github/workflows/dependency-review.yml)) runs on pull requests that change `package.json` / `package-lock.json` and blocks PRs introducing known-vulnerable dependencies.

## CI gates

The **Security Scanning** job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and pull request:

- **`npm audit`** with `--audit-level=high` (fails on high or critical vulnerabilities).
- **License allowlist** via `license-checker` against the project's MIT/Apache/BSD/ISC/GPL-3.0/MPL-2.0 allowlist; transitive licenses are checked too.
- **Gitleaks** with the project's `.gitleaks.toml` rules (including the post–April-2026 referral-code patterns).
- **CycloneDX SBOM** generated and uploaded as a build artifact (30-day retention).

The **Docker Build** job (runs on push to `main` only) builds the production container and then:

- **Trivy** scans the image for OS and library vulnerabilities at HIGH/CRITICAL severity. Unfixed vulnerabilities are ignored (`ignore-unfixed: true`); fixable HIGH/CRITICAL findings fail the build.
- The Trivy SARIF report is uploaded as an artifact for review.

**DCO enforcement** ([`.github/workflows/dco.yml`](../.github/workflows/dco.yml)) requires every commit in a PR to carry a `Signed-off-by:` line.

**CodeQL** uses GitHub's default code-scanning setup (Settings → Code security). A custom workflow is intentionally not maintained because it conflicts with default setup. Findings appear in the repository's Security tab.

## Trust signals

- **OpenSSF Scorecard** ([`.github/workflows/scorecards.yml`](../.github/workflows/scorecards.yml)) runs weekly, on push to `main`, and on manual dispatch. Results publish to the Security tab; the public badge is in the [README](../README.md).
- **Pinned action versions.** Every action across all workflows is pinned to a **full 40-character SHA** with the human-readable version in a trailing comment. Dependabot proposes SHA updates weekly. There is no use of floating tags (`@v4`, `@main`) anywhere in `.github/workflows/`.

## Release artifacts

The **Release** workflow ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) triggers on `v*.*.*` tags. Each release publishes:

| Artifact | Format | Purpose |
|---|---|---|
| `sbom.json` | CycloneDX 1.5 JSON | Primary SBOM; consumed by most SCA tooling |
| `sbom.spdx.json` | SPDX 2.3 JSON | Alternative SBOM format for tooling that prefers SPDX |
| `sbom.json.sig` + `sbom.json.cert` | Sigstore cosign | Keyless signature + identity certificate for the CycloneDX SBOM |
| `sbom.spdx.json.sig` + `sbom.spdx.json.cert` | Sigstore cosign | Keyless signature + identity certificate for the SPDX SBOM |
| `attestation.intoto.jsonl` | SLSA in-toto | Build-provenance attestation covering both SBOMs (uploaded automatically by `actions/attest-build-provenance`; viewable at `https://github.com/rogerSuperBuilderAlpha/cursor-boston/attestations/<id>`) |

Signing uses **Sigstore keyless** (OIDC → Fulcio → Rekor) — there is no long-lived signing key. The release workflow has `id-token: write` permission specifically for this.

## Verifying a release

Consumers can verify that a downloaded SBOM was produced by this repository's CI (not a forged artifact):

```bash
# Set the release tag you're verifying
TAG=v0.2.0

# Download the SBOM + signature + certificate from the GitHub Release
gh release download "$TAG" \
  --pattern 'sbom.json*' \
  --repo rogerSuperBuilderAlpha/cursor-boston

# Verify the cosign signature was produced by this repo's release workflow
cosign verify-blob sbom.json \
  --signature sbom.json.sig \
  --certificate sbom.json.cert \
  --certificate-identity-regexp '^https://github\.com/rogerSuperBuilderAlpha/cursor-boston/\.github/workflows/release\.yml@refs/tags/.*$' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com'

# Verify the SLSA build provenance attestation (requires gh CLI 2.55+)
gh attestation verify sbom.json \
  --repo rogerSuperBuilderAlpha/cursor-boston
```

If either verification fails, do not trust the artifact — assume it has been tampered with or was published outside the official release flow.

## Vercel deploys

Vercel production deploys are tied to `main` only, not to every PR. See [`VERCEL.md`](VERCEL.md). Production deploys do not currently produce additional attestations beyond what Vercel records internally; the build-provenance attestations above cover the SBOM artifacts attached to GitHub Releases.

## Future enhancements

- **Scorecard score floor in CI.** The OpenSSF Scorecard workflow publishes results but doesn't gate merges. A wrapper that fails CI when the score drops below a floor (e.g. 7.5) would catch regressions in supply-chain hygiene.
- **Container image push with provenance.** The Docker job currently builds and scans but does not push to a registry. Pushing to `ghcr.io` with `actions/attest-build-provenance` covering the image digest would extend the attestation chain to a deployable artifact.
- **SLSA L3 build isolation.** Provenance currently runs in the same workflow as the build (SLSA L1/L2 territory). Hermetic builds via a reusable workflow would reach L3.

## Repository settings (manual)

Enable in GitHub repository settings — these aren't workflow-configurable:

- Secret scanning
- Dependabot alerts
- Private vulnerability reporting
- Required status checks on `main` and `develop` (see [`BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md))
- Default code-scanning setup (CodeQL)

The intended state is documented in [`.github/README_GIT.md`](../.github/README_GIT.md).
