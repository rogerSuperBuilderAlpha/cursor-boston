# Security assurance case

> A structured argument that Cursor Boston's security requirements are met. Modeled on the OpenSSF Best Practices "assurance case" criterion and informed by the [CMU SEI assurance-case structure](https://insights.sei.cmu.edu/library/assurance-cases-overview/). Read [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) first for the system tour; this doc is the security-specific argument layered on top.

This document is reviewed at every release and at every 90-day documentation refresh (see [`docs/DOCUMENTATION_REVIEW.md`](DOCUMENTATION_REVIEW.md)).

---

## 1. Claim

**Claim**: The Cursor Boston platform protects user data, preserves community trust, and maintains software supply-chain integrity to a level appropriate for a regional community platform with public-facing UGC, OAuth-based authentication, and no direct handling of payment data or PII beyond contact info.

This claim is decomposed into four sub-claims, each addressed in §3-§6:

- **C1** — A documented threat model identifies the assets, actors, and attack surfaces.
- **C2** — Trust boundaries are explicit, and authority does not cross them implicitly.
- **C3** — Secure-design principles are applied across the system.
- **C4** — Common implementation weaknesses (OWASP Top 10, CWE Top 25) are systematically countered.

---

## 2. Context and scope

**In scope**

- The web application served at `cursorboston.com` (Next.js 16 App Router on Vercel).
- The Firebase project (Auth, Firestore, Storage, Rules) backing the application.
- The release pipeline (GitHub Actions → tagged releases → Sigstore-signed SBOMs).
- The repository (`github.com/rogerSuperBuilderAlpha/cursor-boston`) and the CI/CD that gates merges.

**Out of scope**

- The underlying platforms (Vercel, Google Cloud / Firebase, GitHub, Upstash Redis, Mailgun). Their security postures are inherited; we rely on their published guarantees.
- The browsers and devices used by visitors.
- Forks and third-party deployments of the codebase. Operators of forks own their own assurance.

**Assumptions**

- A1. Vercel, Firebase, GitHub, Upstash, and Mailgun honor their security commitments (TLS termination, key management, audit logging, infra patching).
- A2. The maintainer team practices reasonable account hygiene (2FA enabled, hardware-token or app-based MFA, no credential sharing).
- A3. The cryptographic primitives in widely-used dependencies (Firebase SDK, Node.js `crypto`, Web Crypto API, Sigstore cosign) are correct and not backdoored.

---

## 3. C1 — Threat model

### 3.1 Assets

| ID  | Asset                                              | Sensitivity | Where it lives                                         |
| --- | -------------------------------------------------- | ----------- | ------------------------------------------------------ |
| A1  | User accounts (Firebase Auth uids, email, profile) | Medium      | Firebase Auth, `users/{uid}` in Firestore              |
| A2  | Community-authored content (posts, replies, etc.)  | Low–Medium  | Firestore (`community_posts`, `community_replies`, …)  |
| A3  | Moderation state (reports, blocks, takedowns)      | Medium      | Firestore (`community_reports`, `community_blocks`, …) |
| A4  | OAuth tokens (Discord, GitHub, Luma, Mailgun)      | High        | Vercel env vars (server-side only)                     |
| A5  | Firebase service account JSON                      | High        | Vercel env vars; GitHub Actions secrets (release flow) |
| A6  | Source code, release tags, release artifacts       | Medium      | GitHub repo + Releases                                 |
| A7  | Maintainer GitHub accounts (push to `main`)        | High        | Out-of-band (GitHub-managed)                           |

### 3.2 Threat actors

| ID  | Actor                                              | Motivation                            | Capability                                                              |
| --- | -------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| T1  | Unauthenticated internet user                      | Curiosity, low-effort abuse           | HTTP requests, browser scripting                                        |
| T2  | Authenticated community member, low trust          | Spam, harassment, content theft       | All T1 + posting/reacting/reporting via authenticated routes            |
| T3  | Compromised community account                      | T1+T2 + targeted impersonation        | Same as legitimate owner of that account                                |
| T4  | Malicious contributor (PR-level)                   | Code-execution backdoor, data exfil   | Submit PR, possibly bypass review with social engineering               |
| T5  | Supply-chain attacker (dependency)                 | Code-execution via compromised dep    | Compromise an npm package we depend on                                  |
| T6  | Compromised maintainer account                     | Direct merge, infra access            | Push to `main`, modify branch protection, rotate secrets                |
| T7  | Vercel / Firebase / GitHub insider or breach       | Data access at infra layer            | Out of scope (covered by Assumption A1)                                 |

