# ADR-0007: Account deletion — hard-delete with 30-day soft-delete grace

- **Status:** Accepted
- **Date:** 2026-05-18
- **Driver:** Privacy Policy advertised self-serve account deletion that no endpoint implemented; GDPR Article 17 + CCPA right-to-delete exposure ([OPENSOURCE_REVIEW.md Session 1 §4 finding 1](../OPENSOURCE_REVIEW.md))

## Context

The Privacy Policy stated that users may delete their account through profile settings. As of the 2026-05-06 OSS review, no `app/api/account/delete` endpoint existed, no delete button was wired into the profile page, and Firestore writes never cascade-deleted user-owned data across the ~40 user-keyed collections. The gap was a policy/practice contradiction with material legal exposure.

The implementation question wasn't whether to ship deletion — that was forced by the policy — but **how**. Two main models were considered:

1. **Hard delete on request.** When the user clicks "Delete account", we immediately purge their auth record + cascade-delete all user-owned data.
2. **Soft delete with grace period.** Mark the account as `deletedAt = now`, hide from all reads, then hard-delete after a grace window. User can recover during the window.

## Decision

**Adopt the soft-delete-with-grace model. Grace period: 30 days. After 30 days, a scheduled job hard-deletes the auth record and cascades deletion across all user-keyed Firestore collections in a batched transaction.**

Specifically:

- New endpoint `DELETE /api/account` requires authentication, a re-auth confirmation token (proves the user is physically present), and is rate-limited via Upstash.
- The handler sets `deletedAt: serverTimestamp()` on the user document and propagates the soft-delete flag to all user-owned documents via a batched Firestore transaction.
- Soft-deleted documents are filtered out of all read paths (community feed, mentorship matching, profile pages, search). The user can no longer sign in.
- A daily scheduled job (`account-purge.yml` or a Firebase Cloud Function) finds documents older than 30 days with `deletedAt` set and performs the irreversible purge: deletes the auth record via `admin.auth().deleteUser(uid)`, then deletes all user-keyed documents.
- During the 30-day window, the user can email `hello@cursorboston.com` to request reactivation. The maintainer team clears `deletedAt`. The recovery path is intentionally manual (not self-service) so a compromised account can't be silently un-deleted by an attacker who got control of the auth credentials before the deletion was requested.

## Consequences

### Positive

- **GDPR Article 17 + CCPA compliance.** The user has an actual, working right to erasure.
- **Abuse-investigation window.** If a deleted user posted abuse before deletion, the moderation team has 30 days to investigate before evidence is irretrievably gone. Aligns with the [Mastodon model](https://github.com/mastodon/mastodon/blob/main/app/services/delete_account_service.rb).
- **Recovery path for user mistakes.** "I clicked delete by accident at 2 AM" is a real human failure mode; the 30-day window costs us nothing and saves the user.
- **Auditable.** The soft-delete state is observable; we can answer "how many users have deleted accounts in the last 90 days" without inferring from absence.

### Negative

- **More complex than hard-delete.** Every read path must filter on `!deletedAt`. Easy to forget — needs a per-query helper.
- **Storage cost.** Soft-deleted documents take up space for 30 days. Marginal at our scale.
- **Cascade map must stay current.** Any new user-keyed Firestore collection must be added to the cascade. We mitigate this with a generated cascade list (see "Implementation note" below) rather than hand-maintenance.

### Neutral

- **Recovery is manual, not self-service.** Trade-off in favor of security. We can revisit if support volume warrants automation.

## Implementation note

The cascade map should be **programmatically generated** from `firestore.rules` rather than hand-maintained. A test in `__tests__/lib/account-deletion.test.ts` should assert that every user-keyed collection (i.e., every collection whose rules reference `request.auth.uid` for write access) appears in the cascade map. If a new collection is added without updating the cascade, the test fails. This invariant is the single most important thing to preserve as the schema evolves.

## Alternatives considered

### Alternative 1 — Hard delete on request (no grace window)

Rejected because:
- A misclick or compromised session would result in irreversible data loss.
- No abuse-investigation window — bad actors could post abuse, then immediately delete, leaving no evidence.
- Most comparable platforms (Mastodon, Discord, X/Twitter, GitHub) implement a soft-delete window for the same reasons.

### Alternative 2 — Soft delete with no eventual hard delete

I.e., the account stays "deleted" but data remains forever in Firestore. Rejected because it fails GDPR Article 17 (the "right to be forgotten" requires actual erasure, not concealment). Acceptable for archival/historical academic data, not for an active community platform with PII.

### Alternative 3 — Longer grace window (90 days)

Rejected as more burdensome to users requesting deletion (their data stays accessible to maintainers for longer) without commensurate benefit. 30 days is the median across comparable platforms.

## Cross-references

- [`docs/REVIEW_ACTION_PLAN.md §2.2`](../REVIEW_ACTION_PLAN.md) — original implementation plan
- [`docs/ARCHITECTURE.md § Multi-step flow`](../ARCHITECTURE.md#multi-step-flow-eg-account-deletion) — request/response shape
- [`app/api/account/route.ts`](../../app/api/account/route.ts) — current implementation
- [`firestore.rules`](../../config/firebase/firestore.rules) — source of truth for which collections are user-keyed
