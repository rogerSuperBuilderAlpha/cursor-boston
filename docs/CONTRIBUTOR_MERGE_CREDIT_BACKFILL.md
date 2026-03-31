# Contributor merge credit backfill

When a contributor’s work lands on `main` without merging their GitHub PR (for example “close + push” or a maintainer **integration PR** that supersedes the original), the GitHub webhook never records their PR as **merged**. In-app credit (badges, Firestore-based leaderboard counts) depends on merged rows in the `pullRequests` collection and `users.github.login` linkage—see [`lib/github.ts`](../lib/github.ts) and [`lib/badges/getBadgeEligibilityInput.ts`](../lib/badges/getBadgeEligibilityInput.ts).

## Audit trail / manifest

- **Canonical case list:** [`scripts/backfill-merge-credit.cases.json`](../scripts/backfill-merge-credit.cases.json)  
  Add rows only after human review. Classifications:
  - `landedDirectly` — original PR closed unmerged; same change is on `main`.
  - `landedViaIntegrationPr` — original PR closed unmerged; work merged under another PR (set `integrationMergedPrNumber`).

- **Discover candidates:** list closed, non-merged, non-bot PRs (paginated):

  ```bash
  npx tsx scripts/backfill-merge-credit.ts --audit
  ```

  Requires `GITHUB_TOKEN` (or unauthenticated rate limits apply). Not every row is a credit-loss case (e.g. superseded by a later merged PR from the **same** author, like `#164` → `#165`).

## Run the backfill

Prerequisites:

- `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
- `GITHUB_TOKEN` for `--dry-run` / `--apply` (script fetches PR metadata from the API)

Commands:

```bash
# Preview Firestore operations (no writes)
npx tsx scripts/backfill-merge-credit.ts --dry-run

# Apply pullRequests upserts + reconcile users.pullRequestsCount
npx tsx scripts/backfill-merge-credit.ts --apply

# Also award missing eligible badges (awardSource: migration) and refresh users.earnedBadgeIds
npx tsx scripts/backfill-merge-credit.ts --apply --sync-badges

# Custom manifest
npx tsx scripts/backfill-merge-credit.ts --apply --cases ./path/to/cases.json
```

Or use npm: `npm run backfill-merge-credit -- --dry-run`

### What the script does

1. For each case, loads the original PR from GitHub; for `landedViaIntegrationPr`, uses the **integration PR’s** `merged_at` as `mergedAt`.
2. Resolves Firebase uid via `users` where `github.login` equals the manifest `authorLogin`.
3. Upserts `pullRequests/pr-<number>` with `state: "merged"` and fields aligned with [`processPullRequest`](../lib/github.ts).
4. Sets `backfillSource`, `backfillClassification`, and optionally `backfillIntegrationPrNumber` for traceability.
5. Recomputes **`users.pullRequestsCount`** for each affected uid as the count of merged `pullRequests` for the configured repo (same filter as hackathon signup).

Skipped rows (no linked GitHub account in Firebase) are printed; those users must connect GitHub on their profile before a successful backfill.

### Showcase badge (`hackASprint2026ShowcaseBadge`)

The webhook sets this when a **merged** PR touches showcase paths. A pure Firestore `pullRequests` fix does not retroactively run that logic. If someone should have the showcase flag, set it with an Admin SDK one-off or re-run your internal admin helper after reviewing changed files.

### GitHub Search vs Firestore

Hackathon signup may override counts with GitHub Search merged PR counts per login. Closed-unmerged PRs still do not count on GitHub; Firestore backfill fixes in-app/badges alignment. If you need GitHub-side credit too, the PR must be **merged** on GitHub (preferred fix going forward).

## Post-run verification

For each affected user:

1. Firestore: `pullRequests` where `userId` and `state == "merged"` includes the backfilled `pr-*` doc.
2. Profile: `users.pullRequestsCount` matches the reconciled count for that repo.
3. Badges: contributor (and any other newly eligible badges) appear after `--sync-badges` or after the user calls `POST /api/badges/awards`.
4. Optional: hit hackathon event signup GET if that user is in the pool and check `mergedPrCount` / `creditEligible`.

## Maintainer guardrails

- Merge contributor work **through GitHub** on the original PR when possible (`gh pr merge` / UI). See [.cursor/rules/pr-merge-policy.mdc](../.cursor/rules/pr-merge-policy.mdc).
- If you must use an integration branch, **merge in a way that preserves the contributor as PR author** or add the contributor’s case to `backfill-merge-credit.cases.json` immediately after merge.
- Enable branch protection on `main` (no bypass): [.github/README_GIT.md](../.github/README_GIT.md).
- After any integration PR, spot-check: GitHub **merged** PR author vs Firestore `pullRequests` / webhook logs.

## Code references

- Shared admin eligibility + badge sync: [`lib/badges/admin-badge-awards.ts`](../lib/badges/admin-badge-awards.ts)
- Backfill script: [`scripts/backfill-merge-credit.ts`](../scripts/backfill-merge-credit.ts)
