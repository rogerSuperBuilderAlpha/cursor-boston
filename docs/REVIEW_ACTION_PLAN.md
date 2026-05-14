---
plan_date: 2026-05-06
plan_owner: rogerSuperBuilderAlpha
source_review: docs/OPENSOURCE_REVIEW.md
review_commit: a818d0e36826fe933f4fe621a0d943a79a94611f
time_horizon_weeks: 12
---

# Cursor Boston — Review Action Plan

This plan turns the [2026-Q2 OSS review](OPENSOURCE_REVIEW.md) into an executable 12-week development sequence. The review identified 6 P0 (must-address) and 18 P1 (should-address) items across 9 dimensions, with three dimensions rated **RED** (Governance, Privacy/Trust-Safety, Testing/Observability).

**Goals, in priority order:**

1. **Close every critical (P0) error** within 8 weeks.
2. **Move every dimension's RAG band forward by at least one notch** — including the GREEN ones, which get small lifts to keep pace.
3. **Validate the work** by re-running the Session 1 mechanical evidence script at the end of Phase 4 and confirming verdict changes.

**Capacity assumption:** ~10 focused maintainer-hours per week + community PRs absorbing eligible small work. Total maintainer budget ≈ 120 hours over 12 weeks. Several P1s are deliberately sized as community-PR-friendly so they can land in parallel.

---

## Approach: four phases

| Phase | Weeks | Theme | What lands |
|---|---|---|---|
| **Phase 1** | 1–2 | Quick wins + critical loop closure | All trivial-effort items across every dimension; establishes the rhythm |
| **Phase 2** | 3–6 | Privacy & observability baseline | The 3 big P0 features (error tracking, account deletion, abuse flow) |
| **Phase 3** | 7–10 | Bus factor + test depth | Onboard second maintainer; expand rules + e2e tests; a11y hardening |
| **Phase 4** | 11–12 | Polish & validate | Cut v0.1.0 release; write ARCHITECTURE.md; rerun review |

**Phase ordering rationale:** P0-5 (error tracking) and P0-6 (gitleaks rule) are cheap and unblock observability for everything that follows, so they go first even though they aren't the most visible items. The big privacy P0s (P0-3, P0-4) come next while the second-maintainer recruitment process (P0-1) runs in the background — it's hard to deadline because it depends on finding the right human, so it gets a long phase. The release validation (P1-12) comes last because everything before it should green up CI first.

---

## Phase 1 — Quick wins + critical loop closure (Week 1–2)

**Goal:** every dimension gets a small forward lift; close the trivial P0/P1s; prove the cadence.

| # | Task | Type | Effort | Dim impact |
|---|---|---|---|---|
| 1.1 | Add gitleaks rule + `.gitignore` entries for `*credit*` / `*referral*` patterns; verify with synthetic test file (P0-6) | maintainer | 1h | Sec 🔴→🟡 |
| 1.2 | Toggle `enforce_admins: true` on `main` and `develop` (P1-1) | maintainer (admin) | 5min | Sec 🟡→🟢 |
| 1.3 | Add `Build` required check on `develop`; enable `required_conversation_resolution` on `develop` (P1-2) | maintainer (admin) | 5min | Sec 🟡 |
| 1.4 | Drop unused `packages: write` from `docker` job in `ci.yml` lines 299-301 (P2-1) | community-PR-friendly | 10min | Sec 🟡 |
| 1.5 | Run `npm audit fix` for `basic-ftp` (high) + `uuid` (moderate); if blocked transitively, force-resolve via `overrides` (P1-3) | community-PR-friendly | 1h | Sec 🟡 |
| 1.6 | List humans in `MAINTAINERS.md` directly (just Roger initially; second person to be added in Phase 3 from P0-1) (P1-17) | maintainer | 30min | Gov 🔴 |
| 1.7 | Promote a11y lint rules from `warn` to `error`; add `anchor-is-valid`, `click-events-have-key-events`, `no-noninteractive-element-interactions`, `label-has-associated-control` (P1-9) | maintainer | 2h initial + 1-2h cleanup of triggered violations | A11y 🟡→🟢 |
| 1.8 | Wire `@axe-core/playwright` into existing Playwright suite as `e2e/a11y.spec.ts` covering top 5 routes (P1-10) | maintainer | 2h | A11y 🟡 |
| 1.9 | Code-Review policy enforcement decision: choose Approach A (require recorded review) or Approach B (Discord-review-period summary as PR comment); document in GOVERNANCE.md and apply to next PR (P0-2) | maintainer | 1h doc + ongoing | Gov 🔴 |
| 1.10 | Standardize the data-export response: align `app/api/profile/data/route.ts` with GDPR Article 20 JSON schema (machine-readable, structured); add a "Download my data" button to profile page (P1-8) | maintainer | 3h | Privacy 🔴 |
| 1.11 | Sweep top 20 `as any` sites in `lib/` (out of 81 total); replace with typed alternatives or document why (P1-13 partial) | community-PR-friendly | 4h | Arch 🟡 |
| 1.12 | Lift `jest.config.js` coverage thresholds to enforce minimums: lib/ ≥ 35% lines / 28% branches today, ratchet up by Phase 4. Initial commit just freezes current floor (P1-14 partial) | maintainer | 1h | Testing 🔴 |
| 1.13 | Create labels in repo (`review-2026-Q2`, `priority/p0`, `priority/p1`, `dim/*`); file the 6 P0 issues + tracking issue for P1 set | maintainer | 30min | meta |
| 1.14 | Write a 1-paragraph addition to GOVERNANCE.md documenting that the issue tracker is a maintainer planning tool and Discord/PRs are the user-engagement channels (small Dim-2 lift) | community-PR-friendly | 30min | Community 🟢 |