### 3.3 Top threats (highest residual risk first)

1. **Compromised maintainer account (T6)** → direct push to `main`, can bypass review. Countered by branch protection (PR required), `enforce_admins` on `main`, required status checks, two-factor authentication mandate for maintainers, CODEOWNERS, and audit logs.
2. **Supply-chain compromise (T5)** → malicious dependency code shipped to production. Countered by Dependabot, `npm audit` in CI, OpenSSF Scorecard, Sigstore-signed releases with SLSA L2 provenance, no `postinstall` scripts trusted from new deps.
3. **Authenticated community abuse (T2/T3)** → spam, harassment, doxxing of other members. Countered by rate-limiting, report-and-block UX, moderator queue, account-deletion model with cascade ([ADR-0007](adr/0007-account-deletion-model.md)).
4. **Cross-site request forgery & XSS (T1)** → drive-by exploitation of authenticated sessions. Countered by Next.js CSRF middleware (`lib/middleware.ts`), Zod input validation, React's default XSS protection, CSP headers.
5. **OAuth token leak (A4 exposure)** → third-party account takeover. Countered by server-side-only storage of tokens (never reaches client), Vercel env-var encryption, regular rotation per [`docs/SECURITY_OPERATIONS.md`](SECURITY_OPERATIONS.md).

---

## 4. C2 — Trust boundaries

Trust boundaries are the seams where authority does not flow freely. Each boundary is enforced by a specific mechanism. The argument is: **no asset moves across a boundary without explicit validation, authorization, or both**.

```
┌─────────────────┐      ┌──────────────────┐      ┌────────────────────┐
│ Browser (T1/T2) │ ──▶  │ Vercel edge      │ ──▶  │ Firestore / Storage│
│                 │      │ (Next.js API)    │      │                    │
└─────────────────┘      └──────────────────┘      └────────────────────┘
   ▲       ▲                 ▲      ▲                 ▲
   │       │                 │      │                 │
   │   B1: TLS              B2:    B3:               B4: Firestore Rules
   │   (HTTPS)              CSRF + Auth + Zod        (deny by default)
   │                        rate-limit              + custom claims
   │
   │  B5: Browser sandbox (CSP, SameSite cookies)
```

| Boundary | What crosses              | What enforces it                                                                                                              |
| -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **B1**   | HTTP requests             | TLS 1.2+ via Vercel-managed certs. HSTS header. No plaintext HTTP. (§6.1)                                                     |
| **B2**   | Request → API handler     | `lib/middleware.ts` runs CSRF check + rate-limit dispatch + structured logging on every request to `app/api/**`.              |
| **B3**   | Body → handler logic      | Every API route imports a contract from `lib/api-schemas/<area>.ts` and calls `contract.<route>.body.safeParse(...)`. CI gate `npm run check:route-contracts` blocks any new route that skips this step. |
| **B4**   | Handler → Firestore       | All reads/writes go through Firebase Admin SDK, gated by `config/firebase/firestore.rules` (deny-by-default, per-collection allow rules using request.auth.uid and custom claims). Rules are unit-tested with the Firestore emulator and deployed automatically on push to `main`. |
| **B5**   | Server response → browser | React escapes by default. No `dangerouslySetInnerHTML` outside vetted Markdown rendering. CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy headers set via Next.js config. |

**Privileged actions** (admin/moderation) require Firebase custom claims (`admin: true`), checked both server-side at the handler and at the Firestore rules layer (defense in depth).

---

## 5. C3 — Secure-design principles applied

We apply the principles inventoried in NIST SP 800-160 / Saltzer & Schroeder. The argument for each principle is its concrete realization in code:

