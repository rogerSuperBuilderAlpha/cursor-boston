# API Caching Strategy

This project uses three cache layers for API responses:

- HTTP `Cache-Control` headers on route responses.
- Next.js data cache APIs such as `fetch(..., { next: { revalidate } })`,
  `unstable_cache`, `revalidateTag`, and `revalidatePath`.
- Persisted Firestore snapshots for expensive aggregate reads.

Use the current Next.js caching guide as the framework reference:
<https://nextjs.org/docs/app/getting-started/caching-and-revalidating>.

## Defaults

- Authenticated or user-specific routes should use `private` or `no-store`.
- Public list and aggregate routes can use short public or CDN caches.
- Mutation routes should stay dynamic and should invalidate any public read cache
  they make stale.
- GitHub API fan-out should be cached or snapshotted unless the caller is a
  one-off script that explicitly opts into uncached reads.

## Route Inventory

| Route or helper                                                            | Cache policy                                                                 | TTL                                                                                                                                                | Revalidation / invalidation                                                                                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/analytics/summary`                                               | Public response cache plus `analytics_snapshots/latest` Firestore snapshot.  | Browser `max-age=300`, CDN `s-maxage=3600`, stale for `86400`. Snapshot has its own `expiresAt`.                                                   | Snapshot producer owns refresh; stale snapshot is surfaced with `X-Data-Stale: true`.                                                   |
| `GET /api/members/public`                                                  | Public response cache over the public member snapshot.                       | Browser `max-age=60`, CDN `s-maxage=300`, stale for `600`.                                                                                         | Snapshot freshness is checked against `MEMBERS_SNAPSHOT_CACHE_TTL_MS`.                                                                  |
| `GET /api/badges/definitions`                                              | Public response cache for static badge definitions.                          | CDN `s-maxage=3600`, stale for `300`.                                                                                                              | Code deploy changes the definitions; no runtime invalidation.                                                                           |
| `GET /api/docs`                                                            | Public response cache for generated OpenAPI docs UI assets.                  | CDN `s-maxage=300`, stale for `600`.                                                                                                               | Regenerated OpenAPI artifacts ship with deploys.                                                                                        |
| `GET /api/cookbook/entries` without search                                 | Public response cache on non-search paginated reads.                         | CDN `s-maxage=60`, stale for `30`.                                                                                                                 | Search or personalized reads should not reuse this cache path.                                                                          |
| `GET /api/game/community/feed`                                             | Public response cache for the latest community events.                       | Browser `max-age=15`, CDN `s-maxage=30`, stale for `60`.                                                                                           | Short TTL absorbs bursts; moderation follow-up may add explicit invalidation.                                                           |
| `GET /api/game/world`                                                      | Public response cache backed by the persisted world snapshot when available. | Snapshot path: browser `max-age=60`, CDN `s-maxage=300`, stale for `600`. Live fallback: browser `max-age=30`, CDN `s-maxage=60`, stale for `120`. | Snapshot cron / rebuild updates the persisted world data. Responses expose `X-World-Snapshot-Stale` and `X-World-Snapshot-GeneratedAt`. |
| `GET /api/game/map/me`                                                     | Private browser cache for the caller's derived map view.                     | Snapshot path: `private, max-age=60, must-revalidate`. Live fallback: `private, max-age=30, must-revalidate`.                                      | Client action handlers patch the local map cache after mutations.                                                                       |
| `GET /api/game/players/[playerId]`                                         | Private browser cache for player detail reads.                               | `private, max-age=30, must-revalidate`.                                                                                                            | Mutations should update the client view or rely on the short TTL.                                                                       |
| `GET /api/game/prophecies` and `GET /api/game/pacts`                       | Private browser cache for current-player game state.                         | `private, max-age=30, must-revalidate`.                                                                                                            | Game actions mutate state and should update local UI state.                                                                             |
| `GET /api/game/world-meta`                                                 | Private short cache for world meta and resolving-state checks.               | `private, max-age=15, stale-while-revalidate=30`.                                                                                                  | Short TTL keeps armageddon / resolving-state transitions fresh.                                                                         |
| `GET /api/summer-cohort/submissions/[weekId]`                              | Public response cache mirroring the GitHub Contents API cache window.        | Browser `max-age=0`, CDN `s-maxage=60`, stale for `300`.                                                                                           | GitHub content changes become visible after the one-minute CDN window.                                                                  |
| `GET /api/summer-cohort/my-score/[weekId]`                                 | Server-side upstream fetch cache, private route response.                    | Upstream fetch `next.revalidate=60`; response `private, no-store`.                                                                                 | Per-user response must not enter shared caches.                                                                                         |
| `GET /api/cursor/github-issues`                                            | Server-side GitHub fetch cache.                                              | Upstream fetch `next.revalidate=60`.                                                                                                               | Good-first-issue listings update within one minute.                                                                                     |
| `GET /api/hackathons/teams-board` and `GET /api/hackathons/pool-dashboard` | Private short cache for hackathon dashboards.                                | `private, max-age=30`.                                                                                                                             | Fresh enough for dashboards while avoiding repeated Firestore reads.                                                                    |
| `GET /api/hackathons/team-dashboard` and profile/data routes               | Private no-store responses.                                                  | `private, no-store`.                                                                                                                               | Authenticated user/team state must not be shared.                                                                                       |
| `GET /api/hackathons/events/[eventId]/signup`                              | Dynamic route backed by `getCachedHackathonLeaderboardSnapshot`.             | The snapshot helper uses a 30-second in-process Next cache and persisted Firestore snapshots.                                                      | Check-in and signup mutations invalidate with tag `hackathon-event-signup`.                                                             |

## Shared Cached Helpers

| Helper                                                                             | Cache key / tag          | TTL                                                    | Invalidation                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchShowcaseSubmissionsFromGitHub` in `lib/hackathon-showcase.ts`                | `showcase-submissions`   | `unstable_cache` revalidates every `60` seconds.       | GitHub webhook calls `revalidateTag(SHOWCASE_SUBMISSIONS_CACHE_TAG)` and `revalidatePath("/hackathons/hack-a-sprint-2026")` when a merged PR touches showcase submissions. |
| `fetchMergedPrCountByAuthorForRepo` in `lib/github-merged-pr-count.ts`             | `merged-pr-counts`       | `unstable_cache` revalidates every `600` seconds.      | GitHub webhook calls `revalidateTag(MERGED_PR_COUNTS_CACHE_TAG)` on every target-repo merge.                                                                               |
| `getCachedHackathonLeaderboardSnapshot` in `lib/hackathon-leaderboard-snapshot.ts` | `hackathon-event-signup` | 30-second in-process cache around persisted snapshots. | Check-in and signup mutations call `revalidateTag("hackathon-event-signup")`; GitHub merge handling should refresh snapshots when PR counts change.                        |

## Mutation Pattern

When adding a mutation that changes public cached data:

1. Keep the mutation route dynamic with `export const dynamic = "force-dynamic"`.
2. Perform the write first.
3. Call the narrowest `revalidateTag` or `revalidatePath` needed for affected
   public reads.
4. Treat invalidation as best-effort only when the write already succeeded and a
   stale cache is acceptable for the documented TTL.

Example:

```ts
await writeCheckin();
revalidateTag("hackathon-event-signup", { expire: 0 });
```

## No-Store Pattern

Use `private, no-store` for responses containing:

- User profile data.
- Team dashboard data.
- Certificates owned by the caller.
- Admin lists, moderation state, live controls, or other privileged data.

Short private caches are acceptable for per-user game reads when the UI also
patches local state after actions.
