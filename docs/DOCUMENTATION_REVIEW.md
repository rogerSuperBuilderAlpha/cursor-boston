---
review_date: 2026-05-18
reviewer: rogerSuperBuilderAlpha
commit_sha: a83bb741ecb68ea7c8ba2bf3805a11538c6b68f7
branch_reviewed: release/develop-to-main-zero-turn
companion: docs/OPENSOURCE_REVIEW.md
framework: Diátaxis + GitHub Community Standards + Next.js docs writing-style guide
overall_rag: yellow
---

# Cursor Boston — Documentation Review (master-class benchmark)

**Date:** 2026-05-18 · **Reviewer:** @rogerSuperBuilderAlpha · **Commit:** `a83bb74`

Companion to [`OPENSOURCE_REVIEW.md`](OPENSOURCE_REVIEW.md). That review treats docs as 1 of 9 dimensions; this review is a dedicated docs-only pass, benchmarked against named exemplars from the most organized OSS projects in production today (Astro, Next.js, Supabase, Kubernetes, Rust, Tailwind, shadcn/ui, Stripe).

> **Self-review caveat (same as the parent review):** this is a self-audit. The lift in §9 of OPENSOURCE_REVIEW.md was earned; the docs surface is large and current. The gaps below are real but the bar is calibrated against the top of the field, not minimum viability.

---

## Executive summary

**Overall: 🟡 YELLOW** — strong coverage and freshness across 61 markdown files; weakened by an absent Diátaxis surface organization, a flat `docs/` layout, no canonical architecture doc, and several master-class signals (YAML issue forms, RFC process, docs style guide, All Contributors integration) that are absent.

### Top 3 strengths

1. **Coverage breadth + freshness.** 61 markdown files (~530KB), with 30+ files touched in the last 30 days. `docs/README.md` defines an explicit ordered reading path. `docs/generals/` is the highest-quality contributor onboarding surface in the repo and is already the right model to replicate elsewhere.
2. **Quadrant balance is roughly correct.** Tutorials (`GET_STARTED`, `FIRST_CONTRIBUTION`), how-tos (`RELEASING`, `ADD_CONTENT`, `HACK_A_SPRINT_2026_OPS`), reference (`API`, `DEVELOPMENT`, `SUPPLY_CHAIN`), and explanation (`docs/adr/`, `security-incident-2026-04-11`) all exist as separable entities. Compared to most pre-1.0 projects, this is unusually clean.
3. **Governance + community files are present and substantive.** `CONTRIBUTING.md` (572 lines), `GOVERNANCE.md` (207 lines), `CODE_OF_CONDUCT.md`, `SECURITY.md`, `MAINTAINERS.md`, `SUPPORT.md`, `DCO.md`, `TRADEMARK.md`, `ACCESSIBILITY.md`. The GitHub Community Standards checklist passes every item.

### Top 5 gaps (full list at [§ Recommendations](#recommendations))

