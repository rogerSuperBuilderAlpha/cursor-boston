# Roadmap

What Cursor Boston is working on, what's planned next, and where to find specific work to pick up.

> Active development happens on the **`develop`** branch; production runs from **`main`**. See [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) for the branching model and [docs/SUBMISSION_BRANCHES.md](docs/SUBMISSION_BRANCHES.md) for the event-specific submission branches.

This roadmap is **mirrored at [`.github/ACTIVE_ISSUES.md`](.github/ACTIVE_ISSUES.md)** — both files should stay in sync. The `.github/` mirror exists for discoverability from the GitHub Insights tab; this root copy is canonical.

---

## Now — active development

Work that's in flight on `develop` or being delivered to a submission branch.

- **PyData × Cursor Boston (May 13, 2026)** — gated event hub at `/events/cursor-boston-pydata-2026`, hackathon submission flow on the `pydata-2026-submissions` branch ([details](pydata-2026-submissions/README.md))
- **Summer Cohort 1 (weeks 1–6)** — weekly submission branches `c1w1pm-submission` through `c1w6oss-submission`; PM, comms, marketing, education, startup, and OSS tracks
- **Game mode** — ongoing improvements to combat, exploration, NPCs, world snapshot encoding, the zero-turn order queue layer; contributions land via the `game-contributions` branch. Contributor surface: [`docs/generals/`](docs/generals/README.md).
- **OSS-readiness master-class lift** — closing the gaps surfaced in [`docs/OPENSOURCE_REVIEW.md`](docs/OPENSOURCE_REVIEW.md) Session 2 (2026-05-18) and [`docs/DOCUMENTATION_REVIEW.md`](docs/DOCUMENTATION_REVIEW.md). Phased plan in [`docs/REVIEW_ACTION_PLAN.md`](docs/REVIEW_ACTION_PLAN.md) Phase 5.

## Next — planned

Committed direction for the next minor release, but not yet started.

- **v0.2 — Enhanced Member Profiles & Social Integration** — richer profile pages, social-graph features.
- **Production observability (Sentry)** — [highest-leverage open item from the OSS review](docs/OPENSOURCE_REVIEW.md#dim-6--testing-reliability--observability). Runbook in [REVIEW_ACTION_PLAN.md §5.2.1](docs/REVIEW_ACTION_PLAN.md).
- **First real release (v0.1.0 tag + GitHub Release)** — pipeline is wired (Sigstore keyless, SBOM, auto-changelog) but no release has been cut.
- **Test coverage lift** — raise Jest thresholds toward 75% statements / 65% branches (targeted API-route handlers + game data layer first).
- **Account-deletion cascade audit** — verify the cascade covers every user-keyed Firestore collection (~40); programmatically generate the cascade map rather than hand-listing.

## Future — vision

Directional, not yet scheduled.

- **v0.3 — Community Discussion Boards**
- **v0.4 — PWA & Mobile Optimization**
- **Internationalization** — i18n once the contributor base supports translation review.
- **SLSA L3 release provenance** — currently only the SBOM is signed; layering full provenance attestation per [slsa.dev](https://slsa.dev/) is future work.

## Released

- **v0.1 — Initial Community Hub & Event Tracking** ✓ (CHANGELOG anchors this version; the corresponding Git tag is still pending — see [DOC-P0-4 in DOCUMENTATION_REVIEW.md](docs/DOCUMENTATION_REVIEW.md#p0--must-address-4-items)).

---

## Where to file new issues

Open issues on GitHub: **[github.com/rogerSuperBuilderAlpha/cursor-boston/issues](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues)**

We use **YAML issue forms** — pick the template that matches your need:

- **Bug report** — something broken on the platform or in the codebase
- **Feature request** — a new feature or enhancement
- **Game design proposal** — change to the Generals game (units / spells / heroes / balance / lore / UI)

For **substantial changes** (new core API, major refactor, new subsystem), open an **RFC** under [`docs/rfcs/`](docs/rfcs/README.md) instead.

### Quick filters

- [Good first issues](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — great for new contributors
- [Bugs](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3Abug)
- [Enhancements](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)
- [Code quality](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3A%22code+quality%22) — refactoring and maintainability
- [Audit findings](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3Aaudit) — items from the OSS review backlog

### Feature projects (claim-and-build)

For large, self-contained features ready to build end-to-end, see issues [#78](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/78)–[#83](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/83) or the [README feature table](README.md#-build-something).

## How to contribute

- [Development Guide](docs/DEVELOPMENT.md) — setup, scripts, troubleshooting
- [First Contribution](docs/FIRST_CONTRIBUTION.md) — step-by-step first PR walkthrough
- [Contributing Guide](.github/CONTRIBUTING.md) — contribution policy, code style, submission-branch routing
- [Architecture](docs/ARCHITECTURE.md) — how the platform is built
- [Maintainers](MAINTAINERS.md) — current roster and how to apply for the role

_This roadmap is reviewed and updated approximately monthly. Last review: 2026-05-18._
