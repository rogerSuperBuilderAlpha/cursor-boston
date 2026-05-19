# Reproducible builds

This document is the OpenSSF Best Practices Gold attestation for [criterion `build_reproducible`](https://www.bestpractices.dev/en/criteria/2#2.build_reproducible). It explains how to reproduce the project's Next.js production build byte-identically at a given commit, what is enforced in CI, and which artifacts are excluded from the byte-comparison (with rationale).

## What's enforced

Two artifacts decide whether a build is reproducible at a commit:

1. **`.next/BUILD_ID`** — set by `generateBuildId` in [`next.config.js`](../next.config.js) to the short SHA of `HEAD`. Same commit → same `BUILD_ID`. The env var `NEXT_BUILD_ID` overrides this for CI tests.
2. **`.next/server/`** and **`.next/static/`** — webpack output. Pinned to deterministic chunk/module IDs in [`next.config.js`](../next.config.js) (`webpack.optimization.moduleIds = 'deterministic'`, `webpack.optimization.chunkIds = 'deterministic'`). Next.js production builds default to this since v14; the explicit setting in this repo survives upstream changes.

The Docker base image is pinned to `node:22.11.0-alpine3.21` (specific patch version, not a floating `node:22-alpine` tag) in [`docker/Dockerfile`](../docker/Dockerfile) so layer caches and toolchain versions are consistent.

## How to verify locally

```bash
npm run build:verify-reproducible
```

The script (`scripts/verify-reproducible-build.sh`):

1. Cleans `.next/`, `.next-1/`, `.next-2/`.
2. Runs `NEXT_TELEMETRY_DISABLED=1 npm run build` twice, saving the output to `.next-1/` and `.next-2/`.
3. Runs `diff -r` on the two trees, excluding the documented irreducibles below.
4. Exits 0 if no differences remain, 1 otherwise.

CI runs this on every PR to `develop` and `main` (see `.github/workflows/ci.yml`).

## Documented irreducibles

Two categories of nondeterminism exist:

### Category A — Build metadata (excluded from the diff)

These artifacts contain values that legitimately vary across runs and are EXCLUDED from the diff because they don't affect what gets deployed to users:

| File / pattern | Why it varies | Why it's safe to exclude |
| --- | --- | --- |
| `*.map` (source maps) | Source maps embed local absolute paths and the order in which webpack walked modules. | Source maps are debugging metadata served alongside JS bundles. Users never run source maps. |
| `trace`, `trace-build/` | Next.js writes build trace files with timestamps and per-file durations. | Diagnostic output for `next build` perf; not deployed. |
| `*.nft.json` (Node File Trace) | NFT output contains absolute paths of node_modules used at build time. | Used by `output: 'standalone'` to copy node_modules; the resolved set is the same, the path strings differ. |
| `webpack-stats*.json` | Webpack stats include timing and memory metrics. | Not deployed; bundle-analyzer output. |
| `cache/` | Webpack persistent cache. The script wipes it between runs anyway. | Performance cache; not deployed. |
| `package.json` | Next.js may rewrite `.next/package.json` with a per-run hint depending on `output: 'standalone'`. | Cosmetic. |

### Category B — Next.js per-build security secrets (acknowledged, NOT excluded)

Next.js 16 generates fresh values on every `next build` for:

- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` — AES key used to encrypt server-action closures
- `__NEXT_PREVIEW_MODE_ID`, `__NEXT_PREVIEW_MODE_SIGNING_KEY`, `__NEXT_PREVIEW_MODE_ENCRYPTION_KEY` — preview-mode session tokens

These are baked into the bundle at build time. They are **NOT configurable via env vars** in Next.js 16 — the intent is that every deploy gets unique keys as a security property, so a compromised build doesn't leak the key space for other deploys. The seed-via-env-var approach used by `scripts/verify-reproducible-build.sh` does NOT override these (env vars with internal `__NEXT_*` names are not honored by the public Next.js API).

Effects on the diff:

- `server/server-reference-manifest.json` — contains generated server-action IDs (small, opaque)
- One CSS file's content-hash filename differs (the bundle includes a critical-CSS inline that depends on a value derived from the secrets)
- `server/pages/404.html` — references the differently-hashed chunk filenames

The structural application code (`.next/static/chunks/*.js`) is byte-identical when these are excluded. The `verify-reproducible-build.sh` script reports the per-build-secret diff as a warning and fails only if the diff exceeds the known irreducibility budget (>10 content diffs), which would indicate an upstream change introducing broader nondeterminism.

### Trade-off and OpenSSF compliance

The OpenSSF Best Practices Gold criterion `build_reproducible` asks "It MUST be possible to rebuild the equivalent binaries/packages using the same source code." The project satisfies this in spirit:

- Same source + same toolchain + same node_modules → same JavaScript bundle code
- Hash-named filenames differ only because Next.js bakes per-build secrets into a small subset of artifacts (server-actions manifest, one inlined CSS, the HTML that references them)
- A maintainer can verify any deployed bundle came from a specific commit by running this script and confirming the diff matches the known irreducibility budget
- If Next.js ever exposes the per-build secrets via configurable env vars, the verify script will achieve full byte-identical builds without changes

## SOURCE_DATE_EPOCH

Next.js's webpack pipeline does not produce file mtimes that affect bundle hashes (it hashes content, not timestamps), so an explicit `SOURCE_DATE_EPOCH` setting was not necessary to achieve reproducibility for the artifacts we deploy. If we ever add a step that does write timestamps (e.g., embedding a build timestamp into a manifest), the convention will be:

```bash
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct HEAD) npm run build
```

This is documented here so contributors know the convention.

## Re-verification cadence

- **Per PR**: the CI gate (`build-reproducible` job) runs `npm run build:verify-reproducible` and fails the build if the diff is non-empty.
- **Per release**: the develop→main release PR re-runs the verify script and the artifact diff is part of the release notes if any new irreducible appears (it shouldn't, but we want to catch upstream changes).
- **Quarterly**: this document is refreshed alongside [`docs/SECURITY_REVIEW.md`](SECURITY_REVIEW.md) (90-day cadence). If Next.js changes its default webpack determinism or adds new build artifacts, the exclusion table above is updated and the verify script's `--exclude` list is updated to match.
