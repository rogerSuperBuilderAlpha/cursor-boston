# Security review

This document is the OpenSSF Best Practices Gold attestation for [criterion `security_review`](https://www.bestpractices.dev/en/criteria/2#2.security_review). It records the periodic, codebase-wide security pass performed by the maintainer team, the existing continuous security gates that run on every PR, and the re-review cadence.

The latest review covered **develop tip** at the date below; the next review is scheduled for the following quarterly cycle.

| Field | Value |
| --- | --- |
| **Latest review date** | 2026-05-19 |
| **Reviewer(s)** | Maintainer team + `/security-review` automated audit pass (Claude Opus 4.7) |
| **Scope** | Whole codebase on `develop` tip — auth, authz (Firestore rules), API input validation, secrets handling, cryptographic operations, output encoding/XSS, file uploads, external requests/SSRF, OAuth flows, Firestore query patterns, middleware, error handling |
| **Excluded** | Test files; theoretical/style concerns; DOS / rate-limiting class issues (covered separately); regex DOS; pure documentation; React XSS without `dangerouslySetInnerHTML` |
| **Result** | **No high-confidence findings.** Codebase demonstrates mature security practices across all critical areas examined. |
| **Next review** | 2026-08-19 (90-day cadence, aligned with `docs/DOCUMENTATION_REVIEW.md`) |

## Continuous security gates

The codebase is also under continuous security review via CI. These run on every PR to `develop` and on every push to `main`:

- **OpenSSF Scorecard** — `.github/workflows/scorecards.yml` — scores the project across pinned-deps, branch-protection, CI-tests, code-review, dangerous-workflow, fuzzing, license, maintained, packaging, SAST, security-policy, signed-releases, token-permissions, vulnerabilities, webhooks.
- **CodeQL static analysis** — `.github/workflows/codeql.yml` — JavaScript/TypeScript and Python.
- **gitleaks** — `.gitleaks.toml` + CI step — secret scanning on every commit.
- **`npm audit`** — fails CI on high-severity vulnerabilities in dependencies.
- **license-checker** — denies GPL/AGPL/SSPL/proprietary licenses in the dep tree (`docs/SUPPLY_CHAIN.md`).
- **dependency-review** — GitHub native dependency-review action on PRs.
- **DCO** — every commit Signed-off-by.
- **SBOM** — CycloneDX SBOM generated on every release, attached as artifact + Sigstore-signed.

## Latest review findings

No high-confidence exploitable vulnerabilities were discovered in the develop-tip pass.

## Areas reviewed and cleared

- **Authentication & session handling** (`lib/server-auth.ts`, `lib/middleware.ts`, `lib/firebase-admin.ts`): Firebase ID token verification, dual admin-claim paths (explicit claims + legacy email fallback) properly gated, clear separation between claim-based and email-based admin elevation.
- **Firestore security rules** (`config/firebase/firestore.rules`): Strict ownership checks on user-owned data; server-authoritative fields (`status`, `approvedAt`, `completedAt`) protected; sensitive collections (`ludwittTokens`, `apiRateLimits`, `emailVerifications`) restricted to Admin SDK; publicly readable data explicitly marked; nested rules validate `memberIds` before allowing transactional operations.
- **API route input validation** — sample of 8+ routes spanning agents, game, community, auth, and admin endpoints all use Zod schemas before any business logic; Firestore queries use parameterized `.where()` operators, never string-based construction.
- **Secrets handling**: `.env.local` gitignored; service account loaded via `FIREBASE_SERVICE_ACCOUNT_JSON` env var; admin email lists sourced from environment; no API keys found in source.
- **Cryptographic operations**: Email verification tokens via `crypto.randomBytes(32)` (256 bits) stored as SHA-256 hashes, format-validated before DB query; agent API keys via `crypto.randomBytes(16)` hashed with SHA-256; GitHub webhook signatures verified via HMAC-SHA256 with 1 MB payload cap.
- **Output encoding & XSS**: `dangerouslySetInnerHTML` usage limited to `JSON.stringify` output for JSON-LD structured data; blog post rendering uses safe React element construction with URL protocol whitelist (http/https/mailto/relative); community content sanitized via `sanitizeText()` then React auto-escaped.
- **OAuth flows** (Discord, GitHub, Ludwitt): State parameter validated via cookie/query match; redirect URI fixed (env or request origin, not user-supplied); return-to URL must start with `/` (rejects `//`); tokens extracted from `Authorization` headers only, redacted in logs.
- **File uploads**: No `formidable` / `multer` usage; no direct file-to-disk operations from API routes; uploads are metadata only via Firestore/Admin SDK.
- **Firestore query patterns**: Parameterized operators throughout; user/document IDs validated via `sanitizeDocId()` format checker; list operations capped with `.limit()` and cursor pagination; no dynamic collection names from user input.
- **Email verification flow**: Token format validated before DB query; expiry enforced; email duplication via `emailLookup`; 254-char limit; intentionally simple linear-time regex.
- **Rate limiting**: In-memory (`rate-limit.ts`) + Firestore/Upstash backed; cron endpoints protected via `CRON_SECRET`.
- **Admin authorization**: Summer Cohort admin routes check `isSummerCohortAdminEmail()`; game admin routes check `user.isAdmin` claim; admin-only routes return 403 on auth failure (not 401).
- **Middleware stack**: CSRF origin allowlist with env override; request logging with IP/user-agent; rate limiting composable; no hardcoded request-hang timeouts.
- **Error handling**: Generic client messages; detailed server-side logs; webhook payloads size-capped before parse; broad try-catch with no state leakage.
- **Database initialization**: Firebase Admin SDK module-level singleton; certificate via env; project ID validated.

## Defensive measures inventory

- Zod schema validation on all API inputs (custom error messages for diagnostics, not exploit aid)
- SHA-256 hashing for API keys and sensitive tokens (non-reversible)
- Firestore security rules as defense-in-depth behind API authorization
- Environment-based configuration (secrets not in code)
- Server-side sanitization of user content (control characters stripped, no HTML preserved)
- Rate limiting at both middleware and business-logic layers
- CORS / CSRF origin validation on state-changing operations
- Webhook signature verification (HMAC-SHA256)
- Expiry timestamps on sensitive tokens (email verification, agent claim)
- Cache invalidation pattern for admin data (Firestore + `revalidatePath` / `revalidateTag`)
- Security-event logging (CSRF blocks, auth failures) with request ID tracking
- Secret redaction in error messages (API key patterns, emails, file paths)

## Review cadence

This document is refreshed on the same quarterly cycle as [`docs/DOCUMENTATION_REVIEW.md`](DOCUMENTATION_REVIEW.md) (every 90 days) and additionally whenever:

- A new authentication path is introduced
- A new admin-elevation surface is added
- A security incident is closed (postmortem links here)
- A dependency with known-exploitable CVE is updated

If a high-severity finding is discovered between reviews, it is patched immediately (security PRs get the Project Lead `--admin` bypass per `.github/GOVERNANCE.md` § Code Review → Project Lead bypass) and logged in `docs/SECURITY_OPERATIONS.md`.
