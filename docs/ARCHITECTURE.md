# Architecture

> Single-page synthesis of how Cursor Boston is built. ADRs in [`docs/adr/`](adr/README.md) record *why* individual decisions were made; this doc explains *how* the pieces fit together. Read after [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) if you want to ship a substantial change.

## One-sentence summary

A Next.js 16 App Router web app deployed to Vercel, backed by Firebase (Auth, Firestore, Storage), with Upstash Redis for rate limiting and a handful of OAuth integrations (Discord, GitHub) plus event/email/maps providers — every API route is contract-validated, every release is Sigstore-signed, every PR is DCO-required.

## System diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │  Next.js 16 App Router  (React + Tailwind + Framer Motion)│      │
│  │  Firebase Web SDK (Auth client)                           │      │
│  └─────────────────┬────────────────────────┬────────────────┘      │
└────────────────────┼────────────────────────┼───────────────────────┘
                     │                        │
                     │ HTTPS                  │ Firebase Auth ID token
                     ▼                        │
┌────────────────────────────────────────────┼───────────────────────┐
│  Vercel (production = `main` only)         │                       │
│  ┌─────────────────────────────────────────┼───────────────────┐   │
│  │  Pages & layouts (RSC + client)         │                   │   │
│  │  178 API routes / 214 operations / 32 ──┼──┐                │   │
│  │     areas under `app/api/`              │  │                │   │
│  │  Middleware (CSRF + rate-limit          │  │                │   │
│  │     dispatch + structured logging)      │  │                │   │
│  │  instrumentation.ts (planned: Sentry)   │  │                │   │
│  └─────────────────────────────────────────┘  │                │   │
└──────────────────────────────────────────────┼────────────────────┘
                                                │
        ┌───────────────────────────────────────┼───────────────────┐
        │                                       │                   │
        ▼                                       ▼                   ▼