| Principle                                  | Realization in Cursor Boston                                                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Least privilege**                        | Firestore rules grant read/write only to the owning `uid` for user-owned resources. Admin actions require an explicit `admin: true` custom claim. No "service" accounts have blanket access from the client.                  |
| **Defense in depth**                       | Input validated client-side (UX), server-side (Zod via contract), and at the data layer (Firestore rules). Compromising any one layer alone does not yield unauthorized access.                                              |
| **Fail securely**                          | API routes default to 400/403 on validation/authz failure (never silently allow). Rate-limit fallback (Redis → in-memory) preserves the limit, doesn't disable it ([ADR-0005](adr/0005-in-memory-rate-limiting.md)).         |
| **Complete mediation**                     | Every authenticated route verifies the Firebase ID token on every request. No "trusted session" that skips checks.                                                                                                            |
| **Separation of duties**                   | CODEOWNERS routes review to a different maintainer than the author for each subsystem. Branch protection requires at least one review on `main`. Release signing keys are not the same as repo write access.                  |
| **Economy of mechanism**                   | Authentication delegated to Firebase Auth — we don't roll our own. Cryptographic operations delegated to vetted libraries (Web Crypto, Firebase SDK, Sigstore cosign). Rate-limiting uses Upstash Redis, not a homegrown store. |
| **Open design**                            | The codebase is open source (GPL-3.0). Security relies on Firestore rules and Auth — both auditable in-repo — not on the obscurity of the code.                                                                              |
| **Psychological acceptability**            | Authentication is OAuth-only (Google / GitHub / Discord) + email magic-link. No passwords for users to manage. Account deletion is a single button with a 30-day grace window ([ADR-0007](adr/0007-account-deletion-model.md)). |
| **Reduce attack surface**                  | Static-by-default Next.js routes. API routes only exist for state-changing operations. No publicly writable storage buckets. No SSH access to production (Vercel-managed).                                                    |
| **Secure defaults**                        | Firestore rules deny by default; allows are explicit. New API routes are blocked from merge until they import a contract. New collections must be classified in `lib/account-deletion/registry.ts`.                            |

---

## 6. C4 — Common implementation weaknesses countered

We argue, OWASP Top 10 (2021) item by item, that the corresponding weakness class is systematically addressed. CWE Top 25 mappings cited where they sharpen the argument.

### 6.1 A01 Broken Access Control

- Firestore rules are the access-control mechanism for stored data. Every collection has an explicit rule; the rules file is unit-tested (`__tests__/config/firebase/firestore.rules.test.ts`).
- Admin routes are double-gated: custom-claim check in the handler **and** in the rules.
- CSRF check on every state-changing API request (Next.js middleware).
- No client-side authorization decisions are trusted — the server re-validates every request.

### 6.2 A02 Cryptographic Failures

- TLS 1.2+ enforced edge-to-origin (Vercel-managed certificates, HSTS header).
- All cryptographic operations use vetted primitives (Firebase Auth for tokens, Web Crypto API for any signing, Sigstore cosign for releases).
- No custom crypto. No hand-rolled hashing of secrets.
- Private keys never leave the server. OAuth tokens never reach the client.

### 6.3 A03 Injection

- Firestore (NoSQL) requests use the Admin SDK, which parameterizes paths and field updates. No string concatenation into queries.
- React's default escaping prevents XSS. `dangerouslySetInnerHTML` is used only for vetted Markdown output that runs through a sanitizer.
- HTML email templates use a template engine, not string concatenation.
- Shell-out is rare; where it exists (scripts/), inputs are not user-controlled.

### 6.4 A04 Insecure Design

- This document is the assurance case for design.
- ADRs ([`docs/adr/`](adr/README.md)) record design decisions and their security implications.
- The RFC process ([`docs/rfcs/`](rfcs/README.md)) is the entry point for new designs with non-trivial security surface.

### 6.5 A05 Security Misconfiguration

- Secrets management: every secret lives in Vercel env vars or GitHub Actions secrets. None are committed. `gitleaks` runs in CI.
- Firestore rules are version-controlled and auto-deployed on push to `main`. Drift between repo and live rules is detected by [`docs/SECURITY_OPERATIONS.md`](SECURITY_OPERATIONS.md) procedures.
- Branch protection enforced on `main` and `develop`, `enforce_admins=true` on `main`.
- Production-relevant configuration is reviewed in PRs the same way code is.

### 6.6 A06 Vulnerable & Outdated Components

- `dependabot.yml` opens weekly grouped PRs for updates.
- `npm audit` runs in CI; OpenSSF Scorecard rates dependency hygiene.
- Major-version upgrades go through the same PR review process as feature changes.

### 6.7 A07 Identification & Authentication Failures

