# Architecture Decision Records

We record significant architectural decisions in short, numbered documents so that future contributors understand *why* the project is built the way it is.

## Format

Each ADR follows a lightweight template:

```
# ADR-NNNN: Title

**Status:** Accepted | Superseded | Deprecated
**Date:** YYYY-MM-DD
**Authors:** @github-handle

## Context
What is the issue that we're seeing that motivates this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult because of this decision?
```

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](0001-gpl3-license.md) | GPL-3.0 license | Accepted | 2026-01-27 |
| [0002](0002-firebase-backend.md) | Firebase as backend platform | Accepted | 2026-01-27 |
| [0003](0003-fork-only-workflow.md) | Fork-only contribution workflow | Accepted | 2026-02-16 |
| [0004](0004-webpack-bundler.md) | Webpack over Turbopack | Accepted | 2026-04-13 |
| [0005](0005-in-memory-rate-limiting.md) | In-memory rate limiting with Firestore fallback | Accepted | 2026-04-13 |
| [0006](0006-develop-main-branching.md) | develop/main branching strategy | Accepted | 2026-04-13 |

## Adding a new ADR

1. Copy the template above into a new file: `NNNN-short-title.md`
2. Fill in each section — keep it concise
3. Add the entry to the index table above
4. Submit via PR targeting `develop`