**Phase 1 RAG forecast:**

| Dim | Before | After Phase 1 |
|---|---|---|
| 1 Governance | 🔴 | 🔴 (still — only P0-1 moves this) |
| 2 Community | 🟢 | 🟢 |
| 3 Security | 🟡 | 🟡→🟢 likely (Scorecard rerun should reflect within 1 week) |
| 4 Privacy | 🔴 | 🔴 (data-export improvement only) |
| 5 Architecture | 🟡 | 🟡 |
| 6 Testing/Obs | 🔴 | 🔴 (no error tracking yet) |
| 7 Accessibility | 🟡 | 🟡→🟢 |
| 8 Release | 🟡 | 🟡 |
| 9 Documentation | 🟢 | 🟢 |

**Phase 1 acceptance:** Scorecard re-run shows Branch-Protection ≥ 8, Token-Permissions > 0, Vulnerabilities = 10. CI green. Two issues filed and resolved with recorded approval (validating P0-2 approach).

---

## Phase 2 — Privacy & observability baseline (Week 3–6)

**Goal:** wire production observability; land the two big trust-and-safety features the platform promises but doesn't deliver.

### 2.1 — Error tracking + structured logging (P0-5) · Week 3 · maintainer · ~8h

The single highest-leverage move in this whole plan.

**Approach:**
1. Choose Sentry (best Next.js + Vercel ergonomics; free tier covers this scale).
2. Install `@sentry/nextjs`; run `npx @sentry/wizard@latest -i nextjs` for boilerplate.
3. Wire client-side capture in `app/error.tsx`, `app/global-error.tsx`, `components/ErrorBoundary.tsx`.
4. Wire server-side capture via `instrumentation.ts` (Next 16 supports this natively).
5. Replace 19 raw `console.error` sites in `lib/` with a thin `logger` wrapper that routes to Sentry breadcrumbs in production and stays as `console.*` in dev.
6. PII scrubbing: redact emails / Firebase tokens / Firestore document bodies before send; allow doc IDs.
7. Document in `docs/DEVELOPMENT.md` § "Errors and observability" — where errors go, how to triage, how to add a new logger call site.

**Acceptance:**
- [ ] Sentry project created; DSN in env (Vercel + `.env.local.example`)
- [ ] One synthetic error from each surface (server route, client component, error boundary) appears in Sentry within 60s
- [ ] No PII in payload bodies (verify with one captured event)
- [ ] `docs/DEVELOPMENT.md` updated

### 2.2 — Account deletion with Firestore cascade (P0-3) · Week 4–5 · maintainer · ~12h

The biggest privacy fix; also the biggest engineering item in Phase 2.

