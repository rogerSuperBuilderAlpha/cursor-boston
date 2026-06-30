# Roadmap and active issues

This page tracks what the Cursor Boston project is working on, what's planned next, and where to find specific work to pick up.

> Active development happens on the **`develop`** branch; production runs from **`main`**. See [CONTRIBUTING.md](CONTRIBUTING.md#branching-model-develop-and-main) for the branching model and [SUBMISSION_BRANCHES.md](../docs/SUBMISSION_BRANCHES.md) for the event-specific submission branches.

---

## Now — active development

Work that's in flight on `develop` or being delivered to a submission branch.

- **Summer Cohort 2 / Hult Cohort Developer Program (Jun 29 – Aug 7, 2026)** — vote-format weekly submissions on `c2w1pm-submission`, `c2w2comms-submission`, and `c2w3mkt-submission`; dashboard at `/summer-cohort` ([submission branches](../docs/SUBMISSION_BRANCHES.md))
- **Game mode** — ongoing improvements to combat, exploration, NPCs, world snapshot encoding; contributions land via the `game-contributions` branch
- **OSS-readiness lift** — closing the remaining gaps to an A on every governance / security / supply-chain dimension (this work-in-progress; see [`docs/OPENSOURCE_REVIEW.md`](../docs/OPENSOURCE_REVIEW.md))

## Next — planned

Committed direction for the next minor release, but not yet started.

- **v0.2 — Enhanced Member Profiles & Social Integration** — richer profile pages, social-graph features
- **Test coverage lift** — raise Jest thresholds toward 75% statements / 65% branches (targeted API-route handlers + game data layer first)

## Future — vision

Directional, not yet scheduled.

- **v0.3 — Community Discussion Boards**
- **v0.4 — PWA & Mobile Optimization**
- **Internationalization** — i18n once the contributor base supports translation review

## Released

- **v0.1 — Initial Community Hub & Event Tracking** ✓
- **Summer Cohort 1 (May 11 – Jun 19, 2026)** ✓ — six weekly submission branches; PM, comms, marketing, education, startup, and OSS tracks
- **PyData × Cursor Boston (May 13, 2026)** ✓ — gated event hub and hackathon submissions on `pydata-2026-submissions`

---

## Where to file new issues

Open issues on GitHub: **[github.com/rogerSuperBuilderAlpha/cursor-boston/issues](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues)**

### Quick filters

- [Good first issues](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — great for new contributors
- [Bugs](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3Abug) — things that need fixing
- [Enhancements](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement) — improvements and new features
- [Code quality](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3A%22code+quality%22) — refactoring and maintainability

### Feature projects (claim-and-build)

For large, self-contained features ready to build end-to-end, see issues [#78](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/78)–[#83](https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues/83) or the [README feature table](../README.md#-build-something).

## How to contribute

- [Development Guide](../docs/DEVELOPMENT.md) — setup, scripts, troubleshooting
- [First Contribution](../docs/FIRST_CONTRIBUTION.md) — step-by-step first PR walkthrough
- [Contributing Guide](CONTRIBUTING.md) — contribution policy, code style, and submission-branch routing
- [Maintainers](../MAINTAINERS.md) — current maintainers and how to apply for the role
