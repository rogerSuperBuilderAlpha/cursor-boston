---
review_date: 2026-05-18
reviewer: rogerSuperBuilderAlpha (self-review)
commit_sha: a83bb741ecb68ea7c8ba2bf3805a11538c6b68f7
branch_reviewed: release/develop-to-main-zero-turn
previous_review: 2026-05-06
overall_rag: yellow
frameworks_referenced:
  - OpenSSF Scorecard
  - OpenSSF Best Practices Badge (CII)
  - CHAOSS metrics
  - OWASP ASVS L1/L2
  - GitHub Open Source Guide
  - Mozilla Open Source Archetypes
  - WCAG 2.2 AA
  - Diátaxis
  - Keep a Changelog / SemVer
  - Conventional Commits
  - All Contributors spec
  - REUSE.software
companion_review: docs/DOCUMENTATION_REVIEW.md
---

# Cursor Boston — End-to-End Open-Source Review

## Session 2 — 2026-05-18

**Commit:** `a83bb74` · **Reviewer:** @rogerSuperBuilderAlpha · **Previous review:** 2026-05-06 (Session 1, below) · **Companion:** [`DOCUMENTATION_REVIEW.md`](DOCUMENTATION_REVIEW.md)

Session 2 is **not a rewrite** of Session 1. It (a) reconciles Session 1's prioritized backlog against current state with PR/commit evidence, (b) re-runs the mechanical evidence script and diffs verdicts, and (c) adds a **master-class benchmark layer** — for each dimension, what the gold-standard exemplar repo does and where our bar still sits below it. Session 1's body is preserved verbatim below per its own re-run instructions.

The companion [`DOCUMENTATION_REVIEW.md`](DOCUMENTATION_REVIEW.md) extends Dim 9 (Documentation) into a dedicated audit; this Session 2 summarizes its findings only.

### Executive summary

**Overall: 🟡 YELLOW (unchanged)** — privacy posture moved 🔴 → 🟡 (account deletion, abuse/report flow, mentor consent all shipped), security posture moved 🟡 → 🟢 trend (vulns cleared, gitleaks lesson banked, Scorecard 6.9 → 7.1), but the three biggest structural lifts in Session 1's plan are **not done**: observability still absent (no Sentry/OpenTelemetry deps), governance code-review still failing (3/20 vs target 18/20+), no release ever cut. Plus the bus-factor improvement is on paper only: MAINTAINERS.md lists 4 humans, but `gh api collaborators` returns 1 — Brad/Neha/Aaron may be reviewing-but-not-merging, and commit concentration *worsened* (63% → 84% to Roger or Ludwitt since 2026-05-06).

### Dimension verdicts — diff vs Session 1

| # | Dimension | Session 1 RAG | Session 2 RAG | What moved |
|---|---|---|---|---|
| 1 | Governance & Bus Factor | 🔴 RED | 🟡 YELLOW (improved on paper) | MAINTAINERS.md added 4 humans (2026-05-13); CODEOWNERS path-scoped (P1-17, P1-18 ✅). But collaborators API returns 1; commit concentration 84% (worsened from 63%); Code-Review 3/20 vs 1/22 (P0-2 only partially closed). |
| 2 | Community Health & Contributor Funnel | 🟢 GREEN | 🟢 GREEN | 348 commits in 12 days, contributions from 30+ humans; throughput sustained. |
| 3 | Security Posture & Supply Chain | 🟡 YELLOW | 🟢 GREEN (trending) | Vulnerabilities 9 → 10 (P1-3 ✅); gitleaks credit/referral rules added (P0-6 ✅); Scorecard 6.9 → 7.1. But `enforce_admins: false` still on both branches (P1-1 ❌); Build check still missing on develop (P1-2 ❌); `packages: write` still on docker job (P2-1 ❌); no CII badge applied (P2-2 ❌). |
| 4 | Privacy, Data Handling & Trust/Safety | 🔴 RED | 🟡 YELLOW | Account deletion shipped (P0-3 ✅ — `app/api/account/route.ts`); abuse/report + block flows shipped (P0-4 ✅ — `app/api/community/report` + `block`); mentor consent shipped (P1-4 ✅ — `consentToShareProfile` required); gitleaks credit/referral rules (P0-6 ✅). Cookie banner still absent (P1-5 ❌); minors policy unverified (P1-6); rate limiting expansion unverified (P1-7). |
| 5 | Product & Architecture Quality | 🟡 YELLOW | 🟡 YELLOW | `as any` count 81 → 85 (P1-13 regressed); client-component ratio holds; no observed circular dep regression; PR Studio + zero-turn gameplay shipped without ADRs. |
| 6 | Testing, Reliability & Observability | 🔴 RED | 🔴 RED (unchanged) | **No Sentry/OpenTelemetry/Pino/Winston dependencies** (P0-5 still ❌, single highest-leverage open item). Firestore rules tests still 8 cases / 274 lines (P1-11 ❌). No `coverageThreshold` block in jest.config (P1-14 ❌). E2E still smoke-only — 6 specs in `e2e/smoke/` (P1-15 ❌). |
| 7 | Accessibility & Inclusive UX | 🟡 YELLOW | 🟡 YELLOW (unchanged) | a11y rules still `warn` not `error` (P1-9 ❌); no `@axe-core/playwright` in package.json (P1-10 ❌). |
| 8 | Release Engineering & Provenance | 🟡 YELLOW | 🟡 YELLOW | Still **0 git tags / 0 GitHub releases** (P1-12 ❌). CHANGELOG references v0.1.0 (2026-01-27) but the tag doesn't exist on the remote — misleading. Sigstore pipeline remains unvalidated. |
| 9 | Documentation & Onboarding | 🟢 GREEN | 🟢 GREEN | Doc count 60 → 61; freshness sustained. `ARCHITECTURE.md` still missing (P1-16 ❌). See [DOCUMENTATION_REVIEW.md](DOCUMENTATION_REVIEW.md) for the dedicated audit. |

### Session 1 backlog reconciliation