**Approach:**
1. Inventory user-keyed collections from `firestore.rules` (already counted: ~40 blocks; user-owned subset is users / communityMessages / messageReactions / mentorshipRequests / mentorship_profiles / eventRegistrations / eventContacts / hackathonSubmissions / hackathonTeams / coworkingRegistrations / pair_profiles / pair_requests / cookbook_entries / showcaseSubmissions / questions / answers / agents / user_badges / certificates / cfpSubmissions / talkSubmissions / game state).
2. Decision: **hard-delete with 30-day soft-delete grace.** Add `deletedAt` field; daily job purges after 30 days. Justification: legal-cleanest, preserves abuse-investigation window.
3. New endpoint: `DELETE /api/account` (auth + re-auth confirmation token; rate-limited).
4. New service: `lib/account-deletion.ts` with `softDeleteAccount(uid)` and `purgeAccount(uid)` functions; uses Firestore batched-write transaction.
5. New scheduled GitHub Action `account-purge.yml` — daily, calls a purge endpoint with HMAC token (or run as Firebase Cloud Function if available).
6. Profile page: "Delete account" button → confirmation modal → re-auth → POST to delete endpoint → sign-out + redirect.
7. Firebase Auth: `admin.auth().deleteUser(uid)` after Firestore cascade succeeds.
8. Tests: `__tests__/lib/account-deletion.test.ts` covering each cascading collection; one e2e happy-path under `e2e/smoke/account-delete.spec.ts`.
9. Update Privacy Policy + add a "Right to delete" section linking to the profile flow.

**Acceptance:**
- [ ] DELETE /api/account requires auth + re-auth, rate-limited
- [ ] Cascade test asserts every user-keyed collection is purged
- [ ] Soft-delete window observable; purge job documented
- [ ] Privacy Policy text matches the implemented flow

### 2.3 — Abuse / report flow on community posts (P0-4) · Week 5–6 · maintainer · ~10h

**Approach:**
1. New collection `communityReports` with rules: any auth'd user can create; only admin can read / update.
2. New endpoint `POST /api/community/report { targetMessageId, reason, notes? }` — rate-limited via Upstash.
3. Optional: `POST /api/community/block { targetUid }` — user-to-user block, hides target's content from blocker (writes to `userBlocks/{ownerUid}/blocked/{targetUid}`).
4. UI: report button on each community message + reply (icon → modal); block-user link from user profile.
5. Admin moderation queue: new page `app/admin/moderation/page.tsx` — lists reports, supports dismiss / hide-message / suspend-user (status field on `users` doc).
6. Tests: rules tests for `communityReports` allow/deny matrix; e2e for happy-path report.
7. Document in CODE_OF_CONDUCT.md: how reporting escalates.

**Acceptance:**
- [ ] User can report a message; admin sees it in queue; admin can hide and the message disappears from feeds
- [ ] User can block another user; blocked user's posts hidden from blocker
- [ ] Rules tests pass for both new collections
- [ ] CoC updated

### 2.4 — Phase 2 mid-flight P1s · Week 3–6 · community-PR-friendly

In parallel with the maintainer's P0 work, these P1s are well-scoped for community contributors:

| # | Task | Effort | Dim |
|---|---|---|---|
| 2.5 | Add Upstash rate limiting to `community/reaction`, `community/delete`, `mentorship/request`, `mentorship/respond` (P1-7 part A) | 3h | Privacy |
| 2.6 | Mentor-match consent step: add a confirm-disclosure dialog before submitting `mentorship/request` (P1-4) | 2h | Privacy |
| 2.7 | Continue `as any` sweep — sites 21-50 (P1-13 part B) | 4h | Architecture |
| 2.8 | Add e2e happy-path: signup flow (P1-15 part A) | 3h | Testing |

### 2.5 — Phase 2 RAG forecast

| Dim | Before P2 | After P2 |
|---|---|---|
| 1 Governance | 🔴 | 🔴 |
| 2 Community | 🟢 | 🟢 |
| 3 Security | 🟡→🟢 | 🟢 |
| 4 Privacy | 🔴 | 🔴→🟡 (account-deletion + abuse flow + mentor consent + rate limits land) |
| 5 Architecture | 🟡 | 🟡 (50 of 81 `as any` swept) |
| 6 Testing/Obs | 🔴 | 🔴→🟡 (error tracking lands; coverage still low) |
| 7 Accessibility | 🟡→🟢 | 🟢 |
| 8 Release | 🟡 | 🟡 |
| 9 Documentation | 🟢 | 🟢 |

**Phase 2 acceptance gate:** an external user can fully delete their account; report a community post; mentor request shows a consent step; production error from any surface lands in Sentry within 60s. If any of these fail, do not start Phase 3.

---