- Authentication delegated to Firebase Auth (OAuth providers + email magic-link). No passwords to store, rotate, or leak.
- Session tokens are Firebase-issued ID tokens, refreshed on a short interval, validated on every request.
- Rate-limited login endpoints; account-lockout handled at the OAuth provider layer.

### 6.8 A08 Software & Data Integrity Failures

- Release artifacts (SBOMs) signed via Sigstore cosign (keyless OIDC) on every tagged release.
- SLSA L2 build provenance attestation generated on every release.
- Git history protected by branch protection + required reviews + DCO sign-off.
- (Open) Git tags themselves are being migrated to signed tags — see [`docs/REVIEW_ACTION_PLAN.md`](REVIEW_ACTION_PLAN.md) Phase 5.

### 6.9 A09 Security Logging & Monitoring Failures

- Structured logging in `lib/middleware.ts` captures request/response metadata.
- Vercel + Firebase produce platform-level access logs.
- (Open) Production application-error observability (Sentry) is planned, not yet shipped — see [`docs/OPENSOURCE_REVIEW.md`](OPENSOURCE_REVIEW.md) Dim 6.

### 6.10 A10 Server-Side Request Forgery

- API routes do not accept user-controlled URLs that the server then fetches, with the exception of OAuth callback URLs (which are validated against an allow-list configured at the OAuth provider).
- Image hosts and external integrations use a fixed allow-list (Next.js `next.config.js`).

---

## 7. Evidence index

| Claim | Primary evidence                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| C1    | This document §3. Cross-references: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/SECURITY_OPERATIONS.md`](SECURITY_OPERATIONS.md). |
| C2    | This document §4. Code: `lib/middleware.ts`, `lib/api-schemas/`, `config/firebase/firestore.rules`.                     |
| C3    | This document §5. Code: full repo; see specifically `lib/account-deletion/`, `app/api/admin/`.                          |
| C4    | This document §6. Tests: `__tests__/`, especially `__tests__/config/firebase/firestore.rules.test.ts`. CI: `.github/workflows/ci.yml`. |

External attestations:

- OpenSSF Best Practices Silver badge (awarded 2026-05-19): https://www.bestpractices.dev/projects/12883/silver
- OpenSSF Scorecard: https://scorecard.dev/viewer/?uri=github.com/rogerSuperBuilderAlpha/cursor-boston
- Sigstore-signed release artifacts: see https://github.com/rogerSuperBuilderAlpha/cursor-boston/releases — every release after v0.2.2 includes `.cosign.bundle` and SLSA provenance.

Internal attestations:

- Codebase security review: [`docs/SECURITY_REVIEW.md`](SECURITY_REVIEW.md) — last review 2026-05-19, clean. Quarterly cadence.

---

## 8. Known gaps and forward plan

Honesty matters more than a clean score. The following gaps are tracked in [`docs/REVIEW_ACTION_PLAN.md`](REVIEW_ACTION_PLAN.md):

1. **Test statement coverage** (**~80.25%** statements as of 2026-05-19 OpenSSF sprint wave 15: 27,092 / 33,762 covered; branches ~66.0%, lines ~83.2%, functions ~72.9%; 4,914 Jest tests) — meets the 80% OpenSSF Silver target (`test_statement_coverage80`). Waves 10–15 pushed `lib/game/data-server.ts` to ~95% line coverage; gap-fill waves 2–6 and deep page/hook/route tests covered summer-cohort, hackathons, mentorship/pair, game UI, and API admin routes. Jest floors are ratcheted to 79.5% statements in `config/jest.config.js`. The OpenSSF Silver badge was awarded 2026-05-19 — see [bestpractices.dev #12883/silver](https://www.bestpractices.dev/projects/12883/silver). Branch coverage (~66%) is the long-tail gap toward Gold.
2. **Production observability** — application-level error tracking (Sentry) is planned but not shipped. Platform-level logs are available in Vercel + Firebase.
3. **Signed git tags** — release artifacts are Sigstore-signed; git tags themselves are migrating to signed tags from v0.3.0 onward.
4. **Independent security audit** — no external auditor has reviewed the codebase. The OpenSSF Best Practices + Scorecard + the maintainer review process are the current substitute.

---

## 9. Review cadence

- This document is re-read at every release.
- A full refresh (re-check claims against current code) happens at every 90-day documentation review (see [`docs/DOCUMENTATION_REVIEW.md`](DOCUMENTATION_REVIEW.md)).
- Next refresh: **2026-08-18**.