P0/P1/P2 items from [Session 1 § Prioritized backlog](#prioritized-backlog), with current status.

#### P0 — 4 of 6 closed

| # | Item | Status | Evidence |
|---|---|---|---|
| P0-1 | Bus factor — onboard second collaborator + document succession | 🟡 **Partial** | `MAINTAINERS.md` lists 4 humans (2026-05-13). `CODEOWNERS` path-scoped. But `gh api repos/.../collaborators \| jq 'length'` returns **1** — the additional maintainers are operating without commit/merge rights, or via a different access path. Commit concentration *worsened* to 84% Roger+Ludwitt (was 63%). Succession plan in GOVERNANCE.md unchanged. |
| P0-2 | Code-Review policy enforcement (recorded approvals or Discord summary in PR) | 🟡 **Partial** | Scorecard Code-Review: **1/10** (was 0/10); 3/20 changesets reviewed (was 1/22). Slight directional improvement; far below acceptable. |
| P0-3 | Account deletion endpoint + Firestore cascade + UI affordance | ✅ **Done** | `app/api/account/route.ts` exists. Verify cascade coverage + UI affordance independently. |
| P0-4 | Abuse/report flow + block-user + admin moderation queue | ✅ **Done** | `app/api/community/report/route.ts` + `app/api/community/block/route.ts` exist. Verify rules + UI independently. |
| P0-5 | Production error tracking (Sentry or equivalent) + structured logging | ❌ **Not started** | No Sentry/OpenTelemetry/Pino/Winston/Datadog/Rollbar/Honeycomb deps in `package.json`. Single highest-leverage open item. |
| P0-6 | Gitleaks rule + `.gitignore` patterns for `*credit*` / `*referral*` (April 2026 incident lesson) | ✅ **Done** | `.gitleaks.toml` has rules `cursor-referral-url` and `credit-referral-file-content`. `.gitignore` has `*credit*.csv` / `*referral*.csv` / `docs/*credit*/` patterns. Verified inline. |

#### P1 — 4 of 18 done, ~14 open

| # | Item | Status | Evidence |
|---|---|---|---|
| P1-1 | `enforce_admins: true` on main + develop | ❌ | `gh api .../branches/{main,develop}/protection` shows `enforce_admins.enabled: false` on both. |
| P1-2 | Build check on develop + `required_conversation_resolution: true` | ❌ | Develop required checks: Lint+Type Check, Test, Firestore rules — **no Build**. `required_conversation_resolution.enabled: false` on develop. |
| P1-3 | Bump `basic-ftp` + `uuid` | ✅ | Scorecard Vulnerabilities: 10/10 (was 9). 0 open. |
| P1-4 | Mentor-match consent step | ✅ | `app/api/mentorship/request/route.ts` has `consentToShareProfile` required field with explicit error message. |
| P1-5 | Cookie consent banner | ❌ | No `*cookie*consent*` component found in repo. |
| P1-6 | Minors policy enforcement | Unverified | Not directly grep-able; needs UX walkthrough. |
| P1-7 | Rate limiting on `community/reaction`, `community/delete`, mentorship endpoints, hackathon signup, game writes | Unverified | Partial — needs per-endpoint audit. |
| P1-8 | Standardize data-export response + UI affordance | Unverified | `app/api/profile/data/route.ts` exists; UI affordance unverified. |
| P1-9 | Promote a11y lint rules from `warn` to `error` + add missing rules | ❌ | `eslint.config.mjs` still has `jsx-a11y/aria-props: "warn"`, etc. Missing rules (`anchor-is-valid`, `click-events-have-key-events`, `label-has-associated-control`) not added. |
| P1-10 | `@axe-core/playwright` in e2e | ❌ | Not in `package.json` dependencies or devDependencies. |
| P1-11 | Firestore rules tests expansion (8 → 100+) | ❌ | `__tests__/config/firebase/firestore.rules.test.ts` still 274 lines / 8 test cases. |
| P1-12 | Cut a real `v0.1.0` release | ❌ | `git tag` returns empty. `gh api .../releases` returns 0. Pipeline remains unvalidated despite Sigstore being wired. |
| P1-13 | Sweep 81 `as any` / `as unknown as` | ❌ Regressed | Count: 85 (was 81). Code shipped with new casts faster than old ones were removed. |
| P1-14 | Raise + enforce Jest coverage thresholds | ❌ | No `coverageThreshold` block in jest config found. |
| P1-15 | E2E happy-paths (signup, community post, mentorship request, game turn) | ❌ | `e2e/` still has only `smoke/` — 6 specs (auth-pages, hackathons, homepage, legal-pages, navigation, public-pages). No happy-path specs for the four flows. |
| P1-16 | Write `docs/ARCHITECTURE.md` | ❌ | File does not exist. |
| P1-17 | MAINTAINERS.md lists humans | ✅ | 4 humans listed with roles + dates. |
| P1-18 | Path-scoped CODEOWNERS | ✅ | `.github/CODEOWNERS` has per-area primaries (Neha → components/analytics; Brad → middleware/sanitize/rate-limit; Aaron → Footer/partners/GET_STARTED/FIRST_CONTRIBUTION; Roger → governance/game). |

#### P2 — mostly open

| # | Item | Status |
|---|---|---|
| P2-1 | Drop `packages: write` from docker job in `ci.yml` | ❌ — line 301 still has `packages: write` |
| P2-2 | Apply for OpenSSF / CII Best Practices badge | ❌ — Scorecard CII-Best-Practices: 0 |
| P2-3 | Audit `react-hooks/exhaustive-deps` disable sites | Unverified |
| P2-4 | RSC migration sweep | Not started |
| P2-5 | Document rollback in `RELEASING.md` | Unverified |
| P2-6 | Sign source-archive release artifacts | N/A — no release cut yet |
| P2-7 | Email-preference UI in profile | Unverified |

### New evidence (2026-05-18)

OpenSSF Scorecard re-run (`api.securityscorecards.dev`, 2026-05-18 08:30 UTC):

```
Aggregate: 7.1 (was 6.9)
  Maintained: 10 (30 commits + 29 issues in last 90d)
  Code-Review: 1 (was 0) — 3/20 changesets
  Dependency-Update-Tool: 10
  Security-Policy: 10
  Dangerous-Workflow: 10
  Binary-Artifacts: 10
  Token-Permissions: 0 — `contents: write` on release.yml + update-contributors.yml (mostly necessary)
  License: 10
  CII-Best-Practices: 0 (no badge applied for)
  Signed-Releases: -1 (no releases)
  Pinned-Dependencies: 7 — 4 container images not pinned by hash
  SAST: 9 — 27/30 commits checked
  Fuzzing: 0 (irrelevant for archetype)
  Vulnerabilities: 10 (was 9)
  Packaging: 10
  Branch-Protection: 4 — enforce_admins: false; develop missing Build check
  CI-Tests: 9 (was 10) — 18/20 merged PRs checked
  Contributors: 10 — 5 contributing orgs
```

Branch protection (`gh api`):

- **main**: `["Lint and Type Check", "Test", "Firestore rules tests", "Build"]`, 1 review with codeowner + dismiss-stale, `required_conversation_resolution: true`, `enforce_admins: false`, force-pushes blocked.
- **develop**: `["Lint and Type Check", "Test", "Firestore rules tests"]` (no Build), 1 review with codeowner + dismiss-stale, `required_conversation_resolution: false`, `enforce_admins: false`.

Activity (`git log --since=2026-05-06`):

- 348 commits in 12 days.
- Top authors: Roger Hunt 205, Ludwitt 86 (same human per project memory), Brad 10, dependabot 8, Kumari Simran 3, Harry Joshi 3, Aditi Deodhar 3, 30+ other community members 1-2 each.
- Roger+Ludwitt combined: 291/348 = 84% (worsened from 63% over the project lifetime).
- Major features shipped: PR Studio workflow, zero-turn gameplay layer (7 commits, #975), 10 non-turn player activities (#969), Heroes v2 (#963), Armageddon end-game (#952), 7 Seals + lottery + hall of fame.

Releases:

- `git tag` returns empty.
- `gh api .../releases` returns 0.
- CHANGELOG.md "Unreleased" section is comprehensive and well-formatted, but its "since the v0.1.0 tag (2026-01-27)" header references a tag that doesn't exist on the remote.

### Master-class benchmark layer

For each dimension, the question is: *what does the gold-standard exemplar do here, and what's the gap?*

#### Dim 1 — Governance & Bus Factor → benchmark vs [kubernetes/community](https://github.com/kubernetes/community/blob/master/governance.md)

**What Kubernetes does:**
- Formal contributor ladder: Member → Reviewer → Approver → Subproject Owner → Top-Level Owner, with documented criteria for each transition (number of PRs, sponsors required, sustained-activity period).
- SIG (Special Interest Group) model — multiple parallel maintainer teams scoped to subsystems, each with its own CONTRIBUTING.md and OWNERS file.
- Public Steering Committee elections.

**Gap:** Our `GOVERNANCE.md` defines four roles but not the *path between them*. No promotion criteria for "how does a contributor become a Maintainer?" beyond "consensus + Project Lead approval". Without explicit criteria, the maintainer track is gate-kept by relationship.

**Action:** Add a contributor-ladder section to `GOVERNANCE.md` (DOC-P1-8 in DOCUMENTATION_REVIEW.md). Use Kubernetes's "Member → Reviewer" criteria as the template.

#### Dim 2 — Community Health → benchmark vs [Astro Discord-to-PR funnel](https://docs.astro.build/en/contribute/) + [All Contributors](https://allcontributors.org/)

**What the exemplars do:**
- Astro routes new contributors through Discord → docs site → CONTRIBUTING with a 5-minute first-PR funnel. Every doc has "Edit this page" surfacing the source file.
- All Contributors bot recognizes non-code contributions (docs, design, mentoring, organizing, translation, talks).

**Gap:** Our community throughput is excellent (~30% non-maintainer PR share, 8h median TTM) but our recognition is git-author-only. Aaron's Community Maintainer role in particular is invisible in CONTRIBUTORS.md.

**Action:** Install All Contributors bot (DOC-P2-1). Migrate CONTRIBUTORS.md to its format.

#### Dim 3 — Security → benchmark vs [OpenSSF Best Practices Passing criteria](https://github.com/coreinfrastructure/best-practices-badge/blob/main/docs/criteria.md)

**What the spec requires for Passing tier:**
- 67 criteria across Basics, Change Control, Quality, Security, Analysis.
- Public website + bug reporting + version control + signed releases + license metadata + DCO/CLA + dynamic analysis evidence.

**Gap:** Scorecard CII-Best-Practices: 0. We meet most Passing criteria but haven't applied. The badge would add a visible OSS-maturity signal and bump Scorecard.

**Action:** Apply for OpenSSF Best Practices Passing badge at [bestpractices.dev](https://www.bestpractices.dev/) (P2-2 — half-day form-fill).

**Second gap:** Sigstore is wired but never used. [slsa-framework/slsa-github-generator](https://github.com/slsa-framework/slsa-github-generator) shows the master-class pattern: SLSA L3 provenance attestation on every release artifact, not just SBOM. Cut v0.1.0 first to validate the basics, then layer SLSA provenance.

#### Dim 4 — Privacy → benchmark vs [Mastodon's user-deletion + report flow](https://github.com/mastodon/mastodon/tree/main/app/services)

**What Mastodon does (the relevant comparable for UGC):**
- 30-day soft-delete window with self-service recovery.
- Federated abuse reports.
- Per-instance content moderation queue.
- Granular consent for visibility (public/unlisted/followers-only/direct).

**Gap:** Our account deletion shipped (P0-3 ✅) — verify the cascade across all ~40 user-keyed Firestore collections is comprehensive (per REVIEW_ACTION_PLAN.md §2.2 the cascade list should be programmatically derived, not hand-listed). Our abuse-report flow shipped (P0-4 ✅) — verify the admin moderation queue exists and the report-action-loop closes.

**Action:** Independent audit of the cascade map; cookie banner (P1-5); minors policy (P1-6).

#### Dim 5 — Architecture → benchmark vs [supabase/supabase ARCHITECTURE.md](https://github.com/supabase/supabase/blob/master/ARCHITECTURE.md)

**What Supabase does:** single-page architectural overview — what each subsystem is, how they connect, where data flows, deployment topology, when to add a new subsystem vs extend an existing one.

**Gap:** No `docs/ARCHITECTURE.md` (P1-16 unchanged). Six ADRs cover individual decisions but no synthesis. Three new substantial subsystems shipped since May (PR Studio, zero-turn gameplay, Armageddon) without ADRs.

**Action:** Write `docs/ARCHITECTURE.md` (DOC-P0-1). Backfill ADR-0007 (account-deletion model) and ADR-0008 (Community Maintainer track).

#### Dim 6 — Testing, Reliability & Observability → benchmark vs [Sentry's Next.js integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/) + [tRPC's e2e + coverage gates](https://github.com/trpc/trpc/blob/main/.github/workflows/main.yml)

**What the exemplars do:**
- Sentry's Next.js integration is a 4-line `instrumentation.ts` install + PII scrubbing config. Native support since Next 14.
- tRPC enforces coverage thresholds in CI per package, with per-PR comments showing coverage delta.

**Gap:** Observability is the single highest-leverage open item (P0-5). Sentry would convert the maintainer from "blind to runtime issues" to "informed" with one PR. Coverage thresholds (P1-14) are the forcing function for new code to land with tests.

**Action:** Land Sentry (REVIEW_ACTION_PLAN.md §2.1 is the runbook — execute it). Set coverage thresholds in jest config.

#### Dim 7 — Accessibility → benchmark vs [shadcn/ui's Radix-primitive a11y story](https://www.radix-ui.com/)

**What Radix does:** every primitive ships with keyboard navigation + ARIA + focus management built in. Components are accessibility-tested via [@testing-library/jest-dom's `toHaveAccessibleName`](https://github.com/testing-library/jest-dom).

**Gap:** Our a11y enforcement is advisory (lint rules at `warn` not `error`, P1-9 ❌). No runtime axe-core check in Playwright (P1-10 ❌). The May review noted: "Move the lint config one notch and add one e2e spec — the gap closes in a day." Still open.

**Action:** P1-9 + P1-10 are unchanged from the May plan. Execute Phase 1.7 + 1.8 of REVIEW_ACTION_PLAN.md.

#### Dim 8 — Release Engineering → benchmark vs [Tailwind CSS releases](https://github.com/tailwindlabs/tailwindcss/releases) + [release-please](https://github.com/googleapis/release-please)

**What the exemplars do:**
- Tailwind: every release has a curated changelog, signed artifacts, an upgrade guide for breaking changes, and an LTS policy.
- release-please: auto-generates release PRs from Conventional Commits, manages CHANGELOG.md + version bumps + GitHub Releases as one PR per release.

**Gap:** **Zero releases ever cut** (P1-12). The pipeline is built (Sigstore keyless, SBOM via CycloneDX, auto-changelog) but unvalidated. CHANGELOG references a v0.1.0 tag that doesn't exist on the remote.

**Action:** Cut v0.1.0 (P1-12). The pipeline will surface latent issues — that's the point of the validation. Consider adopting release-please for Conventional Commits → release-PR automation.

#### Dim 9 — Documentation → benchmark vs [DOCUMENTATION_REVIEW.md](DOCUMENTATION_REVIEW.md)

Handed off to the dedicated companion review. Summary: doc surface is broad and fresh (61 files, ~30 touched in last 30 days), but Diátaxis isn't surfaced in folder structure, no `ARCHITECTURE.md`, no RFC process, issue templates are stale markdown rather than YAML forms, no docs style guide, no All Contributors integration. See DOCUMENTATION_REVIEW.md § Recommendations for the full doc backlog (4 P0, 10 P1, 8 P2).

### New findings (not in Session 1)

The benchmark layer surfaced findings the inward review missed:

1. **No RFC process** — ADRs are post-hoc; substantial new work (PR Studio, zero-turn gameplay, observability adoption) deserves an upfront proposal flow. Exemplar: [rust-lang/rfcs](https://github.com/rust-lang/rfcs). **New P1.**
2. **No docs style guide** — voice and tone will drift as docs scale across 30+ contributors. Exemplar: [Next.js writing-style guide](https://github.com/vercel/next.js/blob/canary/contributing/docs/writing-style-guide.md). **New P1.**
3. **No All Contributors integration** — recognition is git-author-only; Aaron's Community Maintainer role is invisible. **New P2.**
4. **No REUSE.toml + SPDX headers** — 0 of 255 `lib/` TypeScript files have SPDX headers. [REUSE.software spec 3.3](https://reuse.software/spec-3.3/) is the standard. **New P2.**
5. **README references a v0.1.0 tag that doesn't exist on the remote** — CHANGELOG line "since the v0.1.0 tag (2026-01-27)" is misleading. **New P0 (cheap fix).**
6. **CODE_OF_CONDUCT is Covenant 2.1, not 3.0** (released late 2025). Non-breaking upgrade. **New P2.**
7. **Missing `.gitattributes`** — line-ending + linguist override. Minor but standard. **New P2.**
8. **Issue templates are stale markdown not YAML forms** — last touched 2026-01-27 (3.5 months). Triage quality could be much higher. **New P1.**
9. **ADR cadence has lapsed** — last ADR is 2026-04-13 (ADR-0006). Substantial decisions shipped since (PR Studio, zero-turn, account-deletion model, second-maintainer onboarding) without ADRs. **New P1.**
10. **Branch protection on develop is materially weaker than main** — no Build check, no `required_conversation_resolution`. Develop is where 90%+ of contributions land. **Restating P1-2 with sharper teeth.**

### Updated prioritized backlog (2026-Q3)

The full executable plan lives in [REVIEW_ACTION_PLAN.md § Phase 5](REVIEW_ACTION_PLAN.md). Summary here:

#### P0 — 3 open items + 4 new

| Source | Item | Effort |
|---|---|---|
| Carried | P0-1 — Actual collaborator onboarding (vs paper-only); commit-concentration recovery | M |
| Carried | P0-2 — Code-Review = 1/10 must move to ≥ 5 (10/20 changesets reviewed) | S (process) |
| Carried | P0-5 — Sentry + structured logging (REVIEW_ACTION_PLAN.md §2.1 is the runbook) | S-M |
| New | DOC-P0-1 — Write `docs/ARCHITECTURE.md` | S |
| New | DOC-P0-2 — Rewrite issue templates as YAML forms | S |
| New | DOC-P0-3 — Document `API.md` provenance + regen command | S |
| New | DOC-P0-4 — Resolve CHANGELOG v0.1.0 tag mismatch (push the tag, or amend CHANGELOG) | S |

#### P1 — carry-forwards + new

Carry-forwards from Session 1 (14 items): P1-1, P1-2, P1-5, P1-6, P1-7, P1-8, P1-9, P1-10, P1-11, P1-12, P1-13, P1-14, P1-15, P1-16.

New P1 items (from benchmark + docs review):

- New P1 — Bootstrap RFC process (`docs/rfcs/{README.md,0000-template.md}`).
- New P1 — Write `docs/STYLE_GUIDE.md` (banned words, second-person, vocabulary).
- New P1 — Add formal contributor ladder to GOVERNANCE.md (Kubernetes-style).
- New P1 — Restructure `docs/` into Diátaxis sub-folders.
- New P1 — Restructure CONTRIBUTING.md (5-minute funnel; cross-link `docs/generals/` as the model).
- New P1 — Backfill ADR-0007 (account deletion) + ADR-0008 (Community Maintainer track).
- New P1 — Promote `.github/ACTIVE_ISSUES.md` content to root `ROADMAP.md`.

#### P2 — carry-forwards + new

Carry-forwards: P2-1, P2-2, P2-3, P2-4, P2-5, P2-7.

New P2:

- All Contributors bot integration.
- `.gitattributes` for line-ending + linguist override.
- `docs/GLOSSARY.md` (game + platform + infra terms).
- Split `docs/API.md` into per-area files mirroring `lib/api-schemas/`.
- Maintainer-emeritus section in MAINTAINERS.md.
- Rewrite or delete `.github/DESIGN.md` stub.
- "Ship your first community feature" build-an-artifact tutorial.
- `docs/CONTRIBUTING_DOCS.md` (how to contribute docs specifically).
- REUSE.toml + SPDX headers on `lib/` source files.
- Upgrade CODE_OF_CONDUCT to Covenant 3.0.
- Add screenshots to README.

### Next refresh: 2026-08-18

Rerun cadence: 90 days. The Session 1 re-run instructions (preserved below) apply unchanged. The companion DOCUMENTATION_REVIEW.md has its own 90-day re-run script.

---

## Session 1 — 2026-05-06 (preserved verbatim)

**Date:** 2026-05-06 · **Reviewer:** @rogerSuperBuilderAlpha · **Commit:** `a818d0e`

This review is a **self-review** by the project's sole maintainer. That makes it a useful starting point for the project's own backlog, but every finding here would benefit from a second pair of eyes before it shapes long-term direction. An independent OSS reviewer should cross-check the privacy and bus-factor sections in particular.

---

## Executive summary

**Overall: 🟡 YELLOW** — strong engineering automation undermined by privacy/safety gaps and a bus factor of 1.

`cursor-boston` is a young (99-day-old) high-velocity Boston-developer-community platform built on Next.js 16 + Firestore, GPLv3, with mature security automation (DCO enforcement, OpenSSF Scorecard, Sigstore-signed releases, dependabot, gitleaks, SBOM via CycloneDX, 10 well-scoped CI workflows). Community contribution throughput is strong (~30% of merged PRs from outside the maintainer, median time-to-merge ~8h), and engineering hygiene shows in 0 circular dependencies and 0 TypeScript suppressions across 144+ source files.

The yellow rating is driven by three structural risks:

1. **Bus factor = 1** with a single admin, single CODEOWNER, and a stub `MAINTAINERS.md`. The published governance model anticipates this and prescribes process; in practice the prescriptions are violated (Scorecard records 1 of 22 sampled changesets had a recorded reviewer approval).
2. **Privacy/trust-safety promises that the product doesn't keep.** The Privacy Policy advertises self-serve account deletion that no endpoint implements; community-post abuse-reporting, cookie-consent banner, and minors-policy enforcement are absent on a public platform that hosts user-generated content and attracts students.
3. **Zero production observability.** No Sentry / OpenTelemetry / structured logging in direct dependencies. Errors are caught by error boundaries but not aggregated anywhere, leaving the maintainer blind to runtime issues.

### Top 5 strengths

1. **CI / supply-chain automation is mature.** 10 workflows cover lint+typecheck, unit+coverage tests, e2e (Playwright), Firestore-rules tests, license whitelist, gitleaks, SBOM, OpenSSF Scorecard, DCO enforcement, dependency review.
2. **Code hygiene is exemplary.** 0 `@ts-expect-error` / `@ts-ignore` across the codebase. 0 circular dependencies in the 144-file `lib/` tree.
3. **Contributor throughput is excellent.** ~30% non-maintainer-non-bot PR share over the last 200 PRs; median time-to-merge ~8h with p90 ~37h.
4. **Documentation is well-layered.** `docs/README.md` defines an explicit reading order, the Diátaxis quadrants map cleanly, ADRs are concise and current, and the in-flight `docs/generals/` contribution surface is the highest-quality contributor onboarding I've seen in a community-platform repo.
5. **Governance is self-aware.** `.github/GOVERNANCE.md` explicitly addresses "When there is only one maintainer" — which most single-maintainer projects don't.

### Top 5 findings (full list at [§ Prioritized Backlog](#prioritized-backlog))

1. **P0** — Bus factor 1 with no documented succession; single CODEOWNER; MAINTAINERS.md is a stub. ([§1](#dim-1--governance--bus-factor))
2. **P0** — Account-deletion promise in Privacy Policy is not implemented in code. ([§4](#dim-4--privacy-data-handling--trust--safety))
3. **P0** — No abuse/report flow on community user-generated content. ([§4](#dim-4--privacy-data-handling--trust--safety))
4. **P0** — No production error tracking, APM, or structured logging. ([§6](#dim-6--testing-reliability--observability))
5. **P0** — Code-review policy violated in practice (1/22 changesets with recorded approval) — direct contradiction with `GOVERNANCE.md` line 144. ([§1](#dim-1--governance--bus-factor) + [§3](#dim-3--security-posture--supply-chain))

---

## Methodology

This review applies a 9-dimension framework calibrated to the project's archetype (deployed community-platform application — Mozilla Archetypes "Specialty / Single-Vendor → aspiring Wide-Community"). Dimensions in priority order: Governance & Bus Factor → Community Health → Security Posture → Privacy & Trust/Safety → Product & Architecture → Testing/Reliability/Observability → Accessibility → Release Engineering → Documentation. Each dimension is reported with: questions, evidence (with reproducible commands), archetype-calibrated bands (Weak / Acceptable / Good / Exemplary), findings, and a RAG verdict.

**Skipped intentionally** (irrelevant to the archetype, not the project): fuzzing, npm provenance, public-API SemVer review, DB migration tooling, standalone i18n audit, full TODO Group OSPO maturity. Rationale in the [methodology plan](../.claude/plans/i-neeed-an-end-cosmic-iverson.md) outside this repo.

Raw evidence (every command, every output, every count) is preserved in [`oss-review-session-1-evidence.md`](../.claude/plans/oss-review-session-1-evidence.md) outside this repo. The Appendix here summarizes; the evidence file is the primary record.

---

## Dimension verdicts at a glance

| # | Dimension | RAG | Band |
|---|---|---|---|
| 1 | Governance & Bus Factor | 🔴 RED | Weak |
| 2 | Community Health & Contributor Funnel | 🟢 GREEN | Good |
| 3 | Security Posture & Supply Chain | 🟡 YELLOW | Acceptable, trending Good |
| 4 | Privacy, Data Handling & Trust/Safety | 🔴 RED | Weak |
| 5 | Product & Architecture Quality | 🟡 YELLOW | Acceptable |
| 6 | Testing, Reliability & Observability | 🔴 RED | Weak |
| 7 | Accessibility & Inclusive UX | 🟡 YELLOW | Acceptable |
| 8 | Release Engineering & Provenance | 🟡 YELLOW | Good (untested in practice) |
| 9 | Documentation & Onboarding | 🟢 GREEN | Good |

---

## Dim 1 — Governance & Bus Factor

**Frameworks:** CHAOSS (bus factor, contributor concentration), Mozilla Archetypes, GitHub OSS Guide
**Verdict:** 🔴 **RED — Weak**

### Evidence
- Sole admin / collaborator with merge rights: `@rogerSuperBuilderAlpha` (`gh api repos/.../collaborators` returns 1).
- `CODEOWNERS` lists a single owner; no per-path delegation.
- Commit concentration over the project's 99-day lifetime: ~63% to a single human (counting `Roger Hunt` + `Ludwitt` as the same person per project memory).
- `MAINTAINERS.md` is an 8-line pointer file; the actual maintainer table lives in `.github/GOVERNANCE.md`.
- `.github/GOVERNANCE.md` (193 lines) is substantive — defines four roles, code-review tiers, consensus + voting + emergency procedures, and explicitly addresses single-maintainer mode (lines 117-125).

### Findings
1. **Bus factor 1** with no documented succession plan beyond "step down gracefully if unable to fulfill responsibilities" (line 76). The project is GPLv3 so a community fork is legally possible, but operationally everything stops if Roger steps away. **P0.**
2. **Code-review policy violated in practice.** GOVERNANCE.md line 144: *"The author of a PR cannot approve their own changes."* OpenSSF Scorecard observes 1/22 sampled changesets with a recorded reviewer approval (Scorecard `Code-Review` score: 0). The single-maintainer section (lines 117-125) anticipates this and requires "community review time" + Project Lead approval — but neither is recorded in the GitHub PR artifact, so it's invisible to tooling and to future contributors. **P0.**
3. **MAINTAINERS.md is a stub** rather than the canonical maintainer list, contrary to LF / CHAOSS convention. Cheap fix. **P1** (blocked by #1 if you want a real list with >1 person).
4. **CODEOWNERS = single owner.** Cannot meaningfully delegate path-scoped review. **P1** (blocked by #1).

### Bands for this archetype

| Band | Criteria |
|---|---|
| Weak | Single admin, no succession plan, MAINTAINERS stub. *← current* |
| Acceptable | 1 primary + 2+ named "trusted reviewers" with merge rights, even if dormant |
| Good | 2+ active maintainers, documented succession + path-scoped CODEOWNERS |
| Exemplary | 3+ maintainers across orgs, written succession in GOVERNANCE.md, regular maintainer-summit cadence |

### Narrative
The governance documentation is mature and self-aware — better than most pre-1.0 projects. The mismatch is between policy and practice: the rules exist, but the only artifact GitHub records is "Roger merged Roger's PR." Two structural fixes raise the band immediately: (a) add at least one second human with `pull_request: review` permission and require a recorded approval on every PR (which the policy already says), or (b) keep solo merging but post the Discord/community-review-period evidence into the PR as a comment so future audits and Scorecard see the policy is being followed.

---

## Dim 2 — Community Health & Contributor Funnel

**Frameworks:** CHAOSS (TTFR, retention, diversity)
**Verdict:** 🟢 **GREEN — Good**

### Evidence
- 558 total PRs across the project's 99-day life.
- Last 200 PRs: 180 MERGED / 20 CLOSED / **0 currently open**.
- Author distribution (last 200): rogerSuperBuilderAlpha 114 (57%), `app/dependabot` 27 (13.5%), 17 distinct community contributors with the rest.
- **Non-maintainer non-bot PR share ≈ 29.5%** (just under the "Good ≥30%" threshold, effectively at it).
- **Median time-to-merge for non-maintainer PRs ≈ 8h, p90 ≈ 37h, max 39h** (sampled across the last 100 PRs, 11 non-maintainer merges).
- Issues: 134 total, 122 (91%) authored by Roger himself — i.e., the issue tracker is a maintainer-task list, not a user-bug-report channel. Community engagement flows through PRs and Discord.
- `stale.yml`: 90 days to stale, 14 to close, with sensible exemptions (`good first issue, help wanted, security, accessibility`).

### Findings
1. **Throughput is excellent.** 0 open PRs in last 200 + 8h median TTM is the strongest community-funnel signal in the review.
2. **Issue tracker is a maintainer planning tool, not a community channel.** This is fine for this archetype (Discord absorbs user-side conversation), but it means CHAOSS metrics that key off `Issues` undercount engagement.

### Bands

| Band | Criteria |
|---|---|
| Weak | TTM > 1 week, <10% non-maintainer PRs |
| Acceptable | TTM < 1 week, ≥15% non-maintainer PRs |
| Good | TTM < 72h, ≥30% non-maintainer PRs, ≥5 repeat contributors. *← current* |
| Exemplary | TTM < 24h, ≥50% non-maintainer PRs, sustained quarter-over-quarter growth |

### Narrative
For a 99-day-old project with one maintainer, 30% of merged PRs coming from outside in 8h median is exceptional. The asymmetry — Roger writes the issues, the community writes the PRs — is a real pattern, not a bug. If this scales, repeat-contributor count is the metric to watch quarter over quarter.

---

## Dim 3 — Security Posture & Supply Chain

**Frameworks:** OpenSSF Scorecard, OWASP ASVS L1, CII Best Practices
**Verdict:** 🟡 **YELLOW — Acceptable, trending Good**

### Evidence (OpenSSF Scorecard 2026-05-04, aggregate 6.9/10)
| Check | Score | Note |
|---|---:|---|
| Maintained / Security-Policy / License / Packaging / Dangerous-Workflow / Binary-Artifacts / Dependency-Update-Tool / CI-Tests / Contributors | 10 | strong base |
| SAST / Vulnerabilities | 9 | one open vuln, SAST not on every commit |
| Pinned-Dependencies | 7 | not pinned by hash |
| Branch-Protection | 4 | `enforce_admins: false`, `develop` lacks Build check |
| Code-Review | **0** | 1/22 changesets reviewed |
| Token-Permissions | **0** | `packages: write` on docker job (push: false) |
| CII-Best-Practices | 0 | no badge |
| Fuzzing | 0 | irrelevant for archetype — **skip** |
| Signed-Releases | -1 | no releases yet — Sigstore is wired but unused |

### Branch protection (gh api)
- **main**: 4 required checks (Lint+Typecheck / Test / Firestore rules / Build), 1 review with codeowner + dismiss-stale, conversation resolution required, force-pushes blocked. **`enforce_admins: false`**.
- **develop**: 3 required checks (no Build), conversation resolution NOT required. **`enforce_admins: false`**.

### Findings
1. **`enforce_admins: false`** on both protected branches — admin can bypass review and required checks. Easy fix. **P1.**
2. **2 open vulnerabilities** (`basic-ftp` high — DoS via unbounded multiline buffering; `uuid` moderate — bounds-check). Both transitive. CI gate is `npm audit --audit-level=high` which means the `basic-ftp` issue should be flagging fresh CI runs. **P1.**
3. **Token-Permissions = 0** is triggered by the `docker` job in `ci.yml` (lines 299-301) declaring `packages: write` while running `push: false`. Drop the unused permission. **P2 trivial.**
4. **Code-Review = 0** is a security finding as well as a governance finding (cross-listed with §1). The pattern of merging without recorded review is a single-point-of-failure pattern — if Roger's account is compromised, no second-human gate exists.
5. **Post-incident hardening incomplete.** `docs/security-incident-2026-04-11.md` (April 2026, $2,500 of Cursor referral codes exposed for ~15h) lists an action item: *"Consider adding a pre-commit hook or CI check to prevent committing files matching `*credit*` or `*referral*`"*. Verified: `.gitleaks.toml` has zero `credit|referral` matches; `.gitignore` has zero matches. The lesson was not banked. **P0.**
6. The exposed file remains on **two forks** (`Pradyumna369`, `pavithralagisetty`) — requires GitHub support tickets per fork. Operational, not a backlog item.

### Workflow permissions
All 10 workflows have explicit `permissions:` blocks ✓. `release.yml` correctly scopes `contents: write` + `id-token: write` for Sigstore. `dco.yml` and `dependency-review.yml` are read-only. `scorecards.yml` uses workflow-level `read-all` with job-scoped `security-events: write` + `id-token: write`. The one outlier is the `docker` job's unused `packages: write`.

### Narrative
The base is genuinely strong — the kind of supply-chain automation most pre-1.0 projects don't get to until later. What's holding the verdict at yellow rather than green: (a) admin-bypass on protected branches, (b) the unbanked April-incident lesson, (c) the structural Code-Review = 0 cross-cut with §1. None are large lifts. The `enforce_admins: true` toggle alone moves Branch-Protection from 4 to 8 in Scorecard's calculus.

---

## Dim 4 — Privacy, Data Handling & Trust/Safety

**Frameworks:** OWASP ASVS V8/V9, GDPR Article 17/20 pragmatics, COPPA pragmatics
**Verdict:** 🔴 **RED — Weak**

This is the highest-yield dimension of the review. Findings via systematic search across `app/api/`, `app/`, `components/`, `lib/`.

### Findings

1. **Account deletion is falsely advertised.** The Privacy Policy states *"You may delete your account at any time through your profile settings."* Reality: no `app/api/account/delete`, no `app/api/users/delete`, no delete button in `app/(auth)/profile/page.tsx`. Firestore writes never cascade-delete posts, replies, mentor profile, hackathon submissions, or game state. Beyond the policy/practice gap, this is a GDPR Article 17 ("right to erasure") and CCPA right-to-delete exposure if EU/California users matter. **P0.**
2. **No abuse / report-content flow** on community posts. The `app/api/community/` surface has post / reply / reaction / repost / delete-own. No `report`, `flag`, `block-user`, or `moderation/queue`. The only moderation surface is `app/api/talks/submission/moderate` (admin queue for talk submissions, not user-initiated reporting). For a public platform with user-generated content + reactions, this is a meaningful safety gap. **P0.**
3. **Mentor-match consent missing.** `app/api/mentorship/request` and `app/api/mentorship/respond` create pairings without an explicit consent disclosure to the requester before profile fields become visible. **P1.**
4. **No cookie / consent banner.** `app/cookies/page.tsx` is a static policy page; the Privacy Policy describes cookie use; no opt-in banner anywhere in the app. Tolerable under CCPA, fragile under GDPR if EU traffic is non-trivial. **P1 (P0 if EU traffic is meaningful).**
5. **Minors policy unenforced.** Privacy Policy has COPPA boilerplate ("not intended for users under 13"). No age verification, no parental consent flow, no minors-policy enforcement. Hackathons attract students, some <18; the platform has no gating. **P1.**
6. **Rate limiting is partial.** Upstash Redis (`@upstash/ratelimit`) is wired on ~31 endpoints (`community/post`, `community/reply`, `community/repost`, `cookbook/vote`, `profile/{update,visibility}`, `questions/{post,answer,vote}`, `showcase/{submission,vote}`, others). **NOT rate-limited on `community/reaction`, `community/delete` (in-memory only), `mentorship/request`, `mentorship/respond`, hackathon signup/team endpoints, all `game/*` endpoints.** Reactions and mentor-request spam are unprotected. **P1.**
7. **Data export endpoint is partial.** `app/api/profile/data/route.ts` exists and returns a JSON bundle via `fetchProfileDataBundleJson()`. No standardized GDPR Article 20 portable format, no UI affordance to invoke it from the user's profile page. **P1 — half-implemented.**
8. **PII inventory matches reality.** Privacy Policy categories cover the actual Firestore collections. No hidden collection ✓.
9. **Email unsubscribe is HMAC-verified ✓** (`app/api/notifications/unsubscribe?email=&token=`). Acceptable.

### Bands

| Band | Criteria |
|---|---|
| Weak | Account deletion absent or broken, no abuse-reporting on UGC. *← current* |
| Acceptable | Account deletion + abuse-reporting + working unsubscribe. PII inventory documented. |
| Good | + cookie consent banner, mentor-match consent step, data-export UI affordance. |
| Exemplary | + minors policy enforcement, regular privacy audits, public PII inventory. |

### Narrative
The legal/policy posture is reasonable — Privacy Policy, Cookie Policy, Terms references all exist. The implementation gap is the issue: a public community platform with user-generated content needs at minimum (a) a working delete-my-account flow that cascades through Firestore, (b) a way for users to report abusive content, (c) consent on mentor-match. These are not large engineering lifts — together they're a 1-2 sprint project — and they unblock a meaningful chunk of the policy-vs-practice risk.

---

## Dim 5 — Product & Architecture Quality

**Frameworks:** internal — strict TS, Firestore rules surface, Next.js 16 RSC boundaries
**Verdict:** 🟡 **YELLOW — Acceptable**

### Evidence

| Signal | Value | Note |
|---|---|---|
| Circular deps in lib/ (madge over 144 files) | **0** | strong cohesion ✓ |
| `@ts-expect-error` / `@ts-ignore` | **0** | exemplary ✓ |
| `as any` / `as unknown as` | 81 across lib/+app/+components/ | moderate debt |
| `eslint-disable` directives | 36 (26× `react-hooks/set-state-in-effect`, 6× `exhaustive-deps`, 4× `no-img-element`) | acknowledged tech debt |
| Client components | 116 of 186 tsx/ts files = 62% | high but plausible for interactive UI |
| Error boundaries | `app/error.tsx`, `app/global-error.tsx`, `components/ErrorBoundary.tsx` | adequate framework-level coverage |
| Firestore composite indexes | 36 across 17+ collections | comprehensive |
| `firestore.rules` size | 433 lines, ~40 collection blocks | substantial |

### Findings
1. **Zero TS suppressions and zero circular deps** are exemplary signals — most pre-1.0 codebases this size carry both. Carry forward as strengths.
2. **`as any` density at 81** is the visible technical-debt surface in an otherwise strict codebase. **P1** — one focused sweep over the worst clusters would close most of it.
3. **62% client-component density** is high for Next 16's RSC model. Not a defect — server-component refactor is an ongoing opportunity, not a regression. **P2.**
4. **eslint-disable cluster** on `react-hooks/set-state-in-effect` (26 sites) is acknowledged in `eslint.config.mjs` as React-Compiler-rule debt. The 6 `exhaustive-deps` disables warrant per-site review (these are the ones that bite at runtime). **P2.**
5. **Firestore rules tests are thin** — see §6. Cross-listed there.

### Narrative
The architecture has the bones of a much older project: zero cycles in 144 files, zero TS suppressions, comprehensive index coverage, well-scoped error boundaries. The gaps are in test depth on the Firestore rules surface (§6) and a moderate `as any` debt that's invisible to CI. Neither blocks shipping; both reward focused cleanup.

---

## Dim 6 — Testing, Reliability & Observability

**Frameworks:** CII Best Practices, Google SRE basics
**Verdict:** 🔴 **RED — Weak**

### Evidence (local Jest run, 380 source files instrumented)

| Area | Files | Lines % | Branches % |
|---|---:|---:|---:|
| **app/** | 247 | 32.2 | 24.8 |
| **lib/** | 81 | 43.1 | 30.9 |
| **components/** | 51 | 45.9 | 47.3 |
| contexts/ | 1 | 0 | 0 |
| **TOTAL** | **380** | **35.7** | **28.4** |

- **Firestore rules tests:** `__tests__/config/firebase/firestore.rules.test.ts` is 274 lines with 8 `it/test/describe` invocations covering ~40 collections × {auth, unauth, owner, admin, malformed} states. Industry-typical rules suites at this scale are 1k+ lines / 100+ cases.
- **E2E:** Playwright + chromium only, ~5 smoke specs under `e2e/smoke/`. WebServer auto-starts. No happy-path coverage of signup flow, community-post creation, or game-turn submission.
- **Observability:** zero direct dependencies on Sentry / OpenTelemetry / Datadog / Pino / Winston / Rollbar / Honeycomb / NewRelic. `@opentelemetry/*` and `winston` appear only as transitive deps (under `firebase-admin`). Application code uses raw `console.log/error/warn` — 19 sites in `lib/`, more elsewhere.

### Findings
1. **No production error tracking, APM, or structured logging.** Errors caught by `app/error.tsx` and `components/ErrorBoundary.tsx` are surfaced to the user but not aggregated anywhere. The maintainer is operating blind to runtime issues. **P0** — single highest-leverage finding in the review.
2. **Coverage on `app/` at 32% lines / 25% branches** is below acceptable for a UI-heavy app. **lib/ branches at 31%** vs. archetype-calibrated 50% target. **P1.**
3. **Firestore rules tests = 8 cases for ~40 collections.** The rules pass syntactically but most allow/deny edges are not directly asserted. Highest leverage in this dimension: every new collection should ship with rules tests. **P1.**
4. **E2E is smoke-only.** Add at least one happy-path spec per major subsystem (auth, community post, mentorship request, game turn). **P1.**

### Bands

| Band | Criteria |
|---|---|
| Weak | <40% line coverage on lib/, smoke-only e2e, no error tracking. *← current* |
| Acceptable | 50% branch on lib/, 100% on Firestore rules, e2e covers signup + 1 happy-path per major subsystem, error tracking wired. |
| Good | + structured logging, web-vitals tracking, deploy-time smoke checks. |
| Exemplary | + SLOs, error-budget process, on-call docs. |

### Narrative
The CI pipeline gates on coverage (`test:coverage`), but the gate threshold is implicit — there's no `coverageThreshold` block visibly enforcing minimums by directory. Wiring Sentry (or any equivalent) is the single highest-leverage move in this review: it converts the maintainer from "blind" to "informed" with one PR. Coverage and rules-test depth are slower investments but compound over time.

---

## Dim 7 — Accessibility & Inclusive UX

**Frameworks:** WCAG 2.2 AA
**Verdict:** 🟡 **YELLOW — Acceptable**

### Evidence
- `eslint-plugin-jsx-a11y` is installed and configured.
- **All a11y rules are set to `"warn"`, not `"error"`** — violations don't block CI.
- Configured: `alt-text`, `aria-props`, `aria-proptypes`, `aria-unsupported-elements`, `role-has-required-aria-props`, `role-supports-aria-props`.
- **Missing common rules**: `anchor-is-valid`, `click-events-have-key-events`, `no-noninteractive-element-interactions`, `no-static-element-interactions`, `label-has-associated-control`, `no-redundant-roles`, `tabindex-no-positive`, `media-has-caption`.
- `.github/ACCESSIBILITY.md` claims commitment to WCAG 2.1 AA with documented testing flow and a known-limitation note on Leaflet's keyboard support.
- axe-core runtime sweep deferred to a future session — needs a Playwright build run.

### Findings
1. **a11y lint rules are advisory, not enforcing.** Direct conflict with `.github/ACCESSIBILITY.md`'s WCAG commitment. Promote to `"error"` and add the missing rules; expect short-term churn on a known set of legacy components. **P1.**
2. **No axe-core in e2e suite.** The single highest-leverage runtime check would be wiring `@axe-core/playwright` into the existing Playwright suite. **P1.**

### Narrative
The intent is documented; the enforcement is not. Move the lint config one notch and add one e2e spec — the gap closes in a day.

---

## Dim 8 — Release Engineering & Provenance

**Frameworks:** Keep a Changelog, SemVer, SLSA L2, Sigstore
**Verdict:** 🟡 **YELLOW — Good (untested in practice)**

### Evidence
- `.github/workflows/release.yml` (174 lines, tag-driven `v*.*.*` + `workflow_dispatch`).
- Pipeline: lint → typecheck → test+coverage → Firestore rules → validate-env → build → SBOM (CycloneDX) → auto-changelog (mikepenz) → GitHub Release → cosign sign-blob (Sigstore keyless via OIDC).
- `docs/RELEASING.md` (30 lines): tag-driven, SemVer, references `CHANGELOG.md`.
- `CHANGELOG.md`: Keep-a-Changelog format, baselines `v0.1.0` (2026-01-27), Unreleased section maintained.
- **0 git tags** — no actual release has been cut.
- Container build in `ci.yml` is `push: false` — explicitly deferred per `RELEASING.md`.

### Findings
1. **No release ever cut.** The pipeline is well-built but unverified in practice. Tag a real `v0.1.0` to flush latent issues (env vars, OIDC, cosign keyless against this repo's identity). **P1.**
2. **Only `sbom.json` is signed** — the source-archive zips/tarballs auto-attached to the GitHub Release are not. For a deployed app with no consumers this is acceptable scope; document the choice in `RELEASING.md`. **P2.**
3. `RELEASING.md` doesn't document rollback or how to handle a botched release. Add a 5-line section. **P2.**

### Narrative
This is the dimension closest to flipping green. The mechanics are in place; only the execution is missing. Cutting a `v0.1.0` (which already exists as a CHANGELOG baseline) would validate the entire pipeline.

---

## Dim 9 — Documentation & Onboarding

**Frameworks:** GitHub OSS Guide, Diátaxis
**Verdict:** 🟢 **GREEN — Good**

### Diátaxis quadrant mapping

| Quadrant | Files |
|---|---|
| **Tutorial** (learning by doing) | `docs/GET_STARTED.md` (non-coder onboarding via AI tools), `docs/FIRST_CONTRIBUTION.md` (PR walkthrough) |
| **How-to** | `docs/RELEASING.md`, `docs/ADD_CONTENT.md`, `docs/HACK_A_SPRINT_2026_OPS.md`, `docs/CONTRIBUTOR_MERGE_CREDIT_BACKFILL.md`, `docs/VERCEL.md` |
| **Reference** | `docs/API.md` (212 lines, 63 endpoints), `docs/SUPPLY_CHAIN.md`, `docs/DEVELOPMENT.md` |
| **Explanation** | `docs/adr/0001..0006-*.md` + index README, `docs/security-incident-2026-04-11.md` |

### Findings
1. **`docs/README.md` defines an explicit numbered reading order** — strongest onboarding signal in the repo. The original review-plan flag about overlap between GET_STARTED / DEVELOPMENT / FIRST_CONTRIBUTION was wrong; they layer cleanly.
2. **6 ADRs** (GPL3 license, Firebase backend, fork-only workflow, Webpack bundler, in-memory rate limiting, develop-main branching) + index — concise, dated, well-formatted.
3. **Generals contribution docs (this branch's work)**: 8 files (LORE / UNITS / SPELLS / ARTIFACTS / BUILDINGS / CASTES / UI_AND_GRAPHICS / BALANCE) — each names exact file paths to edit, testing steps, and rejection criteria. Highest-quality contributor onboarding in the repo.
4. **No `docs/ARCHITECTURE.md`.** README has a one-section architecture sketch + diagram; ADRs cover specific decisions but don't synthesize an end-to-end architectural overview. For a project with ~40 Firestore collections + 132 API routes + 9 distinct subsystems, a 1-page `ARCHITECTURE.md` (subsystem map, data flow, deployment topology) earns its keep. **P1.**
5. **No generated API docs** (TypeDoc/JSDoc/Sphinx) — manual `docs/API.md` is current and acceptable for a 63-endpoint REST surface; do not add doc-gen tooling unless drift becomes painful.

### Narrative
The strongest dimension. The reading-order, the ADR cadence, and the generals contribution surface together set a higher bar than most pre-1.0 projects clear. The single gap is the missing `ARCHITECTURE.md` — and that's a doc to write once, not a system to maintain.

---

## Prioritized backlog

Effort estimates: **S** = a few hours, **M** = 1-3 days, **L** = a week+. Items ordered by priority within each band.

### P0 — must address (6 items)

| # | Finding | Dim | Effort |
|---|---|---|---|
| P0-1 | Bus factor 1 — onboard at least one second collaborator with merge rights; document succession in GOVERNANCE.md | 1 | M |
| P0-2 | Code-Review = 0/22: either require recorded approvals on all PRs (preferred) or post Discord-review evidence into PR comments | 1, 3 | S |
| P0-3 | Implement working account-deletion endpoint with Firestore cascade across user-owned collections; wire delete button into profile page | 4 | M |
| P0-4 | Add abuse / report-content flow on community posts (report endpoint + admin moderation queue + block-user) | 4 | M |
| P0-5 | Wire production error tracking (Sentry or equivalent) + minimal structured logging on API routes | 6 | S |
| P0-6 | Add gitleaks rule + `.gitignore` entries for `*credit*` / `*referral*` patterns (April 2026 incident action item) | 3 | S |

### P1 — should address (12 items)

| # | Finding | Dim | Effort |
|---|---|---|---|
| P1-1 | Toggle `enforce_admins: true` on `main` and `develop` branch protection | 3 | S |
| P1-2 | Add `Build` required check on `develop` and `required_conversation_resolution: true` | 3 | S |
| P1-3 | Bump `basic-ftp` (high) and `uuid` (moderate) — likely transitive via firebase-admin | 3 | S |
| P1-4 | Mentor-match consent step before profile fields become visible | 4 | S |
| P1-5 | Cookie consent banner (esp. if EU traffic is meaningful) | 4 | M |
| P1-6 | Minors policy enforcement (age gating on sign-up; parental consent flow if applicable) | 4 | M |
| P1-7 | Add Upstash rate limiting to `community/reaction`, `community/delete`, `mentorship/request`, `mentorship/respond`, hackathon signup, and game write endpoints | 4 | M |
| P1-8 | Standardize data-export response (GDPR Article 20 format) + add UI affordance | 4 | S |
| P1-9 | Promote a11y lint rules from `warn` to `error`; add missing `anchor-is-valid`, `click-events-have-key-events`, `no-noninteractive-element-interactions`, `label-has-associated-control` | 7 | S |
| P1-10 | Wire `@axe-core/playwright` into existing Playwright e2e suite | 7 | S |
| P1-11 | Expand Firestore rules tests from 8 cases to comprehensive allow/deny matrix per collection | 5, 6 | L |
| P1-12 | Cut a real `v0.1.0` release to validate the release pipeline end-to-end | 8 | S |
| P1-13 | Sweep the 81 `as any` / `as unknown as` casts; eliminate or annotate | 5 | M |
| P1-14 | Raise coverage thresholds (50% branch on lib/, 40% on app/) and enforce in `jest.config.js` | 6 | M |
| P1-15 | Add E2E happy-path specs for: signup, community post, mentorship request, game turn | 6 | M |
| P1-16 | Write `docs/ARCHITECTURE.md` synthesizing subsystem map, data flow, deployment topology | 9 | S |
| P1-17 | List human maintainers directly in `MAINTAINERS.md` (blocked by P0-1 if you want >1) | 1 | S |
| P1-18 | Add path-scoped `CODEOWNERS` entries (blocked by P0-1) | 1 | S |

### P2 — nice to have

| # | Finding | Dim |
|---|---|---|
| P2-1 | Drop unused `packages: write` from `docker` job in `ci.yml` | 3 |
| P2-2 | Apply for OpenSSF / CII Best Practices badge | 3 |
| P2-3 | Audit the 6 `react-hooks/exhaustive-deps` eslint-disable sites | 5 |
| P2-4 | RSC migration sweep — push static pages off `'use client'` | 5 |
| P2-5 | Document rollback procedure in `RELEASING.md` | 8 |
| P2-6 | Sign source-archive release artifacts (not just SBOM) | 8 |
| P2-7 | Surface email-preference UI in `app/(auth)/profile/notifications` | 4 |

### Operational (not backlogged)

- Two forks (`Pradyumna369`, `pavithralagisetty`) still carry the April 2026 credit-codes file. Each requires a GitHub support request: github.com/contact → "Report a security vulnerability".

---

## Re-run instructions

This review is a snapshot at `commit a818d0e` on 2026-05-06. To refresh in 90 days:

1. Run the Session 1 mechanical evidence script (commands in [`oss-review-session-1-evidence.md`](../.claude/plans/oss-review-session-1-evidence.md) — git shortlog, gh API pulls, scorecard fetch, npm audit, madge, jest coverage, workflow permissions grep).
2. Read code paths flagged in §4 and §6 to spot regressions.
3. Diff the dimension-verdict table at the top of this file: any band drop is a red flag, any band rise is worth celebrating.
4. Update the frontmatter `review_date`, `commit_sha`, `previous_review`, `overall_rag` fields.
5. Append a `## Changes since previous review` section before this one — do not edit prior reviews.

Estimated refresh cost: ~4 hours mechanical + ~4 hours synthesis = one work day.

---

## Appendix — evidence summary

Full raw evidence is preserved in [`oss-review-session-1-evidence.md`](../.claude/plans/oss-review-session-1-evidence.md) (Sessions 1 and 2). Key reproducible commands:

```bash
git log --since=1.year.ago --pretty=format:'%an' | sort | uniq -c | sort -rn
gh api repos/rogerSuperBuilderAlpha/cursor-boston/collaborators
gh pr list --repo ... --state all --limit 200 --json number,author,createdAt,mergedAt,closedAt,state
gh issue list --repo ... --state all --limit 200 --json number,author,createdAt,closedAt,state,comments
gh api repos/.../branches/{main,develop}/protection
curl -sS https://api.securityscorecards.dev/projects/github.com/rogerSuperBuilderAlpha/cursor-boston
npm audit --json
npx madge@7 --circular --extensions ts,tsx lib/
jq … coverage/coverage-summary.json
grep -rn 'as any\|as unknown as' --include='*.ts' --include='*.tsx' lib/ app/ components/ | wc -l
grep -rl '"use client"\|'\''use client'\''' --include='*.tsx' --include='*.ts' app/ components/ | wc -l
wc -l __tests__/config/firebase/firestore.rules.test.ts
grep -cE '^\s*(it|test|describe)\(' __tests__/config/firebase/firestore.rules.test.ts
```

---

## Self-review caveat

This review was produced by the project's sole maintainer in collaboration with a Claude Code session. Single-author audits have a known blindness to in-group norms. Findings around governance, code review, and privacy in particular would benefit from an independent second reviewer. Recommend re-running with a CHAOSS / OpenSSF community-reviewer or a peer maintainer from a comparable community-platform OSS project before treating any P0/P1 verdict as final.