## Phase 3 — Bus factor + test depth (Week 7–10)

**Goal:** address the structural Governance RED; expand test depth on Firestore rules; finish a11y enforcement.

### 3.1 — Onboard second maintainer (P0-1, P0-2 follow-on) · Week 7–10 · maintainer · ~6h spread

This is the highest-impact item in the entire plan but also the slowest because it depends on finding the right human.

**Approach:**
1. Identify candidates from the top non-maintainer contributors (Brad: 43 commits, Shreyas0786: 13, Rishi/Sikes/RshieRish: 9 each, nebullii: 9). Prefer someone with sustained contributions over multiple subsystems.
2. Reach out via Discord DM with the role description (drawn from GOVERNANCE.md "Maintainer Responsibilities").
3. Onboarding checklist:
   - [ ] Add as collaborator with `Maintain` (not `Admin`) permission first
   - [ ] Add to CODEOWNERS for path scopes that match their expertise
   - [ ] Update MAINTAINERS.md and GOVERNANCE.md maintainer table
   - [ ] First "real" PR they review and approve closes the Code-Review = 0 gap definitively
4. Document succession plan in GOVERNANCE.md (lines 117-125 already anticipate this; expand to cover what happens if Roger steps away — secrets rotation, GitHub org transfer, Discord ownership).

**Acceptance:**
- [ ] ≥ 1 second human with merge rights
- [ ] CODEOWNERS lists ≥ 2 humans
- [ ] MAINTAINERS.md table has ≥ 2 entries
- [ ] Next 5 PRs all merge with a recorded reviewer-approved review (Scorecard `Code-Review` rises in subsequent run)
- [ ] Succession plan documented

### 3.2 — Firestore rules tests expansion (P1-11) · Week 8–10 · community-PR-friendly · ~16h total

Currently 8 test cases for ~40 collections. Industry-typical at this scale is 100+ cases.

**Approach:**
1. Build a per-collection test-template helper in `__tests__/config/firebase/_helpers.ts` that generates the standard allow/deny matrix: { unauth read, auth read, owner read, owner write, non-owner write, malformed payload, admin override }.
2. Apply the template to one collection per PR. Order by sensitivity: users / communityMessages / mentorshipRequests / hackathonSubmissions first, then game / cookbook / agents.
3. Goal: ≥ 100 test cases by end of Phase 3, ≥ 80% per-collection coverage.

**Acceptance:**
- [ ] Per-collection helper exists and is documented in `docs/DEVELOPMENT.md`
- [ ] ≥ 100 `it(…)` cases in firestore.rules.test.ts
- [ ] CI runs the suite under 2 min wall time

### 3.3 — Coverage threshold ratchet (P1-14) · Week 8 · maintainer · ~3h

Tighten `jest.config.js` `coverageThreshold` block:

```js
coverageThreshold: {
  global: { lines: 38, branches: 30 },
  './lib/**/*.ts': { lines: 50, branches: 40 },
  './app/api/**/*.ts': { lines: 45, branches: 35 },
}
```

Anything below floors fails CI. Combined with the rules-test expansion, this becomes the forcing function for new code to land with tests.

### 3.4 — More e2e happy-paths (P1-15 parts B–D) · Week 9 · community-PR-friendly · ~6h

- Community post creation
- Mentorship request submission
- Game turn (one explore, one attack)

### 3.5 — Phase 3 mid-flight P1s

| # | Task | Effort | Dim |
|---|---|---|---|
| 3.6 | Cookie consent banner — install `react-cookie-consent` or roll a thin `<ConsentBanner />`; remember in localStorage; respect `Do-Not-Track` (P1-5) | 4h | Privacy |
| 3.7 | Minors policy — add age field to signup; gate sign-up under 13; surface a "must be 18+ to participate in hackathons with prizes" notice (P1-6) | 4h | Privacy/Safety |
| 3.8 | Finish `as any` sweep — sites 51-81 (P1-13 part C) | 4h | Architecture |
| 3.9 | Add Upstash rate limiting to hackathon signup + game endpoints (P1-7 part B) | 3h | Privacy |

### 3.6 — Phase 3 RAG forecast

