# ADR-0001: GPL-3.0 license

**Status:** Accepted
**Date:** 2026-01-27
**Authors:** @rogerSuperBuilderAlpha

## Context

Cursor Boston is a community platform built in the open. We needed a license that:

- Ensures the codebase stays open — any fork or derivative must also be open source.
- Protects community contributions from being absorbed into proprietary products.
- Is well-understood and widely adopted, so contributors know what they're signing up for.

Permissive licenses (MIT, Apache-2.0) would allow closed-source forks. AGPL-3.0 would extend copyleft to network interactions, which is heavier than we need since this is a community site, not a SaaS API.

## Decision

License the project under **GPL-3.0-only** with a DCO (Developer Certificate of Origin) requirement on all commits.

- `LICENSE` contains the verbatim GPLv3 text so GitHub can auto-detect it.
- `NOTICE` carries the project copyright and SPDX identifier.
- CI enforces `Signed-off-by` on every PR commit via the DCO workflow.
- A license-checker allowlist in CI ensures transitive dependencies are compatible.

## Consequences

- **Copyleft protection:** Derivative works must stay GPL-3.0, keeping the community's work open.
- **Corporate caution:** Some companies have policies against GPL dependencies. This is acceptable — the project prioritizes community openness over enterprise adoption.
- **Dependency constraints:** We must verify that all production dependencies use GPL-compatible licenses (MIT, BSD, Apache-2.0, ISC, etc.). The CI license-checker automates this.
- **DCO overhead:** Contributors must remember `git commit -s`. The CONTRIBUTING guide and CI error messages explain how.
