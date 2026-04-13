# ADR-0004: Webpack over Turbopack

**Status:** Accepted
**Date:** 2026-04-13
**Authors:** @rogerSuperBuilderAlpha

## Context

Next.js 16 ships Turbopack as the default bundler for both `dev` and `build`. However, this project relies on the `@next/bundle-analyzer` webpack plugin to visualize production bundle composition (`ANALYZE=true next build`). Turbopack does not yet support the full webpack plugin API, which means plugins like `@next/bundle-analyzer` that wrap the webpack config cannot run under Turbopack.

Alternatives considered:

| Option | Pros | Cons |
|--------|------|------|
| **Turbopack (default)** | Faster cold starts, incremental compilation | No `@next/bundle-analyzer` support, incomplete plugin ecosystem |
| **Webpack (explicit `--webpack` flag)** | Full plugin compatibility, mature ecosystem, bundle analysis works | Slower cold starts than Turbopack |

## Decision

Explicitly opt into Webpack by passing the `--webpack` flag on both the `dev` and `build` scripts in `package.json`:

```json
"dev": "NODE_OPTIONS='--no-deprecation' next dev --webpack",
"build": "npm run validate-env && next build --webpack"
```

Continue using `@next/bundle-analyzer` to wrap `next.config.js` for on-demand bundle analysis. Re-evaluate when Turbopack reaches full webpack plugin compatibility.

## Consequences

- **Bundle analysis available:** `ANALYZE=true npm run build` produces an interactive treemap of the production bundle, helping contributors catch size regressions.
- **Slower dev cold starts:** Webpack is measurably slower than Turbopack on initial compilation. For a project of this size the difference is a few seconds, which is acceptable.
- **Full plugin ecosystem:** Any webpack loader or plugin can be added without compatibility concerns.
- **Easy to reverse:** Switching to Turbopack is a single-commit change — remove the `--webpack` flags and update `next.config.js` to drop the `withBundleAnalyzer` wrapper (or replace it with Turbopack-native analysis when available).