| Dim | Before P3 | After P3 |
|---|---|---|
| 1 Governance | 🔴 | 🔴→🟡 (second maintainer + recorded reviews) |
| 2 Community | 🟢 | 🟢 |
| 3 Security | 🟢 | 🟢 |
| 4 Privacy | 🔴→🟡 | 🟡 |
| 5 Architecture | 🟡 | 🟡 |
| 6 Testing/Obs | 🔴→🟡 | 🟡→🟢 (rules tests + coverage thresholds + e2e expansion) |
| 7 Accessibility | 🟢 | 🟢 |
| 8 Release | 🟡 | 🟡 |
| 9 Documentation | 🟢 | 🟢 |

---

## Phase 4 — Polish & validate (Week 11–12)

**Goal:** cut the first real release; close lingering docs; rerun the review and diff bands.

### 4.1 — Cut v0.1.0 (P1-12) · Week 11 · maintainer · ~2h

Tag-driven release validates the whole pipeline (Sigstore keyless OIDC, SBOM, changelog auto-gen, GitHub Release, signature attachment).

```bash
git checkout main
git pull
git tag -a v0.1.0 -m "release: v0.1.0 — initial public release"
git push origin v0.1.0
```

Verify:
- [ ] GitHub Release created with `sbom.json`, `sbom.json.sig`, `sbom.json.cert`
- [ ] CHANGELOG.md updated with the released version
- [ ] Scorecard `Signed-Releases` score moves from -1 to ≥ 5

If anything fails, that's exactly the latent issue this step is meant to surface.

### 4.2 — Write `docs/ARCHITECTURE.md` (P1-16) · Week 11 · community-PR-friendly · ~3h

Single-page synthesis: subsystem map (events / hackathons / mentorship / community / cookbook / generals / badges), data flow (auth → Firestore → API → client), deployment topology (Vercel + Firebase + Upstash + Mailgun + Discord OAuth + GitHub OAuth + CARTO + Luma).

Reference existing ADRs for decisions; this doc is the *explanation* layer Diátaxis is missing.

### 4.3 — Document rollback in RELEASING.md (P2-5) · Week 11 · 30min

5-line addition: how to retract a release, what to do if SBOM signing fails post-tag, how to communicate.

### 4.4 — Operational follow-ups · Week 12

- File GitHub support requests for the two forks (`Pradyumna369`, `pavithralagisetty`) still carrying the April 2026 credit-codes file. Each is one form submission.
- Apply for OpenSSF / CII Best Practices badge (P2-2) — half-day form-fill that improves Scorecard.

### 4.5 — Re-run the review · Week 12 · maintainer · ~4h mechanical + ~4h synthesis

Run the Session 1 evidence script; diff every dimension verdict; update `OPENSOURCE_REVIEW.md` frontmatter (`previous_review: …`, new `commit_sha`, new `overall_rag`); append a "## Changes since 2026-Q2" section. Don't edit the prior review body — preserve the diff.

**Phase 4 RAG forecast:**

| Dim | After P4 | Notes |
|---|---|---|
| 1 Governance | 🟡 | Need 6+ months sustained second-maintainer activity to flip green |
| 2 Community | 🟢 | |
| 3 Security | 🟢 | + signed releases + CII badge |
| 4 Privacy | 🟡→🟢 (if cookie banner + minors policy land) | |
| 5 Architecture | 🟡→🟢 (`as any` < 20, ARCHITECTURE.md exists) | |
| 6 Testing/Obs | 🟢 | error tracking + coverage thresholds + 100+ rules tests |
| 7 Accessibility | 🟢 | |
| 8 Release | 🟢 | first release cut, validates pipeline |
| 9 Documentation | 🟢 | + ARCHITECTURE.md |

**Forecasted overall RAG: 🟢 GREEN with 1 yellow (Governance — depends on the second-maintainer relationship deepening over time).**

---

## Per-dimension lift summary

This is the at-a-glance answer to "what improves on each section":

- **Dim 1 Governance** — second maintainer onboarded, MAINTAINERS lists humans, succession plan documented, CODEOWNERS path-scoped, recorded reviews on every PR.
- **Dim 2 Community** — issue-tracker pattern documented; otherwise stays GREEN.
- **Dim 3 Security** — `enforce_admins` on, vulns cleared, gitleaks closes April lesson, Token-Permissions cleaned up, signed-release attestation, CII badge.
- **Dim 4 Privacy** — working account deletion, abuse-report flow, mentor consent, cookie banner, minors policy, rate limiting on writes, GDPR-shaped data export.
- **Dim 5 Architecture** — `as any` count drops from 81 → < 20, ARCHITECTURE.md added, `exhaustive-deps` disable sites audited.
- **Dim 6 Testing/Observability** — Sentry wired, structured logger replaces raw console, coverage thresholds enforced, Firestore rules tests grow from 8 → 100+, e2e covers signup + community + mentor + game.
- **Dim 7 Accessibility** — lint rules promoted to `error` with missing rules added, axe-core runs in CI on top routes.
- **Dim 8 Release** — first real release cut; rollback documented; container publishing scoped as future work explicitly.
- **Dim 9 Documentation** — ARCHITECTURE.md fills the missing explanation-layer doc.

