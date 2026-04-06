# Supply chain and security automation

This project uses several layers to reduce risk in dependencies and workflows.

## Dependency updates

- **Dependabot** ([`.github/dependabot.yml`](../.github/dependabot.yml)) opens weekly update PRs against `develop` for npm and GitHub Actions.
- **Dependency Review** ([`.github/workflows/dependency-review.yml`](../.github/workflows/dependency-review.yml)) runs on pull requests when `package.json` / `package-lock.json` change and flags known-vulnerable dependencies.

## CI checks

- **npm audit** (high severity threshold), **license allowlist** (`license-checker`), **Gitleaks**, and **CycloneDX SBOM** generation run in the **Security Scanning** job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
- **CodeQL** — use **GitHub’s default code scanning setup** (Settings → Code security → Code scanning). A custom `codeql.yml` workflow was removed because it conflicted with default setup (SARIF upload error). Re-enable advanced CodeQL only after turning default setup off, or keep default only.
- **DCO** ([`.github/workflows/dco.yml`](../.github/workflows/dco.yml)) enforces `Signed-off-by` lines on every commit in a PR.

## Trust signals

- **OpenSSF Scorecard** ([`.github/workflows/scorecards.yml`](../.github/workflows/scorecards.yml)) publishes results to the repository’s **Security** tab (scheduled, on push to `main`, and manual dispatch — not every `develop` push).

## Vercel vs GitHub Actions

Vercel production deploys are **not** tied to every PR; see [VERCEL.md](VERCEL.md).

## Pinning GitHub Actions

Workflows use version tags (e.g. `actions/checkout@v4`). For maximum reproducibility, maintainers may pin third-party actions to full commit SHAs and let Dependabot propose updates. This is optional but aligns with OpenSSF guidance.

## Repository settings

Enable **secret scanning**, **Dependabot alerts**, and **private vulnerability reporting** on GitHub where available; see [`.github/README_GIT.md`](../.github/README_GIT.md).