┌────────────────┐    ┌──────────────────────────────┐    ┌────────────────┐
│  Firebase      │    │  Upstash Redis               │    │  External      │
│  • Firestore   │    │  • Per-endpoint rate limit   │    │  • Mailgun     │
│    (~40 cols)  │    │  • Sliding window + token    │    │  • Discord OAuth│
│  • Auth        │    │     bucket per route         │    │  • GitHub OAuth│
│  • Storage     │    │  • Falls back to in-memory   │    │  • Luma events │
│  • Rules +     │    │     when REDIS unreachable   │    │  • CARTO/Leaflet│
│    36 indexes  │    └──────────────────────────────┘    │  • Cursor SDK  │
└────────────────┘                                        └────────────────┘
```

The mermaid version in [`README.md`](../README.md#-architecture) is the contributor-facing view; the ASCII above is the detailed one. Keep both in sync when topology changes.

## Subsystems

Each subsystem is a self-contained slice with its own routes, API surface, Firestore collections, and (often) contributor doc. The codebase is intentionally NOT a monorepo — everything lives in one tree with clear vertical seams.

| # | Subsystem | Routes | API surface | Contributor doc |
|---|---|---|---|---|
| 1 | **Auth & profile** | `/(auth)/*`, `/profile` | `app/api/auth/*`, `app/api/profile/*`, `app/api/account/*` | [DEVELOPMENT.md § Auth](DEVELOPMENT.md) |
| 2 | **Events & RSVP** | `/events/*` | `app/api/events/*` | Luma is the source of truth for upcoming events; we mirror state. |
| 3 | **Hackathons** | `/hackathons/*`, `/events/cursor-boston-pydata-2026` | `app/api/hackathons/*`, `app/api/talks/submission/*` | [HACK_A_SPRINT_2026_OPS.md](HACK_A_SPRINT_2026_OPS.md), `pydata-2026-submissions/README.md` |
| 4 | **Summer Cohort** | `/summer-cohort/*` | `app/api/summer-cohort/*` | `lib/summer-cohort.ts` is the canonical week/track config |
| 5 | **Community** (posts, replies, reactions, moderation) | `/community/*` | `app/api/community/*` (post, reply, reaction, repost, delete, report, block) | [DEVELOPMENT.md § Community](DEVELOPMENT.md) |
| 6 | **Mentorship & pair programming** | `/mentorship`, `/pair` | `app/api/mentorship/*`, `app/api/pair/*` | Both require explicit consent before profile fields become visible. |
| 7 | **Talks / Showcase / Questions / Cookbook** | `/talks`, `/showcase`, `/questions`, `/cookbook` | `app/api/talks/*`, `app/api/showcase/*`, `app/api/questions/*`, `app/api/cookbook/*` | Voting-driven discovery surfaces. |
| 8 | **Generals (game)** | `/game/*` | `app/api/game/*` | [`docs/generals/README.md`](generals/README.md) — exemplary contributor surface. |
| 9 | **PR Studio** | `/pr-studio` | `app/api/cursor/*`, `app/api/pr-studio/*` | Cursor-SDK-driven PR generation flow. |
| 10 | **Admin & moderation** | `/admin/*` | `app/api/admin/*` (gated by Firebase custom claims) | Moderation queue for community reports + talk submissions. |
| 11 | **Notifications** | (in-product + email) | `app/api/notifications/*` | HMAC-signed unsubscribe tokens. |
| 12 | **Public analytics** | `/analytics` | `app/api/analytics/summary` | Cached aggregate snapshot only. No per-user analytics surface. |

## Request lifecycle

1. Browser issues an HTTPS request to `cursorboston.com/...`. Static and RSC routes are served directly; client-side routes hydrate from the bundle.
2. **API routes** (`app/api/*/route.ts`) accept the request:
   - Middleware (`lib/middleware.ts`) runs CSRF check, rate-limit dispatch, and structured logging.
   - The handler imports the matching contract from `lib/api-schemas/<area>.ts` and validates the input via `contract.<route>.body.safeParse(...)`.
   - **CI gate**: `npm run check:route-contracts` blocks any new API route that doesn't import a contract — drift between `docs/API.md` / `public/openapi.json` and runtime behavior is impossible by construction.
3. **Firestore** read/write goes through the Firebase Admin SDK, gated by `firestore.rules` (~40 collection blocks, 433 lines, deployed automatically on push to `main` — see [CLAUDE.md](../CLAUDE.md)).
4. **Auth**: every authenticated route verifies the Firebase ID token (`Authorization: Bearer …`) and resolves to a `uid`. Session cookies are also accepted for browser flows.
5. **Rate limiting**: Upstash Redis is the primary store; if unreachable, requests fall back to an in-memory limiter (see [ADR-0005](adr/0005-in-memory-rate-limiting.md)).
6. **Errors**: caught by `app/error.tsx`, `app/global-error.tsx`, and `components/ErrorBoundary.tsx`. Production observability (Sentry) is **planned but not shipped** — see [OPENSOURCE_REVIEW.md P0-5](OPENSOURCE_REVIEW.md#dim-6--testing-reliability--observability).

## Data flow patterns

### Read flow (e.g., community feed)

```
Client → Next.js API route → Firestore (with auth-gated rules)
                            → cached aggregate (if applicable)
                            → response with ETag for client-side caching
```

### Write flow (e.g., posting a community message)

```
Client (with auth token) → Next.js API route
                          → contract.safeParse(body)
                          → rate-limit check (Upstash)
                          → Firestore write (with rules check)
                          → notification dispatch (Mailgun + Discord webhook, if applicable)
                          → response
```

### Multi-step flow (e.g., account deletion)

```
Client → DELETE /api/account (with re-auth confirmation)
       → Firestore: soft-delete (set deletedAt) across ~40 user-keyed collections in a batched transaction
       → Firebase Auth: schedule user record for deletion after 30-day grace
       → notification: confirmation email via Mailgun
       (30 days later)
       → daily purge job → Firestore: hard delete + Firebase Auth user delete