1. **No `docs/ARCHITECTURE.md`** — flagged in [OPENSOURCE_REVIEW.md P1-16](OPENSOURCE_REVIEW.md#prioritized-backlog) (2026-05-06), still missing. Exemplar: [supabase/supabase/ARCHITECTURE.md](https://github.com/supabase/supabase/blob/master/ARCHITECTURE.md). **P0.**
2. **Issue templates are markdown, not YAML forms.** `bug_report.md` + `feature_request.md` last touched 2026-01-27 (>3 months stale). Compare to [vercel/next.js's YAML forms with dropdowns + required fields](https://github.com/vercel/next.js/tree/canary/.github/ISSUE_TEMPLATE). YAML forms produce more triagable reports. **P1.**
3. **No docs style guide.** Without one, voice and tone drift as contributors land docs. Compare to [vercel/next.js/contributing/docs/writing-style-guide.md](https://github.com/vercel/next.js/blob/canary/contributing/docs/writing-style-guide.md) (bans "easy"/"just", mandates second-person, lists component vocabulary). **P1.**
4. **`docs/` is flat — Diátaxis isn't surfaced.** 22 files in one directory; the quadrant mapping lives in `docs/README.md` text rather than folder structure. Compare to [Astro's `docs/src/content/docs/{tutorial,guides,recipes,reference}`](https://github.com/withastro/docs/tree/main/src/content/docs) or [Stripe's four-tab top nav](https://docs.stripe.com/). **P1.**
5. **No RFC process.** ADRs (Nygard format) capture decisions after the fact; substantial future changes (observability adoption, account-deletion model, etc.) deserve an upfront proposal flow. Compare to [Rust RFCs](https://rust-lang.github.io/rfcs/) and [React's RFC repo](https://github.com/reactjs/rfcs). **P1.**

Additional gaps inventoried below: missing `ROADMAP.md` at the canonical path (the README's roadmap is 4 lines; the real planning lives in `.github/ACTIVE_ISSUES.md` — fine surrogate but non-discoverable); `.gitattributes` absent; no All Contributors bot (non-code contributors invisible); no SPDX headers in `lib/` (0 of 255 files); README is text-heavy with no platform screenshots; ADR-0007+ unwritten for major post-April decisions (PR Studio, account-deletion model, second-maintainer onboarding); CODE_OF_CONDUCT is Covenant 2.1 (Covenant 3.0 is current as of late 2025).

---

## Inventory — 61 markdown files

`find . -name "*.md" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./.git/*" | wc -l` → **61**.

### Root-level docs (7)

| File | Last touched | Quadrant | Quality | Notes |
|---|---|---|---|---|
| `README.md` | 2026-05-17 | Tutorial → How-to → Reference (mixed) | High | Strong hero, role-based targeting, mermaid diagram, claim-an-issue table. No screenshots. |
| `CHANGELOG.md` | 2026-05-17 | Reference | High | Keep-a-Changelog format, comprehensive Unreleased section. Notes the `v0.1.0` tag (2026-01-27), but `git tag` returns empty — the tag is referenced but not pushed. |
| `CLAUDE.md` | 2026-05-17 | Reference | High | Project-specific instructions for Claude Code sessions. |
| `CONTRIBUTORS.md` | 2026-04-08 | Reference | Medium | Auto-updated from git authorship by `update-contributors.yml`. Misses non-code contributions. |
| `MAINTAINERS.md` | 2026-05-13 | Reference | High | Lists 4 humans, per-area primaries, Community Maintainer track explanation. |
| `LICENSE` | 2026-04-06 | Reference | High | Verbatim GPL-3.0. |
| `NOTICE` | 2026-04-06 | Reference | High | SPDX identifier + project copyright. |

### `.github/` policy + templates (15)

| File | Last touched | Quadrant | Quality | Notes |
|---|---|---|---|---|
| `CONTRIBUTING.md` | 2026-05-17 | How-to | High | 572 lines. Comprehensive. Risk: "first PR" path may be buried; verify against Astro's "5 minutes to your first commit" funnel. |
| `GOVERNANCE.md` | 2026-05-13 | Explanation | High | 207 lines. Self-aware re: single-maintainer mode. Lacks formal maintainer ladder (Contributor → Reviewer → Maintainer → Owner). |
| `CODE_OF_CONDUCT.md` | 2026-05-07 | Reference | Medium | Contributor Covenant **2.1** (verified). Covenant 3.0 is the current version; upgrade is non-breaking. |
| `SECURITY.md` | 2026-05-13 | Reference | High | Multi-channel disclosure, 48h SLA, well-known/security.txt cross-link. Exemplary. |
| `SUPPORT.md` | 2026-04-06 | Reference | Medium | Lists Discord + Issues + email + Luma. Discord-centric model. |
| `DCO.md` | 2026-01-29 | Explanation | Medium | **Stale (3.5 months)** — content is policy, not likely to change, but warrants a freshness pass. |
| `TRADEMARK.md` | 2026-01-29 | Reference | Medium | **Stale.** Same caveat. |
| `ACCESSIBILITY.md` | 2026-04-05 | Reference | Medium | WCAG 2.1 AA commitment. Conflicts with current eslint config (rules at `warn` not `error` — see [OPENSOURCE_REVIEW.md §7](OPENSOURCE_REVIEW.md#dim-7--accessibility--inclusive-ux)). |
| `DESIGN.md` | 2026-02-18 | Reference | Low | **Stale + thin (4K)** — design system stub. |
| `README_GIT.md` | 2026-04-06 | How-to | Medium | Git workflow guide. Overlaps with CONTRIBUTING.md branching section — verify which is canonical. |
| `ACTIVE_ISSUES.md` | 2026-05-13 | Reference | High | Serves as the de facto ROADMAP. Should be promoted to `ROADMAP.md` at root, or README should link to it as "Roadmap" not as a generic GitHub link. |
| `MAINTAINER_APPLICATION_TEMPLATE.md` | 2026-05-13 | How-to | High | Self-nomination path documented. |
| `ISSUE_TEMPLATE/bug_report.md` | 2026-01-27 | How-to | Low | **Stale (4 months)** + markdown not YAML form. Re-author as YAML form. |
| `ISSUE_TEMPLATE/feature_request.md` | 2026-01-27 | How-to | Low | **Stale** + markdown. Same fix. |
| `PULL_REQUEST_TEMPLATE.md` | 2026-04-05 | How-to | Medium | Comprehensive checklist. Could add a "linked issue or RFC" required field. |
| `ISSUE_TEMPLATE/config.yml` | 2026-04-06 | Reference | High | Routing config (Discord, security, dev guide). |

### `docs/` (22 files)

| File | Last touched | Quadrant | Quality | Notes |
|---|---|---|---|---|
| `README.md` | 2026-05-17 | Reference | High | Explicit ordered reading path. The single highest-leverage doc in the directory. |
| `GET_STARTED.md` | 2026-04-06 | Tutorial | High | Plain-language, AI-tools-first onboarding. Distinctive. |
| `DEVELOPMENT.md` | 2026-05-17 | Reference + How-to (mixed) | High | 20K. Verify "first 5 minutes" path is up top vs buried under prerequisite chains. |
| `FIRST_CONTRIBUTION.md` | 2026-04-30 | Tutorial | High | Step-by-step first PR walk. |
| `API.md` | 2026-05-16 | Reference | High | 28K, 178 paths. README says auto-generated; verify the regen command is documented inline. |
| `RELEASING.md` | 2026-04-06 | How-to | Medium | 30-line runbook. Lacks rollback procedure. |
| `SUPPLY_CHAIN.md` | 2026-05-12 | Reference + Explanation (mixed) | High | Security automation overview. |
| `SECURITY_OPERATIONS.md` | 2026-05-12 | How-to | High | Incident response runbook. |
| `security-incident-2026-04-11.md` | 2026-05-12 | Explanation | High | Post-mortem. Action item ("add gitleaks rule") was banked — verified `.gitleaks.toml` now has `cursor-referral-url` and `credit-referral-file-content` rules. |
| `VERCEL.md` | 2026-04-06 | Explanation + How-to | High | Why-PRs-don't-deploy policy. |
| `ADD_CONTENT.md` | 2026-04-18 | How-to | High | Blog posts / events / community content. |
| `SUBMISSION_BRANCHES.md` | 2026-05-17 | Reference | High | Long-lived branch routing. |
| `HACK_A_SPRINT_2026_OPS.md` | 2026-04-13 | How-to | High | Event ops runbook. |
| `CONTRIBUTOR_MERGE_CREDIT_BACKFILL.md` | 2026-03-31 | How-to | Medium | Process doc; verify still accurate. |
| `BRANCH_PROTECTION.md` | 2026-05-12 | Reference | High | Branch protection rules. |
| `USER_GUIDE.md` | 2026-05-17 | Reference | High | Public sitemap of cursorboston.com. |
| `OPENSOURCE_REVIEW.md` | 2026-05-07 | Explanation | High | The companion to this doc. |
| `REVIEW_ACTION_PLAN.md` | 2026-05-07 | How-to | High | 12-week phased plan. |

### `docs/adr/` (7 files)

ADR-0001..0006 dated 2026-04-08 / 2026-04-13. README index dated 2026-04-13. **No ADR-0007 or later** — but several substantial decisions have shipped since (PR Studio workflow, zero-turn gameplay layer, account deletion model, second-maintainer onboarding, Heroes v2, Armageddon end-game). At least 2-3 of these warrant ADRs.

### `docs/generals/` (12 files)

| File | Last touched | Quadrant | Notes |
|---|---|---|---|
| `README.md` | 2026-05-17 | Tutorial → Reference | Maps caste/spell/hero areas to files. |
| `LORE.md` | 2026-05-06 | Explanation | Narrative + flavor. |
| `UNITS.md` | 2026-05-06 | Reference | Per-caste unit design. |
| `SPELLS.md` | 2026-05-06 | Reference | Spell mechanics. |
| `ARTIFACTS.md` | 2026-05-06 | Reference | Items + rarity tiers. |
| `BUILDINGS.md` | 2026-05-17 | Reference | Tile upgrades + progression. |
| `HEROES.md` | 2026-05-17 | Reference | Hero registry + mechanics. |
| `CASTES.md` | 2026-05-17 | Reference | 5 playable castes. |
| `ARMAGEDDON.md` | 2026-05-17 | Reference + Explanation | End-game mechanics. |
| `NON_TURN_ACTIVITIES.md` | 2026-05-17 | Reference | Profile/title/reaction surface. |
| `BALANCE.md` | 2026-05-17 | Reference | Cross-cutting numeric bands. |
| `UI_AND_GRAPHICS.md` | 2026-05-06 | Reference | UI/icon/color guide. |

**Verdict:** the strongest documentation surface in the repo. Cross-link this from `.github/CONTRIBUTING.md` and from `docs/README.md` as **"the model contributor surface"** worth replicating for the next feature project (e.g., Cookbook, Pair Programming) that lands.

### Other (3)

- `content/blog/welcome-to-cursor-boston.md` (2026-05-08) — published content, not a doc.
- `content/hackathons/hack-a-sprint-2026/submissions/README.md` (2026-05-14) — event submissions guide.
- `pydata-2026-submissions/README.md` (2026-05-14) — PyData notebooks submission guide.
- `scripts/data/analysis-2026-05-12/REPORT.md` (2026-05-12) — analysis snapshot.

---

## Diátaxis structural audit

The [Diátaxis framework](https://diataxis.fr/) separates documentation into four quadrants — Tutorials (learn by doing), How-To Guides (goal-oriented for competent users), Reference (exhaustive facts), Explanation (concept-first prose). Most projects conflate these; mature projects surface the separation in their navigation.

### Quadrant placement of every doc

```
TUTORIAL — learning by doing            HOW-TO — goal-oriented recipes
├── docs/GET_STARTED.md                 ├── docs/RELEASING.md
├── docs/FIRST_CONTRIBUTION.md          ├── docs/ADD_CONTENT.md
└── docs/generals/README.md             ├── docs/HACK_A_SPRINT_2026_OPS.md
                                        ├── docs/CONTRIBUTOR_MERGE_CREDIT_BACKFILL.md
                                        ├── docs/VERCEL.md
                                        ├── docs/SECURITY_OPERATIONS.md
                                        ├── docs/REVIEW_ACTION_PLAN.md
                                        ├── .github/CONTRIBUTING.md
                                        ├── .github/README_GIT.md
                                        └── .github/MAINTAINER_APPLICATION_TEMPLATE.md

REFERENCE — exhaustive facts            EXPLANATION — concept-first prose
├── docs/API.md                         ├── docs/adr/0001..0006-*.md (6 files)
├── docs/DEVELOPMENT.md (partial)       ├── docs/security-incident-2026-04-11.md
├── docs/SUPPLY_CHAIN.md (partial)      ├── docs/OPENSOURCE_REVIEW.md
├── docs/USER_GUIDE.md                  ├── docs/DOCUMENTATION_REVIEW.md (this file)
├── docs/SUBMISSION_BRANCHES.md         ├── docs/generals/LORE.md
├── docs/BRANCH_PROTECTION.md           ├── .github/GOVERNANCE.md
├── docs/generals/{UNITS,SPELLS,...}    └── .github/DCO.md
├── CHANGELOG.md                        
├── MAINTAINERS.md                      MISSING — explanation quadrant gap
├── .github/{SECURITY,CODE_OF_CONDUCT,  └── docs/ARCHITECTURE.md
│   SUPPORT,TRADEMARK,ACCESSIBILITY,
│   DESIGN}.md
└── README.md (partial — also Tutorial)
```

### Conflations (anti-pattern: one doc covering two quadrants without internal separation)

| Doc | Mixes | Fix |
|---|---|---|
| `README.md` | Tutorial (Quick Start) + Reference (API + roadmap + maintainers) + How-to (Docker run) | OK — README is universally a hub; this conflation is expected. No action. |
| `docs/DEVELOPMENT.md` | Reference (npm scripts table, env vars) + How-to (setup walkthrough, troubleshooting) | Add an explicit table-of-contents at the top splitting "Setup walkthrough" (How-to) from "Reference (scripts, env, ports)". |
| `docs/SUPPLY_CHAIN.md` | Reference (workflows table) + Explanation (rationale for each automation) | OK — pattern is "table + rationale per row". No action. |
| `docs/VERCEL.md` | Explanation (why-PRs-don't-deploy) + How-to (operator checklist) | OK — short doc, conflation is natural. No action. |
| `docs/generals/ARMAGEDDON.md` | Reference (seal mechanics) + Explanation (design philosophy) | OK — design-doc pattern. |

### Quadrant-vs-quadrant gaps

- **Tutorial quadrant is thin** — only 3 docs. Compare to [Astro's tutorial series](https://docs.astro.build/en/tutorial/0-introduction/) (12-part build-your-first-blog walkthrough). A platform with 9 subsystems warrants ≥1 tutorial per major subsystem (e.g., "build your first community-feature project end-to-end") not just per-role onboarding.
- **Explanation quadrant lacks `ARCHITECTURE.md`** — 6 ADRs cover individual decisions but no synthesis. Exemplar: [supabase/supabase/ARCHITECTURE.md](https://github.com/supabase/supabase/blob/master/ARCHITECTURE.md) — single page, subsystem map, data flow, deployment topology. **P0 doc gap.**
- **Reference quadrant strong but uneven** — `API.md` is current and dense; `docs/generals/*` is exemplary; `DEVELOPMENT.md` mixes reference + how-to.

---

## Per-file findings — top 12 docs

### 1. `README.md` 🟢 strong, one gap

**Strengths:** Hero, badges (CI / Codecov / Scorecard / PRs / Discord / Luma / Node / License), role-based "Who is this for", mermaid architecture diagram, claim-an-issue table (#78–#83), roadmap section, maintainer roster.

**Benchmark comparison:** [shadcn-ui/ui's README](https://github.com/shadcn-ui/ui) leads with a single hero image preview of the actual UI. [Astro's README](https://github.com/withastro/astro) opens with a screenshot grid of the framework's output. Ours is text-heavy — the mermaid diagram is good but it's the *only* visual.

**Specific improvements:**
1. Add 2-3 platform screenshots (homepage hero, `/game` board, `/events` listing) under the "What is Cursor Boston?" section. Show, don't tell.
2. The CHANGELOG references a `v0.1.0` tag (2026-01-27); `git tag` shows 0 tags. Either push the tag (per [OPENSOURCE_REVIEW.md P1-12](OPENSOURCE_REVIEW.md#prioritized-backlog)) or remove the CHANGELOG reference. README badges referencing a "Release" badge would be a tell-tale signal that releases exist.
3. The "Where does my PR go?" line is excellent. Promote it from a blockquote to a dedicated section heading.

### 2. `.github/CONTRIBUTING.md` 🟢 strong, organization gap

**Strengths:** 572 lines covering fork workflow, branch model, DCO, submission branches, code style, AI-tool acceptable-use, auto-generated contributor table.

**Benchmark comparison:** [withastro/astro/CONTRIBUTING.md](https://github.com/withastro/astro/blob/main/CONTRIBUTING.md) leads with a 5-step "Get started in 5 minutes" funnel before any policy. Astro deliberately separates *first-time contributor onboarding* from *contributor handbook* — the same content split, but the funnel earns engagement before the policy does.

**Specific improvements:**
1. Add a 5-step "Your first PR in 5 minutes" funnel at the very top (above the table of contents) — link to GitHub forking, `npm install`, `cp .env.local.demo .env.local`, edit-a-file, open-a-PR. The full policy stays below.
2. Cross-link `docs/generals/README.md` as **the model contributor-facing surface to imitate** for any new feature project. The May review called this surface "the highest-quality contributor onboarding in the repo"; CONTRIBUTING.md should say so.
3. The DCO + commit-message section should link to `.github/DCO.md` once (the policy doc) and then never re-explain DCO. Reduces duplication.

### 3. `.github/GOVERNANCE.md` 🟡 strong, missing maintainer ladder

**Strengths:** 207 lines. Four roles defined. Self-aware re: single-maintainer mode. Explicit conflict resolution + voting rules.

**Benchmark comparison:** [kubernetes/community/governance.md](https://github.com/kubernetes/community/blob/master/governance.md) defines a formal contributor ladder: Member → Reviewer → Approver → Subproject Owner → Top-Level Owner, with promotion criteria for each tier (number of PRs reviewed, time active, sponsor required). [Rust governance](https://github.com/rust-lang/rfcs/blob/master/text/1068-rust-governance.md) has a similar formalism. Our governance defines roles but not the *path between them*.

**Specific improvements:**
1. Add a "Contributor ladder" section: Contributor → Reviewer → Maintainer → Project Lead, with explicit promotion criteria for each transition. Use Kubernetes's "Member → Reviewer" criteria as the template (multiple sponsors, sustained contribution period, area focus).
2. Document succession plan more concretely. The current GOVERNANCE.md addresses "single-maintainer mode" — extend to "what happens if the Project Lead steps down" (org transfer, secret rotation, Discord ownership, GitHub Sponsorship redirect).
3. Cross-link to `MAINTAINERS.md` from the top as the canonical list (currently buried).

### 4. `.github/CODE_OF_CONDUCT.md` 🟡 functional, version is dated

**Verdict:** Contributor Covenant 2.1 verbatim. Functional and current-enough.

**Benchmark comparison:** [Contributor Covenant 3.0](https://www.contributor-covenant.org/version/3/0/code_of_conduct/) was published in 2025 — slightly clearer language around enforcement consequences and the "we as members, contributors, and leaders" pledge has been refined. Non-breaking upgrade.

**Specific improvement:** swap to Covenant 3.0 verbatim. ~10-minute change.

### 5. `.github/SECURITY.md` 🟢 exemplary, no action

Multi-channel disclosure (GitHub private advisories + security@cursorboston.com + hello@ fallback), 48h SLA, well-known/security.txt cross-link. Better than most pre-1.0 projects. [OpenSSF's security policy guide](https://github.com/ossf/oss-vulnerability-guide/blob/main/maintainer-guide.md) checks every box this doc covers.

**No action.**

### 6. `MAINTAINERS.md` 🟢 strong

Four humans, per-area primaries, Community Maintainer track explanation. CODEOWNERS path-scoped to match. Better than what the May review found (a stub pointer file).

**Improvements:**
1. Add a "Maintainer emeritus" section now (empty), so when someone steps down there's a clear and honorable place for them. Kubernetes calls this "Emeritus members".
2. Add the date of each maintainer's most recent merge or review — a freshness signal contributors can use to gauge who's actively merging.

### 7. `docs/README.md` 🟢 strong, single biggest leverage point

Defines the documentation reading order in a single 8-row table. This is the single most important doc-of-docs in the repo: every new contributor's first 60 seconds.

**Improvements:**
1. Add a Diátaxis legend ("📚 Tutorial / 🛠️ How-to / 📖 Reference / 🧠 Explanation") next to each entry, so newcomers learn the framework while they navigate.
2. Add a "💡 New here?" callout at the very top linking `GET_STARTED.md` — Astro/Stripe both lead docs with a single dominant CTA for first-time visitors.

### 8. `docs/GET_STARTED.md` 🟢 distinctive

Plain-language, AI-tools-first onboarding. No experience required. The framing is unusual in OSS docs and is a deliberate strength.

**Improvement:** add a "What you'll build" section at the very top (Astro's tutorial pattern) — concrete outcome the reader can picture before they start.

### 9. `docs/DEVELOPMENT.md` 🟡 strong content, structural improvement

20K. Setup, scripts, hooks, Firebase emulator, local testing.

**Benchmark comparison:** [supabase/supabase/DEVELOPERS.md](https://github.com/supabase/supabase/blob/master/DEVELOPERS.md) opens with a 30-second "What you need" list, then a 5-minute setup, then the reference material. Three-tier funnel.

**Improvements:**
1. Add a top-of-page table of contents grouping the 20K into "Setup (first 5 min)", "Daily commands", "Troubleshooting", "Reference (env vars, scripts)".
2. Add a "Where errors go" section once observability lands (see [OPENSOURCE_REVIEW.md P0-5](OPENSOURCE_REVIEW.md#prioritized-backlog)).

### 10. `docs/API.md` 🟢 high quality, unverified provenance

28K, 178 paths. README says "auto-generated from `lib/api-schemas/`"; the doc itself doesn't say so.

**Improvements:**
1. Add a header at the top: "This file is generated by `npm run generate:openapi-docs` (or equivalent). To regenerate, run X. Source of truth is `lib/api-schemas/`."
2. If it's *not* auto-generated at this scale, that's a high-drift risk for 178 paths — flag for the action plan.

### 11. `docs/adr/` 🟡 strong format, stale + thin

6 ADRs, last touched 2026-04-13. Nygard format. Index page is current.

**Gap:** No ADR-0007+ despite substantial decisions shipped since: PR Studio workflow (4ec3a17, eee3525, 5819b76), zero-turn gameplay layer (#975, 7 commits), account-deletion implementation model, second-maintainer onboarding (2026-05-13), Heroes v2 (#963), Armageddon end-game (#952). At least 3 of these are ADR-worthy.

**Improvements:**
1. Backfill ADR-0007 (account deletion model — hard-delete with 30-day soft-delete grace, per REVIEW_ACTION_PLAN.md §2.2).
2. Backfill ADR-0008 (second-maintainer onboarding model + Community Maintainer track).
3. Decide: Nygard or [MADR](https://adr.github.io/madr/)? MADR adds explicit "Considered Options" + tradeoff analysis; useful for controversial decisions. Nygard is fine for established choices.

### 12. `docs/generals/` 🟢 exemplary — already the model

Cited in the May review as "the highest-quality contributor onboarding I've seen in a community-platform repo." Twelve files mapping every game subsystem to the files to edit, with testing steps and rejection criteria.

**No structural improvements needed.** The next feature project (Cookbook, Pair Programming, Achievement Badges) should ship its docs in this exact pattern.

---

## Surface-area gaps — missing files

### Missing — recommend creating

| Path | Why | Exemplar |
|---|---|---|
| `docs/ARCHITECTURE.md` | Single-page synthesis: subsystem map, data flow (auth → Firestore → API → client), deployment topology. ADRs cover individual decisions; this is the synthesis. | [supabase/supabase/ARCHITECTURE.md](https://github.com/supabase/supabase/blob/master/ARCHITECTURE.md) |
| `ROADMAP.md` (root) | Currently buried in `.github/ACTIVE_ISSUES.md` which is excellent content but non-discoverable. Promote the same content to root `ROADMAP.md` and link it from README's roadmap line. | [TanStack/query roadmap](https://github.com/TanStack/query/discussions/categories/roadmap) |
| `docs/rfcs/` (folder + README) | Forward-looking proposal flow for substantial changes. ADRs are post-hoc; RFCs are upstream. | [rust-lang/rfcs](https://github.com/rust-lang/rfcs), [reactjs/rfcs](https://github.com/reactjs/rfcs) |
| `docs/STYLE_GUIDE.md` (or `.github/DOCS_STYLE_GUIDE.md`) | Bans "easy"/"just"/"simply", mandates second-person ("you/your"), defines product vocabulary (Cursor vs Cursor Boston vs the platform), code-block conventions. Without it, voice drifts. | [vercel/next.js/contributing/docs/writing-style-guide.md](https://github.com/vercel/next.js/blob/canary/contributing/docs/writing-style-guide.md) |
| `docs/GLOSSARY.md` | For a platform with 9 subsystems + game-specific vocabulary (caste, hero, seal, armageddon, prophecy, pact, rollover, NPC, etc.), a one-page glossary is the missing reference. | [k8s glossary](https://kubernetes.io/docs/reference/glossary/) |
| `.gitattributes` | Standard in mature repos for line-ending normalization, binary handling, language-detection overrides for `.md` linguist stats. | Most mature OSS repos. |
| `.all-contributorsrc` + bot integration | Recognize non-code contributions (docs, design, mentoring, organizing, talks). Current `CONTRIBUTORS.md` is git-author-only. | [All Contributors spec](https://allcontributors.org/), used in [vuejs/core](https://github.com/vuejs/core) |
| `docs/CONTRIBUTING_DOCS.md` (or section in CONTRIBUTING) | How to contribute *docs* specifically — different from how to contribute *code*. Astro splits this off explicitly. | [withastro/docs contributor guide](https://contribute.docs.astro.build/) (separate site, but the content fits in one file for our scale). |

### Issue templates — recommend rewriting as YAML forms

Current `.github/ISSUE_TEMPLATE/bug_report.md` + `feature_request.md` are markdown templates last touched 2026-01-27 (3.5 months stale). YAML forms produce more triagable bug reports via dropdowns, required fields, version selectors.

Exemplar: [vercel/next.js/.github/ISSUE_TEMPLATE/1.bug_report.yml](https://github.com/vercel/next.js/tree/canary/.github/ISSUE_TEMPLATE). 

Recommended forms:
- `1-bug-report.yml` — required: title, description, repro steps, expected/actual, Node version, browser, area dropdown (auth/community/game/mentorship/cookbook/talks/showcase/questions/profile/other).
- `2-feature-request.yml` — required: title, problem statement, proposed solution, alternatives considered, area dropdown.
- `3-game-design-proposal.yml` — for `docs/generals/`-class proposals (units, spells, heroes, balance) — required: subsystem dropdown, balance impact, narrative fit, links to relevant `docs/generals/*.md`.

### PR template — recommend small extensions

`PULL_REQUEST_TEMPLATE.md` is current and comprehensive. Two additions:

1. **Required: "Linked issue or RFC"** — surfaces the proposal flow once RFCs land.
2. **Required: "Diátaxis quadrant for docs PRs"** — for docs PRs, a checkbox for Tutorial / How-to / Reference / Explanation, with the writer asked to confirm the doc fits its quadrant.

---

## Stale-doc audit

Docs untouched >90 days as of 2026-05-18 (cutoff: 2026-02-17):

| File | Last touched | Verdict |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug_report.md` | 2026-01-27 | **Rewrite as YAML form** (see above). |
| `.github/ISSUE_TEMPLATE/feature_request.md` | 2026-01-27 | **Rewrite as YAML form.** |
| `.github/DCO.md` | 2026-01-29 | Verify-still-accurate. Policy content, low churn. Add a one-line "Last reviewed: 2026-05-18" footer. |
| `.github/TRADEMARK.md` | 2026-01-29 | Verify-still-accurate. Same footer pattern. |
| `.github/DESIGN.md` | 2026-02-18 | **Rewrite or delete.** 4K stub. If the project intends to maintain a design system, expand. Otherwise remove and point to `components/` + Tailwind config as the source of truth. |

Docs touched between 30-90 days ago (2026-02-18 to 2026-04-18) are flagged "verify-still-accurate" but not stale. The ADRs (2026-04-08 / 2026-04-13) fall here — they're policy docs, low expected churn, but warrant a "last reviewed" pass when ADR-0007+ lands.

---

## Cross-doc consistency check — where does X get defined?

Run through high-value concepts to see whether each has a single canonical definition.

| Concept | Canonical home | Drift risk |
|---|---|---|
| `develop` / `main` branching model | `.github/CONTRIBUTING.md#branching-model-develop-and-main` | Re-stated in `docs/adr/0006-develop-main-branching.md` (deliberate — ADR explains *why*). `.github/README_GIT.md` may overlap; verify. |
| Fork-only PR workflow | `.github/CONTRIBUTING.md` | ADR-0003 (deliberate). |
| Submission branch routing | `docs/SUBMISSION_BRANCHES.md` | `CLAUDE.md` re-states a maintenance procedure; deliberate per project-instructions design. |
| Maintainer roles + ladder | `.github/GOVERNANCE.md` | `MAINTAINERS.md` lists humans + areas. Currently consistent. |
| DCO sign-off requirement | `.github/DCO.md` | Restated in `CONTRIBUTING.md` and surfaced by `dco.yml` workflow. Acceptable. |
| Diátaxis-style "how to read these docs" | `docs/README.md` | Not duplicated elsewhere. |
| API endpoint reference | `docs/API.md` + live `/api/docs` swagger | If `API.md` is hand-maintained at 178 paths, drift is the major risk. |
| Game subsystem mechanics | `docs/generals/*.md` | Each subsystem has a single canonical file. Cross-references are explicit. |
| Security disclosure routing | `.github/SECURITY.md` + `public/.well-known/security.txt` | Consistent. |
| Release process | `docs/RELEASING.md` | `.github/workflows/release.yml` is the executable; doc must mirror it. |

**Notable drift risk:** the `.github/README_GIT.md` doc covers git workflow including branch protection. Reading both `CONTRIBUTING.md` and `README_GIT.md` would surface restated content. Either consolidate into CONTRIBUTING + delete `README_GIT.md`, or scope `README_GIT.md` to "git command cheat sheet" and remove the policy content.

---

## Master-class benchmark layer — what the gold standard does

For each Diátaxis quadrant, the specific thing the exemplar does that we don't.

### Tutorials → [Astro's tutorial series](https://docs.astro.build/en/tutorial/0-introduction/)

**What Astro does:** a single 12-part build-your-first-blog tutorial. Each part has "What you'll learn" + "What you'll build" + concrete success criteria + a "Check your understanding" review. The reader has a working artifact at every step.

**What we don't:** our tutorials are role-based onboarding (`GET_STARTED.md`, `FIRST_CONTRIBUTION.md`). No build-an-artifact tutorial. Recommend: a "Ship your first community feature" tutorial that walks a contributor through cloning, picking a feature project (e.g., Cookbook from issue #78), reading the feature spec, scaffolding the route, adding a Firestore collection + rules, writing the API contract, opening the PR.

### How-tos → [Stripe's API recipes](https://docs.stripe.com/payments/accept-a-payment)

**What Stripe does:** every how-to is a one-page recipe with code snippets in tabs (curl / Node / Python / Ruby), expected output blocks, "common errors" inline, and a "next steps" footer. Single goal per page.

**What we don't:** several how-tos are correct but lack the "next steps" footer (`ADD_CONTENT.md`, `RELEASING.md`). Adding a 2-line "what to do after this" pointer at the bottom of each how-to closes the funnel.

### Reference → [Next.js App Router API reference](https://nextjs.org/docs/app/api-reference)

**What Next.js does:** the reference folder structure mirrors the runtime API structure (`/app/file-conventions/`, `/components/`, `/functions/`). A reader who knows the API surface knows where to look. Each entry has rendered prop tables, version-since markers, and runnable examples.

**What we don't:** `docs/API.md` is one 28K wall of 178 paths. Compare to having `docs/api/community.md`, `docs/api/game.md`, `docs/api/auth.md` — one file per area, mirroring `lib/api-schemas/`. Recommend: split `API.md` into per-area reference files following the contract folder structure (`lib/api-schemas/community.ts` → `docs/api/community.md`).

### Explanation → [Rust's "Rustonomicon"](https://doc.rust-lang.org/nomicon/)

**What Rust does:** the Rustonomicon is a 200-page concept-first explanation of unsafe Rust, deliberately separated from the reference and tutorial. Single purpose: explain hard concepts in narrative prose.

**What we don't:** our explanation quadrant is ADRs + the security post-mortem + LORE.md. Missing: a narrative explanation of *how the platform works at the architecture level* — that's `docs/ARCHITECTURE.md`.

### ADRs → [adr.github.io / MADR](https://adr.github.io/madr/)

**What the spec defines:** MADR adds "Considered Options" + tradeoff analysis to Nygard's template. Useful for controversial decisions.

**What we don't:** ADR-0001..0006 use the Nygard format. That's fine for established decisions; the next 2-3 ADRs (account-deletion model, observability adoption, RFC process) are more contested and warrant the MADR additions.

### Issue templates → [vercel/next.js YAML forms](https://github.com/vercel/next.js/tree/canary/.github/ISSUE_TEMPLATE)

**What Next.js does:** YAML form templates with dropdowns, required fields, version selectors, area routing. Bug reports auto-include the Next.js version. Triagers spend less time asking for details.

**What we don't:** markdown templates, no required fields, no area dropdown.

### Contributor recognition → [All Contributors](https://allcontributors.org/) used in [vuejs/core](https://github.com/vuejs/core)

**What the spec defines:** non-code contributions (docs, design, talks, mentoring, organizing, translation) get recognized via emoji-coded entries. Bot manages the table.

**What we don't:** `CONTRIBUTORS.md` is git-author-only. Aaron's Community Maintainer track in particular benefits from non-code recognition — talks, organizing, contributor support are invisible to git.

---

## Recommendations

Effort estimates: **S** = a few hours, **M** = 1-3 days, **L** = a week+.

### P0 — must address (4 items)

| # | Action | File(s) | Effort | Exemplar |
|---|---|---|---|---|
| DOC-P0-1 | Write `docs/ARCHITECTURE.md` — single-page synthesis: subsystem map, data flow, deployment topology, cross-links to ADRs. | new `docs/ARCHITECTURE.md` | S | [supabase/supabase/ARCHITECTURE.md](https://github.com/supabase/supabase/blob/master/ARCHITECTURE.md) |
| DOC-P0-2 | Rewrite both issue templates as YAML forms with required fields + area dropdown. Re-author and remove the markdown originals. | `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.{md→yml}`; add `3-game-design-proposal.yml` | S | [vercel/next.js/.github/ISSUE_TEMPLATE](https://github.com/vercel/next.js/tree/canary/.github/ISSUE_TEMPLATE) |
| DOC-P0-3 | Document API.md provenance — add a "How this file is generated" header. If hand-maintained, decide whether to auto-generate (drift risk at 178 paths is high). | `docs/API.md` | S | [Next.js App Router reference](https://nextjs.org/docs/app/api-reference) |
| DOC-P0-4 | Resolve CHANGELOG / `v0.1.0` tag mismatch — CHANGELOG references a tag `git tag` doesn't show. Either push the tag (see [OPENSOURCE_REVIEW.md P1-12](OPENSOURCE_REVIEW.md#prioritized-backlog)) or amend the CHANGELOG. Currently misleading. | `CHANGELOG.md` or `git tag v0.1.0` | S | [Tailwind CSS releases](https://github.com/tailwindlabs/tailwindcss/releases) |

### P1 — should address (10 items)

| # | Action | File(s) | Effort | Exemplar |
|---|---|---|---|---|
| DOC-P1-1 | Promote `.github/ACTIVE_ISSUES.md` to `ROADMAP.md` at root (or copy + symlink). README's roadmap section should link to it as the canonical roadmap. | new `ROADMAP.md`; update `README.md` | S | [TanStack roadmap](https://github.com/TanStack/query/discussions) |
| DOC-P1-2 | Write `docs/STYLE_GUIDE.md` — bans "easy"/"just"/"simply"; mandates second-person; defines product vocabulary (Cursor / Cursor Boston / the platform); code-block conventions; link conventions. | new `docs/STYLE_GUIDE.md` | S | [Next.js writing style guide](https://github.com/vercel/next.js/blob/canary/contributing/docs/writing-style-guide.md) |
| DOC-P1-3 | Bootstrap `docs/rfcs/` with a `0000-template.md` + `README.md` describing when to write an RFC vs ADR. RFCs are forward-looking proposals; ADRs are post-hoc records. | new `docs/rfcs/{README.md,0000-template.md}` | S | [rust-lang/rfcs](https://github.com/rust-lang/rfcs) |
| DOC-P1-4 | Restructure `docs/` into Diátaxis sub-folders: `docs/tutorials/`, `docs/how-to/`, `docs/reference/`, `docs/explanation/`. Move files in. Update `docs/README.md` to reflect new structure (keep the numbered reading order). | `docs/` reorganization | M | [Astro docs source tree](https://github.com/withastro/docs/tree/main/src/content/docs) |
| DOC-P1-5 | Add 2-3 screenshots to README (homepage, `/game`, `/events`). Store under `public/screenshots/` or `docs/assets/`. | `README.md` + image assets | S | [shadcn-ui/ui README](https://github.com/shadcn-ui/ui) |
| DOC-P1-6 | Backfill ADR-0007 (account-deletion model — hard-delete + 30-day soft-delete grace) and ADR-0008 (Community Maintainer track + multi-maintainer onboarding model). Decide Nygard or MADR for future ADRs. | `docs/adr/000{7,8}-*.md` | S | [adr.github.io/madr](https://adr.github.io/madr/) |
| DOC-P1-7 | Restructure `.github/CONTRIBUTING.md` — add "5-minute first PR" funnel at top, cross-link `docs/generals/` as the model contributor surface, deduplicate DCO content with `DCO.md`. | `.github/CONTRIBUTING.md` | S | [withastro/astro CONTRIBUTING.md](https://github.com/withastro/astro/blob/main/CONTRIBUTING.md) |
| DOC-P1-8 | Add formal maintainer ladder to `.github/GOVERNANCE.md` — Contributor → Reviewer → Maintainer → Project Lead, with explicit promotion criteria for each transition. | `.github/GOVERNANCE.md` | S | [kubernetes/community governance.md](https://github.com/kubernetes/community/blob/master/governance.md) |
| DOC-P1-9 | Add Diátaxis legend to `docs/README.md` — emoji or marker beside each entry indicating quadrant. Teaches the framework as the reader navigates. | `docs/README.md` | S | [diataxis.fr](https://diataxis.fr/) |
| DOC-P1-10 | Upgrade `CODE_OF_CONDUCT.md` to Contributor Covenant 3.0. | `.github/CODE_OF_CONDUCT.md` | S | [Contributor Covenant 3.0](https://www.contributor-covenant.org/version/3/0/code_of_conduct/) |

### P2 — nice to have (8 items)

| # | Action | File(s) | Exemplar |
|---|---|---|---|
| DOC-P2-1 | Install + configure All Contributors bot. Migrate `CONTRIBUTORS.md` to All Contributors format. Recognize non-code contributions (docs, design, mentoring, talks, organizing). | `.all-contributorsrc`, `CONTRIBUTORS.md`, bot install | [All Contributors](https://allcontributors.org/) |
| DOC-P2-2 | Add `.gitattributes` for line-ending normalization + `.md` linguist override. | `.gitattributes` | Most mature OSS repos |
| DOC-P2-3 | Write `docs/GLOSSARY.md` — game terms (caste/hero/seal/armageddon/prophecy/pact), platform terms (cohort/hackathon/talk/showcase/cookbook), infra terms (DCO/CODEOWNERS/SBOM/sigstore). | new `docs/GLOSSARY.md` | [k8s glossary](https://kubernetes.io/docs/reference/glossary/) |
| DOC-P2-4 | Split `docs/API.md` into per-area files mirroring `lib/api-schemas/`: `docs/api/community.md`, `docs/api/game.md`, `docs/api/auth.md`, etc. | `docs/API.md` split | [Next.js App Router reference](https://nextjs.org/docs/app/api-reference) |
| DOC-P2-5 | Add "Maintainer emeritus" section to `MAINTAINERS.md` (empty for now) + per-maintainer last-merge date. | `MAINTAINERS.md` | [k8s community/membership.md](https://github.com/kubernetes/community/blob/master/community-membership.md) |
| DOC-P2-6 | Rewrite or delete `.github/DESIGN.md` (4K stub from 2026-02-18). If keeping, expand to design-system reference; if not, delete + cross-link Tailwind config + `components/`. | `.github/DESIGN.md` | [Tailwind UI's docs](https://tailwindcss.com/docs) |
| DOC-P2-7 | Add a "Ship your first community feature" build-an-artifact tutorial — pick a feature project (#78–#83), walk a contributor through scaffold → Firestore → API contract → tests → PR. | new `docs/tutorials/first-feature.md` | [Astro tutorial series](https://docs.astro.build/en/tutorial/0-introduction/) |
| DOC-P2-8 | Add `docs/CONTRIBUTING_DOCS.md` — how to contribute *docs* specifically (style guide pointer, Diátaxis primer, where each quadrant lives, how to preview locally). | new `docs/CONTRIBUTING_DOCS.md` | [withastro/docs contribute site](https://contribute.docs.astro.build/) |

---

## Re-run instructions

To refresh this review in 90 days:

1. Run inventory: `find . -name "*.md" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./.git/*" | sort | wc -l` — should be at or above 61 (we add docs, rarely remove).
2. Run freshness: `for f in $(find . -name "*.md" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./.git/*"); do echo "$(git log -1 --format=%cs -- $f) $f"; done | sort | head -30` — flag any doc untouched >90 days.
3. Re-check missing files: `for f in docs/ARCHITECTURE.md ROADMAP.md docs/rfcs docs/STYLE_GUIDE.md .gitattributes .all-contributorsrc; do test -e $f && echo "✓ $f" || echo "✗ $f"; done`.
4. Re-check issue templates: `ls .github/ISSUE_TEMPLATE/*.yml | wc -l` — should be ≥ 2 (bug, feature) + optional game-design.
5. Re-check ADR cadence: `ls docs/adr/*.md | grep -v README | wc -l` — should be ≥ 8 (current 6 + ADR-0007 + ADR-0008).
6. Diff the recommendations against open issues with the `documentation` label — any P0/P1 with no corresponding issue is unscheduled work.
7. Update the frontmatter `review_date`, `commit_sha`, and append a `## Changes since 2026-05-18` section before this body — preserve prior review per the same pattern as [OPENSOURCE_REVIEW.md](OPENSOURCE_REVIEW.md).

Estimated refresh cost: ~3 hours mechanical + ~3 hours synthesis = half a work day.

---

## Self-review caveat

Same as the parent OPENSOURCE_REVIEW.md: this is a self-audit. Documentation reviews especially benefit from an independent reader who has not built the platform — they spot what's *missing* from a newcomer's path that the maintainer can't unsee. Recommend re-running with an external technical-writing reviewer or one of the maintainers who joined post-launch (Brad, Neha, Aaron) before any P0/P1 verdict is treated as final.
