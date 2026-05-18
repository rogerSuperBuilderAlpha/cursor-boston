# Glossary

Terminology used across the Cursor Boston platform, codebase, and community. If a term is missing or ambiguous, open a PR. Game-specific terms cross-link to the canonical [`docs/generals/`](generals/README.md) docs.

---

## Platform

**ADR** — Architecture Decision Record. Post-hoc record of why an architectural choice was made. Live in [`docs/adr/`](adr/README.md).

**Cohort** — A time-bounded group of contributors working on weekly submissions over a multi-week program. Currently: Summer Cohort 1 (weeks 1–6), Summer Cohort 2 (weeks 1–3+). See `lib/summer-cohort.ts`.

**Community Maintainer** — A maintainer track focused on welcoming, contributor support, and external-facing surfaces rather than deep code review. Same decision-making weight as standard Maintainer. See [ADR-0008](adr/0008-community-maintainer-track.md).

**Contribution branch** — A long-lived branch that contributors PR into instead of `develop`. Used for cohort weekly submissions, event submissions, and game contributions. See [`docs/SUBMISSION_BRANCHES.md`](SUBMISSION_BRANCHES.md).

**Cookbook** — Community-curated collection of Cursor workflows, prompts, and rules. Routes at `/cookbook`.

**Cursor** — The AI-native editor product at [cursor.com](https://cursor.com). Not to be confused with **Cursor Boston**.

**Cursor Boston** — This community / this platform. Always two words, both capitalized.

**Cursor SDK** — Cursor's programmatic API used by PR Studio for agent-driven PR generation.

**DCO** — Developer Certificate of Origin. The lightweight alternative to a CLA; every commit requires a `Signed-off-by:` line. Enforced by [`.github/workflows/dco.yml`](../.github/workflows/dco.yml) and [`.github/DCO.md`](../.github/DCO.md).

**develop** — The default integration branch. Most contributions land here. Production runs from `main`. See [ADR-0006](adr/0006-develop-main-branching.md).

**Discord** — The community's primary real-time channel. Invite: [discord.gg/Wsncg8YYqc](https://discord.gg/Wsncg8YYqc).

**Feature project** — A self-contained feature ready for a contributor to claim and ship end-to-end. Listed in [`README.md`](../README.md) (issues #78–#83 as of 2026-05-18).

**Generals** — The persistent turn-based strategy game at `/game`. See [`docs/generals/`](generals/README.md).

**Hack-a-Sprint** — One of the recurring hackathon formats. Submissions land on the `hack-a-sprint-2026-submissions` branch.

**Luma** — The events platform Cursor Boston uses as the source-of-truth for upcoming events. URLs: [lu.ma/cursor-boston](https://lu.ma/cursor-boston).

**main** — The production branch. Vercel deploys only from `main`. Develop→main is gated by a local production verification per [`CLAUDE.md`](../CLAUDE.md).

**Maintainer Application Template** — The self-nomination path for becoming a maintainer. PRs land on the `maintainer-application` branch. See [`.github/MAINTAINER_APPLICATION_TEMPLATE.md`](../.github/MAINTAINER_APPLICATION_TEMPLATE.md).

**Mentorship request** — A user-to-user request to be mentored on a specific topic. Requires explicit consent before profile fields become visible. See `app/api/mentorship/request/route.ts`.

**OSS review** — The end-to-end open-source posture review. Run on a 90-day cadence. Latest: [`docs/OPENSOURCE_REVIEW.md`](OPENSOURCE_REVIEW.md) Session 2 (2026-05-18).

**Pair programming** — User-to-user matching for coding pair sessions. Similar consent model to mentorship.

**PR Studio** — AI-driven PR-generation workflow at `/pr-studio`. Uses the Cursor SDK.

**Project Lead** — The one-seat role with final decision authority when consensus can't be reached. Currently @rogerSuperBuilderAlpha. See [`.github/GOVERNANCE.md`](../.github/GOVERNANCE.md).

**PyData submissions** — Notebook submissions for the PyData × Cursor Boston hackathon. Land on the `pydata-2026-submissions` branch and in `pydata-2026-submissions/` at root.

**RFC** — Request for Comments. Forward-looking proposal for a substantial change. Lives in [`docs/rfcs/`](rfcs/README.md). Becomes an ADR after implementation.

**Showcase** — Community gallery of shipped projects at `/showcase`.

**Submission branch** — See **Contribution branch**.

**Summer Cohort** — Multi-week cohort program with weekly submission tracks (PM, comms, marketing, education, startup, OSS).

**Talks** — Community presentations submitted via `/talks`. Submission/moderation flow at `app/api/talks/`.

---

## Generals (game) terms

Quick definitions; canonical docs in [`docs/generals/`](generals/README.md).

**Armageddon** — The end-game phase triggered when 7 seals are broken. Weighted lottery determines the winner. See [`docs/generals/ARMAGEDDON.md`](generals/ARMAGEDDON.md).

**Artifact** — Single-use item with rarity tiers (common / rare / epic / legendary). See [`docs/generals/ARTIFACTS.md`](generals/ARTIFACTS.md).

**Building** — Tile-level upgrades that progress through tiers. See [`docs/generals/BUILDINGS.md`](generals/BUILDINGS.md).

**Caste** — One of 5 playable factions. Each has distinct unit/spell/hero trees. See [`docs/generals/CASTES.md`](generals/CASTES.md).

**Dispatch** — A ≤280-char taunt or note attached to an attack action. See [`docs/generals/NON_TURN_ACTIVITIES.md`](generals/NON_TURN_ACTIVITIES.md).

**Hero** — Recurring named unit with one of three classes (military / farm / magic), stamina, age, and a persistent registry. See [`docs/generals/HEROES.md`](generals/HEROES.md).

**Hero event** — A logged event (kill, spare, convert, age, level-up) on a specific hero's registry.

**Lottery** — The Armageddon end-game scoring mechanism: `tilesHeld × (1 + sealsBroken)` weighted across the season. See [`docs/generals/ARMAGEDDON.md`](generals/ARMAGEDDON.md).

**NPC** — Non-player character; AI-controlled faction. Drives weekly events via [`game-npc-weekly.yml`](../.github/workflows/game-npc-weekly.yml).

**Pact** — A public non-aggression agreement between players. Breaking a pact is automatically flagged. See [`docs/generals/NON_TURN_ACTIVITIES.md`](generals/NON_TURN_ACTIVITIES.md).

**Prophecy** — A pre-filed prediction about which seal will fall next. Resolves automatically when the prediction is verified. See [`docs/generals/NON_TURN_ACTIVITIES.md`](generals/NON_TURN_ACTIVITIES.md).

**Rollover** — The weekly state transition that processes accumulated turns and queued orders. Sunday 05:00 UTC via [`game-weekly-rollover.yml`](../.github/workflows/game-weekly-rollover.yml).

**Seal** — One of 7 mystical barriers broken by `armageddon` spell casts during the end-game phase.

**Stamina** — A hero's per-turn action budget; replenishes at rollover.

**Tile** — A unit of map territory. Tile-level data: holder, buildings, population.

**Title** — A derived honorific computed from a player's history (e.g., "Tile Baron", "Sealbreaker", "Hero Commander"). See [`docs/generals/NON_TURN_ACTIVITIES.md`](generals/NON_TURN_ACTIVITIES.md).

**Turn** — A single action unit per player per game week. Mechanics vary by caste/class.

**Unit** — A military, siege, or air entity that can move and fight. Per-caste; see [`docs/generals/UNITS.md`](generals/UNITS.md).

**Zero-turn layer** — Player actions that don't consume a turn (orders queue, dispatches, reactions, prophecies). Shipped May 2026 (#975).

---

## Infrastructure / OSS terms

**CHAOSS** — Community Health Analytics for Open Source Software. Framework for measuring OSS community health. [chaoss.community](https://chaoss.community/).

**CODEOWNERS** — GitHub feature that auto-requests reviews from named owners when a path is touched. See [`.github/CODEOWNERS`](../.github/CODEOWNERS).

**Conventional Commits** — Commit-message format that enables auto-generated changelogs. Enforced by `commitlint.config.js`.

**Diátaxis** — The documentation framework dividing docs into Tutorials / How-to / Reference / Explanation. See [diataxis.fr](https://diataxis.fr/) and [`docs/STYLE_GUIDE.md`](STYLE_GUIDE.md).

**Firestore rules** — Server-side authorization rules for Firestore reads/writes. Source: `config/firebase/firestore.rules`. Deployed automatically on push to `main` per [`CLAUDE.md`](../CLAUDE.md).

**MADR** — Markdown Architecture Decision Records. An ADR template with explicit "Considered Options" section. [adr.github.io/madr](https://adr.github.io/madr/). Our ADR-0001..0006 use Nygard; ADR-0007+ may adopt MADR.

**OpenSSF Best Practices Badge** — The OpenSSF criteria for OSS project maturity. Passing / Silver / Gold tiers. [bestpractices.dev](https://www.bestpractices.dev/).

**OpenSSF Scorecard** — Automated OSS-security scorecard. Runs weekly via [`scorecards.yml`](../.github/workflows/scorecards.yml). Current score: 7.1 (2026-05-18).

**Sigstore** — Keyless signing for release artifacts. Used in `.github/workflows/release.yml` to sign the SBOM.

**SBOM** — Software Bill of Materials. Generated as CycloneDX JSON during release.

**SLSA** — Supply-chain Levels for Software Artifacts. Provenance-attestation framework. [slsa.dev](https://slsa.dev/).

**SPDX** — Software Package Data Exchange. The license-identifier standard. We use `SPDX-License-Identifier: GPL-3.0-only` in source headers.

**REUSE** — The compliance spec for marking every file with an SPDX identifier. [reuse.software/spec-3.3](https://reuse.software/spec-3.3/). Roll-out planned in Phase 5.5.4 of [REVIEW_ACTION_PLAN.md](REVIEW_ACTION_PLAN.md).

**Upstash** — The Redis-as-a-service provider used for rate limiting. See `lib/upstash-rate-limit.ts`.

**Vercel** — The hosting provider for production. PRs do NOT deploy to Vercel per [`docs/VERCEL.md`](VERCEL.md).

---

_If a term is missing, please add it. Glossary entries should be 1-3 sentences with a cross-link to the canonical doc._

_Last reviewed: 2026-05-18._