```

Decision: hard-delete after 30-day soft-delete grace. Rationale: legal-cleanest, preserves abuse-investigation window. Recorded in [ADR-0007](adr/0007-account-deletion-model.md).

## Deployment topology

| Surface | Provider | Trigger | Notes |
|---|---|---|---|
| Web (cursorboston.com) | Vercel | Push to `main` only (NOT PRs — see [VERCEL.md](VERCEL.md)) | Production-only deploys; preview deploys are deliberately disabled. |
| Firestore rules + indexes | GitHub Action → Firebase | Push to `main` if `config/firebase/*` changed | [CLAUDE.md](../CLAUDE.md) — known issue with service account perms as of May 2026. |
| Container image | GitHub Actions (CI) | Build on `main`; `push: false` | Not published to a registry yet. |
| Releases (GitHub) | GitHub Actions | Push of `v*.*.*` tag | Sigstore-keyless-signed SBOM (CycloneDX) attached. Pipeline built; no release cut yet (P1-12). |

## Key external services

- **Firebase** — primary data plane. Firestore for documents, Auth for identity, Storage for uploads.
- **Vercel** — hosting + edge network. Production-only.
- **Upstash Redis** — rate limiting (~31 endpoints), durable counters.
- **Mailgun** — transactional email (notifications, unsubscribe, password reset).
- **Discord** — OAuth + webhook notifications. The community's real-time channel.
- **GitHub** — OAuth + webhooks (for repo events relevant to contributor recognition).
- **Luma** — events. We mirror upcoming events; Luma is the source of truth.
- **CARTO + Leaflet** — map tiles for the event map.
- **Cursor SDK** — used by PR Studio for AI-driven PR generation.
- **Anthropic API** — used by the LLM judge for hackathon scoring (see `scripts/score-pydata-submission.ts`).

## Boundaries we honor

These are explicit constraints the architecture enforces; violating them is a code-review block.

1. **API contracts before routes.** New API routes must define a contract in `lib/api-schemas/<area>.ts` first. CI enforces it (`npm run check:route-contracts`).
2. **Firestore writes go through rules.** Server-side admin code uses the Admin SDK; the rules still encode the model so the same logic protects browser-initiated writes.
3. **Rate-limit by default.** Any new write endpoint should pull in `lib/upstash-rate-limit.ts`. The May 2026 review found ~31 endpoints with rate limiting and a handful without — expanding this is open work (P1-7).
4. **Consent before profile-exposing actions.** Mentorship requests, pair-programming matches, and similar features require an explicit consent boolean in the request body. Don't add a profile-exposing endpoint without one.
5. **GPLv3 license headers on source files.** Husky pre-commit injects them. The REUSE.toml + SPDX-License-Identifier roll-out is planned (Phase 5.5.4).
6. **DCO sign-off on every commit.** Husky commit-msg hook + the `dco.yml` workflow enforce.

## When to add a new subsystem vs extend an existing one

**Extend an existing subsystem** when:
- The feature is a variation on an existing flow (e.g., adding a new reaction type to community).
- It shares a Firestore collection with existing data.
- It reuses the same auth + rate-limit pattern as a neighbor.

**Add a new subsystem** when:
- The feature has its own user-facing route tree (`/foo/*`).
- It introduces ≥ 1 new Firestore collection with its own rules block.
- It has independent contributor onboarding (i.e., a future contributor could ship a PR against it without reading the rest of the platform — like [`docs/generals/`](generals/README.md) does for the game).

New subsystems should ship with: an ADR describing the choice, a contributor doc under `docs/`, a contract folder in `lib/api-schemas/`, rules tests in `__tests__/config/firebase/`, and at least one e2e smoke spec.

## Performance posture

- **Bundle size**: CI enforces a 500KB-per-chunk budget on JS (see `.github/workflows/ci.yml` § bundle-budget). Going over fails the build.
- **Server response targets**: P95 < 500ms for all API routes; not yet measured (observability gap, P0-5).
- **Firestore index policy**: 36 composite indexes across 17+ collections. Add via `config/firebase/firestore.indexes.json`; auto-deployed on push to `main`.
- **Caching**: ETag-based on most public read routes; full-aggregate snapshots for the analytics surface.

## Security posture

Summary; full detail in [SECURITY.md](../.github/SECURITY.md) + [SUPPLY_CHAIN.md](SUPPLY_CHAIN.md) + [SECURITY_OPERATIONS.md](SECURITY_OPERATIONS.md).

- DCO sign-off enforced on every commit.
- Sigstore-keyless signing on release artifacts (pipeline wired; no release cut yet).
- OpenSSF Scorecard runs weekly.
- Dependabot, dependency-review, gitleaks (incl. credit/referral rules from the April 2026 incident), npm-audit gate.
- License allow-list enforcement in CI.
- Firestore rules tested in CI on every PR.

## Observability — current state

**Honest assessment:** the platform has no production error tracking, APM, or structured logging. Errors are caught by the React error boundaries but not aggregated anywhere. Sentry adoption is the single highest-leverage open item in the OSS review backlog ([P0-5](OPENSOURCE_REVIEW.md#prioritized-backlog)). Until that ships, runtime issues are visible only when a user reports them. The runbook for adoption is in [REVIEW_ACTION_PLAN.md §5.2.1](REVIEW_ACTION_PLAN.md).

## Frontend conventions

- **App Router only.** No `pages/` directory.
- **RSC by default, `'use client'` only when needed.** Currently ~232 client components in `app/` + `components/` (62% of the tsx tree). A future sweep can lower this; not a regression.
- **Tailwind for styling.** No CSS-in-JS, no scoped CSS modules. Tokens in `tailwind.config.ts`.
- **Framer Motion for animations.** Used sparingly.
- **No design-system framework** (no Material UI, no Chakra). Primitives in `components/`; a11y is the per-component responsibility.

## Background jobs / scheduled work

- `game-npc-weekly.yml` — NPC engine Sunday 05:30 UTC.
- `game-weekly-rollover.yml` — game state rollover Sunday 05:00 UTC (incl. zero-turn order queue execution).
- `stale.yml` — auto-close stale issues Monday 06:30 UTC.
- `scorecards.yml` — OpenSSF Scorecard weekly + on push to `main`.
- `update-contributors.yml` — auto-update `CONTRIBUTORS.md` from git authorship.
- `firestore-deploy.yml` — Firestore rules + indexes auto-deploy on push to `main` when those files changed.

## Glossary

See [`GLOSSARY.md`](GLOSSARY.md) for game / platform / infrastructure terminology.

## ADRs referenced

- [ADR-0001](adr/0001-gpl3-license.md) — GPL-3.0 license choice.
- [ADR-0002](adr/0002-firebase-backend.md) — Firebase as primary backend.
- [ADR-0003](adr/0003-fork-only-workflow.md) — Fork-only PR workflow.
- [ADR-0004](adr/0004-webpack-bundler.md) — Webpack (not Turbopack).
- [ADR-0005](adr/0005-in-memory-rate-limiting.md) — In-memory rate-limit fallback.
- [ADR-0006](adr/0006-develop-main-branching.md) — `develop` / `main` branching.
- [ADR-0007](adr/0007-account-deletion-model.md) — Account deletion: hard-delete + 30-day soft-delete grace.
- [ADR-0008](adr/0008-community-maintainer-track.md) — Community Maintainer track + multi-maintainer onboarding.

_Last reviewed: 2026-05-18. Refresh this doc when a new subsystem ships or the deployment topology changes — not on a cadence._
