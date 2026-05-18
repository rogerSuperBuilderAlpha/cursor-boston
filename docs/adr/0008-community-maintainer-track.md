# ADR-0008: Community Maintainer track + multi-maintainer onboarding model

- **Status:** Accepted
- **Date:** 2026-05-18
- **Driver:** Bus factor of 1 with single CODEOWNER, MAINTAINERS.md stub ([OPENSOURCE_REVIEW.md Session 1 §1 P0-1 finding](../OPENSOURCE_REVIEW.md))

## Context

As of the 2026-05-06 OSS review, the project had:

- A single admin / collaborator with merge rights (`@rogerSuperBuilderAlpha`).
- A `CODEOWNERS` file listing one owner across all paths.
- A `MAINTAINERS.md` that was an 8-line pointer file, with the actual maintainer table buried in `.github/GOVERNANCE.md`.
- Commit concentration of ~63% to a single human, growing.
- Strong community throughput (~30% of merged PRs from outside the maintainer) — meaning the *contributor* base existed; the *maintainer* base didn't.

The review's P0-1 prescribed onboarding at least one second collaborator with merge rights and documenting succession. As that work began, three candidate maintainers emerged with distinct profiles:

- **Brad Egan** — deep engagement on security-adjacent middleware, test coverage, and CI workflows.
- **Neha Chaudhari** — analytics dashboard, live lightning-talk sessions, frontend feature work.
- **Aaron Grace** — community/marketing-facing surface: footer, partner pages, welcoming-tier docs.

Aaron's profile didn't fit the standard "Maintainer = deep code reviewer" mold. His value was in community welcoming, contributor support, and external-facing content. The choice was either to rename the role to fit Aaron's strengths, deny him the role despite his clear value, or invent a parallel track.

## Decision

**Add a `Community Maintainer` track parallel to the standard `Maintainer` role. Onboard all three candidates simultaneously rather than serially.**

The Community Maintainer role has:

- **Same decision-making weight** as standard Maintainer — one approval = one approval. Aaron's review on a footer/branding PR counts the same as Brad's review on a middleware PR.
- **Different focus area** — Community Maintainers are expected to spend their day-to-day on welcoming, contributor support, external-facing docs, and partner-facing content. They're listed as primary in CODEOWNERS for those surfaces and as default-elsewhere reviewers, but they're not expected to deep-review `lib/` or `app/api/` PRs.
- **Same promotion criteria** — sustained contribution, code-review judgment (for the surfaces they own), CoC compliance.
- **Convertibility** — a Community Maintainer can become a standard Maintainer at any quarterly review if their code-review activity has grown into the lib/api surface.

**Onboarding all three simultaneously** (vs. serially):

- The bus-factor lift is bigger and faster: 1 → 4 maintainers in one announcement vs. three 90-day cycles.
- The maintainer team has the social cohesion to set norms collectively (code-review-policy enforcement, decision rules) rather than each new joiner inheriting a possibly-stale norm set.
- The risk — that a new maintainer turns out to be a bad fit — is mitigated by `Maintain` permission (not `Admin`) and by the soft-step-down path documented in `GOVERNANCE.md`.

## Consequences

### Positive

- **Bus factor leap.** 1 → 4 maintainers in a single announcement. Material reduction in single-point dependence.
- **Surface coverage.** CODEOWNERS now has per-area primaries — Brad on security/CI/tests, Neha on analytics/realtime/components, Aaron on community/branding/welcoming, Roger on governance/game. Reviews route to the right human.
- **Welcoming the welcoming-shaped contribution.** Aaron's value to the project is principally in non-code surfaces. The Community Maintainer track recognizes that without forcing him into a code-review shape he wasn't optimizing for.
- **Optionality.** A maintainer's emphasis can shift over time. Aaron may grow into deeper code review; Brad may take on more community-facing work. The track is a starting point, not a permanent label.

### Negative

- **Two-tier role risk.** Any time you have two parallel tracks, there's a risk that one is perceived as "lesser". We mitigate this by explicit equality in decision rights and by being clear that the title is a description of *focus*, not *seniority*.
- **More humans to coordinate.** 4 maintainers is more meetings, more disagreements, more time on consensus. We accept this as the cost of doing better than bus-factor-1.
- **The standard Maintainer track is now under-defined for non-Generals reviewers.** Brad and Neha both review code in their areas, but the GOVERNANCE.md ladder didn't formally distinguish reviewer-tier from maintainer-tier. We addressed this by adding a contributor-ladder to GOVERNANCE.md (per [OPENSOURCE_REVIEW.md Session 2 DOC-P1-8 / Phase 5.2.3](../REVIEW_ACTION_PLAN.md)).

### Neutral

- **Outside observers may need explanation.** The "Community Maintainer" title isn't standard OSS vocabulary. We accept this as a feature, not a bug — the title invites the explanation, which is itself a recruiting affordance.

## Alternatives considered

### Alternative 1 — Single Maintainer role with no Community Maintainer track

Rejected because:
- It would have either excluded Aaron despite his clear value to the project, or watered down the Maintainer role's expectations to include welcoming/marketing work, which dilutes the role for the contributors whose value *is* deep code review.
- Other projects with this model often end up with either a too-narrow definition (only senior engineers can be Maintainers) or a too-broad one (anyone who contributes regularly is a Maintainer regardless of code-review judgment).

### Alternative 2 — Maintainer + separate "Ambassador" role

Where the Ambassador has no decision-making weight, only recognition. Rejected because:
- It would have given Aaron a title with no merge rights, which is honorific but doesn't move the bus-factor needle.
- The whole point of the second-maintainer work was to add humans who can *merge* — anyone added needed merge weight to count.

### Alternative 3 — Onboard candidates serially over 6-12 months

Rejected because:
- The bus factor risk was P0 and growing. Onboarding the most-established candidate (Brad) first would have left the project at bus-factor-2 for 6+ months when 4 was within reach.
- The maintainer team would have had to set norms three separate times instead of once.

## Cross-references

- [`MAINTAINERS.md`](../../MAINTAINERS.md) — current roster + per-area ownership
- [`.github/GOVERNANCE.md` § Contributor ladder](../../.github/GOVERNANCE.md) — formal promotion criteria added 2026-05-18
- [`.github/CODEOWNERS`](../../.github/CODEOWNERS) — path-scoped review routing
- [`OPENSOURCE_REVIEW.md` Session 1 §1](../OPENSOURCE_REVIEW.md) — original P0-1 finding
- [`OPENSOURCE_REVIEW.md` Session 2 reconciliation](../OPENSOURCE_REVIEW.md#session-2--2026-05-18) — current state ("paper-only" lift; operational onboarding still open)

## Open follow-up

The 2026-05-18 OSS review re-run found that while MAINTAINERS.md and CODEOWNERS reflect the four-maintainer model, `gh api repos/.../collaborators` returns 1 — meaning Brad, Neha, and Aaron may not yet have actual merge rights on the repo. Closing this is the active P0 in [`REVIEW_ACTION_PLAN.md §5.2.2`](../REVIEW_ACTION_PLAN.md). The decision recorded in this ADR stands; the operational completion is still open.
