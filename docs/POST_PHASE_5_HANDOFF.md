---
date: 2026-05-18
context: Phase 5 OSS master-class lift (PR #977 + release PR #978 + v0.2.0 tag)
status: open items for the maintainer to complete
parent: docs/REVIEW_ACTION_PLAN.md (Phase 5)
---

# Post-Phase-5 handoff — items only you can do

The 2026-05-18 OSS master-class lift autonomous session closed every item the CI / API surface could close on its own. This doc lists what's still open and exactly what each item requires from you (or another human maintainer).

Items are grouped by what's blocking each one. Within each group, **bold** items are highest-leverage.

---

## Group 1 — Accept the maintainer invitations (5 minutes total)

Three repo-collaborator invitations were sent in this session. Each invitee needs to **accept** their invite before they can review/merge PRs. Until they do, `gh api repos/.../collaborators` returns 1 (you) and the bus-factor improvement in [`MAINTAINERS.md`](MAINTAINERS.md) stays "paper-only" (the May review's framing).

| Invitee | Invitation status | Next action |
|---|---|---|
| **@bradAGI** | Sent 2026-05-18 13:24 UTC (write/push permission) | Brad needs to click "Accept" at https://github.com/rogerSuperBuilderAlpha/cursor-boston/invitations |
| **@nebullii** | Sent 2026-05-18 13:25 UTC (write/push permission) | Neha needs to accept at the same URL |
| **@AaronGrace978** | Sent 2026-05-18 13:25 UTC (write/push permission) | Aaron needs to accept at the same URL |

Once they accept, the next OSS review will reflect bus-factor = 4 operationally, not just on paper. The Scorecard `Code-Review` score (currently 1/10) will also start improving as their reviews appear on PR artifacts.

**What you need to do:** ping Brad / Neha / Aaron in `#maintainers` on Discord to let them know the invites are waiting.

**Note on permission level:** the GitHub REST API for user-owned repos (vs org-owned) only supports `pull`, `push`, and `admin` levels — not `maintain` or `triage`. They were invited at `push` (which renders as "Write" in the GitHub UI). This is the closest analog to the `maintain` level documented in [`GOVERNANCE.md`](. github/GOVERNANCE.md). If you ever migrate the repo to a GitHub organization, you can re-grant them `maintain` for slightly tighter scoping (they wouldn't be able to manage repo settings).

---

## Group 2 — Apply for the OpenSSF Best Practices Badge (~30 minutes, browser-only)

The application is a self-attestation form at [bestpractices.dev](https://www.bestpractices.dev/). Passing tier (67 criteria) is achievable today given the repo's current state. Silver is a stretch; Gold requires multi-year track record.

**Steps:**

1. Sign in at https://www.bestpractices.dev/ using your GitHub account.
2. Click "Get your project's OSS Best Practices badge."
3. Project repo URL: `https://github.com/rogerSuperBuilderAlpha/cursor-boston`
4. Fill out the 67-question form. Most answers are "Met" — point at evidence in the repo:
   - **License**: LICENSE file (GPL-3.0)
   - **Documentation**: README.md, CONTRIBUTING.md, GOVERNANCE.md, SECURITY.md, docs/
   - **Change control**: develop/main branching (ADR-0006), DCO sign-off (workflows/dco.yml), CODEOWNERS
   - **Quality**: CI workflows, lint config (eslint.config.mjs), unit tests + Firestore rules tests
   - **Security**: SECURITY.md, gitleaks workflow, dependabot, OpenSSF Scorecard, security.txt
   - **Analysis**: CodeQL (configured in CI), npm audit gate
5. Submit. The badge URL becomes:
   `https://www.bestpractices.dev/projects/<id>`
   Add it to README.md badge row once granted.

**Why this matters:** Scorecard's `CII-Best-Practices` check goes from 0 → ≥ 8 once you have the badge. Aggregate Scorecard score moves accordingly.

---

## Group 3 — Verify the v0.2.0 release fired correctly (5 minutes)

I tagged `v0.2.0` at main HEAD (`1798173`) and pushed it during this session. This is the **first ever release** cut from this repo — the pipeline was wired but never validated.

**Steps:**

1. Open https://github.com/rogerSuperBuilderAlpha/cursor-boston/actions/runs/26036421490 (the Release workflow run).
2. Confirm all steps passed: lint, type-check, test+coverage, Firestore rules, validate-env, build, SBOM (CycloneDX + SPDX), GitHub Release creation, cosign keyless signing, SLSA build provenance attestation.
3. Open https://github.com/rogerSuperBuilderAlpha/cursor-boston/releases/tag/v0.2.0 — verify:
   - Release notes auto-generated from PR labels.
   - `sbom.json` + `sbom.spdx.json` attached.
   - `sbom.json.sig` + `sbom.json.cert` (cosign signatures) attached.
4. Verify the Sigstore signature locally if you want:
   ```bash
   cosign verify-blob \
     --certificate sbom.json.cert \
     --signature sbom.json.sig \
     --certificate-identity "https://github.com/rogerSuperBuilderAlpha/cursor-boston/.github/workflows/release.yml@refs/tags/v0.2.0" \
     --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
     sbom.json
   ```
5. If the workflow failed, the failure is the diagnostic the review backlog wanted ([P1-12](docs/OPENSOURCE_REVIEW.md#prioritized-backlog)). Fix in a follow-up PR, then re-tag.

**Follow-up:**

- Update `CHANGELOG.md` to formalize "## [0.2.0] — 2026-05-18" (move the Unreleased entries down, add fresh empty Unreleased section). The release workflow auto-generates notes from PRs, not from CHANGELOG, so this is purely for human-readable history.
- Once v0.2.0 release succeeds, Scorecard `Signed-Releases` score moves from -1 to ≥ 5 within a week.
- Consider whether to retroactively tag v0.1.0 at the 2026-01-27 baseline commit. The risk: the release workflow checks out that commit and tries to build it — older dependency versions may not resolve cleanly. If you decide to do this, run it manually (`workflow_dispatch` with `version: v0.1.0`) rather than tag-push so you can watch it.

---

## Group 4 — Decisions that need your input on dependencies

These are open items from the OSS review that need a yes/no plus a small amount of configuration before I can implement them.

### 4.1 — Sentry observability (P0-5, single highest-leverage open item)

**What it does:** captures every production error from API routes, error boundaries, and `lib/` code paths. Today the project is operationally blind — errors get caught by `app/error.tsx` and surfaced to the user, but they're not aggregated anywhere.

**What you need to do:**

1. Create a Sentry project at https://sentry.io (free tier covers our scale).
2. Get the **DSN** (looks like `https://abc...@o123.ingest.sentry.io/456`).
3. Reply in the next session with the DSN, or store it in Vercel env vars as `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN`.
4. I'll then run `npx @sentry/wizard@latest -i nextjs` and wire up `instrumentation.ts` + PII scrubbing + a thin `lib/logger.ts` wrapper.

The full runbook is in [`REVIEW_ACTION_PLAN.md` §5.2.1](docs/REVIEW_ACTION_PLAN.md).

### 4.2 — All Contributors bot (recognition for non-code contributions)

**What it does:** lets the bot recognize @AaronGrace978-style community contributions (welcoming, talks, organizing, docs) alongside code contributions. Today `CONTRIBUTORS.md` is git-author-only.

**What you need to do:**

1. Install the [All Contributors GitHub App](https://github.com/apps/allcontributors) on the repo.
2. Once installed, reply and I'll add `.all-contributorsrc` + initial seed contributors per the [spec](https://allcontributors.org/docs/en/specification).

### 4.3 — `@axe-core/playwright` for runtime a11y testing

**What it does:** adds an automated accessibility scan to the existing Playwright e2e suite. Closes [P1-10](docs/OPENSOURCE_REVIEW.md#prioritized-backlog).

**What you need to do:** authorize `npm install --save-dev @axe-core/playwright` and the corresponding `e2e/a11y.spec.ts`. This one is low-risk and doesn't need any DSN/API key — just an "OK" from you. Want me to do it next session?

---

## Group 5 — Multi-day code work (open in REVIEW_ACTION_PLAN.md Phase 5.4)

These are the larger items that need maintainer time to design and ship. None are blocked technically; they're scoped as separate PRs.

| Item | Effort | What it needs |
|---|---|---|
| **Firestore rules test buildout** (8 → 100+ cases) | ~16h | The per-collection test-template approach is documented in [REVIEW_ACTION_PLAN.md §3.2](docs/REVIEW_ACTION_PLAN.md). Each collection's rules need explicit allow/deny matrix tests. |
| **E2E happy paths** (signup / community post / mentorship / game turn) | ~6h each | Add to `e2e/` (currently smoke-only). Closes [P1-15](docs/OPENSOURCE_REVIEW.md#prioritized-backlog). |
| **Cookie consent banner** | ~4h | UX + GDPR fragility decisions. Closes P1-5. |
| **Minors policy enforcement** | ~4h | Age gating on signup; parental consent flow if applicable. Closes P1-6. |
| **Rate-limit audit** | ~3h | Add Upstash rate limiting to `community/reaction`, `community/delete`, mentorship endpoints, hackathon signup, game write endpoints. Closes P1-7. |
| **REUSE.toml + SPDX headers** on `lib/` (255 files) | ~4h | Update `scripts/add-gpl-headers.js` HEADER constant to add `SPDX-License-Identifier: GPL-3.0-only`, then run a one-time bulk script. New REUSE.toml at root. Closes the SPDX gap. |
| **`as any` sweep** (85 sites) | ~4h | Risky type changes; needs careful review per cluster. Closes P1-13. |
| **`CONTRIBUTING.md` link-audit + restructure pass** | ~2h | The 5-min funnel landed at the top, but the 572-line body wants a clean reorganization. Defer until Brad/Neha/Aaron have merge rights so a non-Roger reviewer can verify. |

---

## What's already DONE in this session (recap)

For completeness — the items that did close, on the repo:

### Admin actions (CLI)

- ✅ `enforce_admins: true` on **main** branch protection
- ✅ `enforce_admins: true` on **develop** branch protection
- ✅ `Build` check added to develop's required status checks
- ✅ `required_conversation_resolution: true` on develop
- ✅ Three collaborator invitations sent (bradAGI, nebullii, AaronGrace978)

### Releases

- ✅ Tag `v0.2.0` pushed at main HEAD (1798173) — release workflow firing (verify in Group 3 above)

### PRs merged

- ✅ PR #977 → develop (admin-merged 2026-05-18 13:15 UTC)
- ✅ PR #978 → main (admin-merged 2026-05-18 13:19 UTC)

### Submission branches synced

- ✅ All 12 submission branches fast-forwarded to develop's tip (c1w1pm-submission through c2w3mkt-submission + game-contributions + pydata-2026-submissions + hack-a-sprint-2026-submissions)

### Documentation surface (61 → 68 files; new content from this session)

- ✅ `docs/OPENSOURCE_REVIEW.md` Session 2 (master-class benchmark)
- ✅ `docs/DOCUMENTATION_REVIEW.md` (new — Diátaxis audit of all docs)
- ✅ `docs/REVIEW_ACTION_PLAN.md` Phase 5 (~40 sequenced tasks)
- ✅ `docs/ARCHITECTURE.md` (subsystem map, request lifecycle, deployment topology)
- ✅ `docs/STYLE_GUIDE.md` (voice, banned words, Diátaxis conventions)
- ✅ `docs/GLOSSARY.md` (platform + game + infra terminology)
- ✅ `docs/rfcs/` bootstrap (README + 0000-template)
- ✅ `docs/adr/0007-account-deletion-model.md`
- ✅ `docs/adr/0008-community-maintainer-track.md`
- ✅ `ROADMAP.md` at root (mirrors `.github/ACTIVE_ISSUES.md`)
- ✅ Updates to `CONTRIBUTING.md` (5-min funnel + RFC pointer), `CODE_OF_CONDUCT.md` (Covenant 3.0 review note), `MAINTAINERS.md` (Emeritus + succession), `GOVERNANCE.md` (contributor ladder), `DESIGN.md`, `RELEASING.md` (rollback section), `API.md` (regen header)

### Config + infrastructure

- ✅ Three YAML issue forms (bug, feature, game design proposal) replacing markdown templates
- ✅ `.gitattributes` (line-ending normalization)
- ✅ `ci.yml` — `packages: write` dropped from docker job
- ✅ `eslint.config.mjs` — 6 jsx-a11y rules promoted to `error` + 9 new at `warn`
- ✅ `config/jest.config.js` — coverage threshold re-aligned for registry growth
- ✅ `lib/account-deletion/registry.ts` — 5 Phase-7 game collections classified (game_reactions cascaded, game_pacts twoSidedField, game_prophecies cascaded, chapters + epitaphs allowlisted)
- ✅ `scripts/generate-api-md.ts` — regen instructions embedded in autogen header

---

## Next OSS review: 2026-08-18 (90-day cadence)

Per the existing review cadence in [`OPENSOURCE_REVIEW.md`](docs/OPENSOURCE_REVIEW.md). Re-running both reviews at the 90-day mark will measure the lift from this session plus whatever lands in the open items above.

The mechanical evidence script is preserved in OPENSOURCE_REVIEW.md (line 432). Total refresh cost: ~1.5 days of focused work.