---

## Risks & contingencies

| Risk | Mitigation |
|---|---|
| **Second-maintainer recruitment stalls** | If no candidate by end of Week 8, downgrade Phase 3 P0-1 acceptance to "named successor in GOVERNANCE.md with read access + secrets-recovery procedure documented" and proceed. The Code-Review-by-PR-comment pattern (Approach B) already mitigates the audit-trail half. |
| **Sentry free tier exceeded** | Likely OK at this volume; if not, downgrade to GlitchTip (open-source, self-hostable) on the same wire format. |
| **Account-deletion cascade misses a collection** | Generate the cascade list from `firestore.rules` programmatically rather than hand-listing; add a fail-loud test that asserts every user-keyed collection is in the cascade map. |
| **Coverage threshold blocks community PRs** | Set thresholds at *current* floor first (Phase 1.12), ratchet up only after each phase's tests land. Never gate PRs on retroactive coverage. |
| **a11y rule promotion floods CI with violations** | Phase 1.7 includes 1-2h cleanup budget. If violations exceed budget, ratchet rules in two waves: critical (alt-text, label-has-associated-control) first, others second. |
| **Release pipeline fails on first tag** | Expected and good — that's why Phase 4.1 is scheduled with buffer. Most likely failure modes: missing `id-token: write` permission (already there), OIDC subject mismatch with Sigstore (visible in workflow logs). |

---

## Tracking

- **GitHub project board** named `Review 2026-Q2`: columns "Phase 1" / "Phase 2" / "Phase 3" / "Phase 4" / "Done"; populated from the issues filed in Phase 1.13.
- **Weekly check-in (10 min, Mondays):** scan board, mark blockers, decide if any task should slip phases.
- **Phase-end gate:** verify acceptance criteria for the phase. If gate fails, slip the next phase by one week rather than carrying debt forward.
- **End of Week 12:** rerun the OSS review (Phase 4.5). Compare verdicts. Publish `docs/OPENSOURCE_REVIEW.md` updated with `## Changes since 2026-Q2`.

---

## Appendix — task-to-issue index

| Task | Source review item | Status |
|---|---|---|
| 1.1 | P0-6 | new |
| 1.2 | P1-1 | new |
| 1.3 | P1-2 | new |
| 1.4 | P2-1 | new |
| 1.5 | P1-3 | new |
| 1.6 | P1-17 (partial — full version in 3.1) | new |
| 1.7 | P1-9 | new |
| 1.8 | P1-10 | new |
| 1.9 | P0-2 | new |
| 1.10 | P1-8 | new |
| 1.11 | P1-13 part A | new |
| 1.12 | P1-14 (initial floor) | new |
| 1.13 | meta | new |
| 1.14 | (Dim-2 lift, not in original backlog) | new |
| 2.1 | P0-5 | new |
| 2.2 | P0-3 | new |
| 2.3 | P0-4 | new |
| 2.5 | P1-7 part A | new |
| 2.6 | P1-4 | new |
| 2.7 | P1-13 part B | new |
| 2.8 | P1-15 part A | new |
| 3.1 | P0-1, P0-2, P1-17, P1-18 | new |
| 3.2 | P1-11 | new |
| 3.3 | P1-14 (ratchet) | new |
| 3.4 | P1-15 parts B-D | new |
| 3.6 | P1-5 | new |
| 3.7 | P1-6 | new |
| 3.8 | P1-13 part C | new |
| 3.9 | P1-7 part B | new |
| 4.1 | P1-12 | new |
| 4.2 | P1-16 | new |
| 4.3 | P2-5 | new |
| 4.4 | (operational + P2-2) | new |
| 4.5 | (review re-run) | new |

Total tasks: 32 across 12 weeks ≈ 2.7 tasks per week — realistic at the assumed capacity.
