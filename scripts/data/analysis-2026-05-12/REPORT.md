# GCP / Firebase usage analysis — last 10 days (May 2 → May 12, 2026)

**Project:** `cursor-boston`
**Data sources:** Cloud Monitoring (`firestore.googleapis.com/*`, `storage.googleapis.com/*`), Firebase Auth Admin SDK, Firestore counts. Hosting/edge metrics not available — Vercel API token is not in `.env.local`, so request-volume / latency for the Next.js layer is a gap (see §6).
**Raw data:** `scripts/data/analysis-2026-05-12/{gcp-metrics.json, usage.json, usage-fixed.json}`

---

## 1. Headline numbers

| Metric                              | 10-day total | Notes                                                                                |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| Firestore document reads            | **659,490**  | Daily range: 3.8K (May 5) → 159K (May 7). Big drop after cache deploy on May 8.      |
| Firestore document writes           | 18,088       | Tracks game activity — peak May 7 at 5,153.                                          |
| Firestore document deletes          | 737          | One-off spike on May 7 (728 deletes) = NPC seeding / reset.                          |
| Firestore Admin SDK request_count   | 85,448       | All `OK` except 14 `FAILED_PRECONDITION` errors (mostly May 6).                      |
| Auth users (total)                  | **404**      | Up from ~292 ten days ago — **+112 new (38% growth)**.                               |
| Auth users active in last 10d       | 136          | 34% of base.                                                                         |
| Game players                        | 70           | 66 of 70 (94%) have spent ≥1 turn. Total turns spent: **24,525**.                    |
| Cloud Storage total bytes           | ~101 MB      | Steady — no spikes.                                                                  |

---

## 2. Daily Firestore reads vs. deploy timeline

```
Date        Reads     Δ      Notable deploy
May 02       8,631    —      (pre-game baseline)
May 03       8,688    +1%
May 04      18,829   +117%
May 05       3,869    -79%   weekend low
May 06     144,559  +3637%   game ramp begins
May 07     159,224    +10%   PEAK — pre-cache, cohort 1 broadcast
May 08      29,639    -81%   ★ a00e0eb (cache) + 28418a5 (world snapshot) ★
May 09      54,732    +85%   044324f real-time map + smart-gated rebuilds
May 10     126,246   +131%   3a886c2 first-run wizard, more new users
May 11     105,073    -17%   stable post-launch baseline
```

Bucket boundary is 12:22 UTC (the time the metric pull ran). The cache + snapshot commits landed **May 8 ~11:00 UTC**, near the end of the May 7 bucket. So the **159K → 30K drop** between buckets brackets the deploy almost exactly. Net effect of those two commits, holding traffic roughly constant: **~5× reduction in reads/day** (and the May 9–11 days that followed never returned to the May 7 peak despite higher player counts).

Per the audit (`/api/game/world` and `/api/game/map/me`):
- World snapshot collapses **4,419 tile docs + 70 player docs into a single 684 KB doc** at `game_world_snapshots/latest`. Map render = 1 read instead of 4,489.
- Cache headers: `/api/game/world` is `public, max-age=30, s-maxage=60, stale-while-revalidate=120`; `/api/game/map/me` is `private, max-age=30`. CDN absorbs refresh storms.
- Smart-gating: cron at `*/5 * * * *` runs `where("updatedAt", ">", lastGeneratedAt).limit(1)` against `game_tiles` and `game_players` — idle ticks cost ~3 reads instead of ~4,500. At 288 ticks/day, that's the difference between **~1.3M reads/day** (naive) and a few thousand on idle ticks plus full rebuilds when activity warrants.

---

## 3. Front-end data infra audit

Six related changes shipped May 7–9. They form a coherent stack:

| Layer            | Commit / file                                                           | What it does                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge cache**   | `a00e0eb` — `Cache-Control` headers on `/api/game/world`, `/map/me`     | 30s browser + 60s CDN. Caps per-user requests to ≤2/min, global bare-GET to 1/min.                                                            |
| **Denorm read**  | `28418a5` — `lib/game/world-snapshot.ts`                                | Single `game_world_snapshots/latest` doc holds all tiles+owners. Map endpoints read it instead of querying tiles. ~99.97% read-cost cut.      |
| **Cron rebuild** | `vercel.json` cron `*/5 * * * *` → `/api/internal/snapshots/rebuild`    | Rebuilds the snapshot every 5 min, gated by activity check.                                                                                   |
| **Smart gate**   | `world-snapshot.ts:127–192`                                             | Server-side `where("updatedAt", ">", lastGeneratedAt).limit(1)` skips rebuild if no tile or player changed.                                   |
| **Realtime**     | `044324f` — `app/game/_lib/use-world-snapshot-listener.ts`              | Client uses Firestore `onSnapshot` on `game_world_snapshots/latest`. Auto-detaches on tab hide and 5-min idle (mouse/keyboard/touch tracker). |
| **Read merge**   | `09428cf` — `/game`, `/game/recruit`, `/game/spells`, `/game/tiles/[…]` | Action endpoints return `{player, tiles}` so client doesn't issue a follow-up `fetchPlayer()`. Removes ~2 reads per action.                   |
| **PR window**    | `09428cf` + `firestore.indexes.json` `(userId, state, mergedAt)` index  | `getPlayerEligibilityServer` range-filters PRs to current week instead of full user history.                                                  |
| **Mentorship**   | `5a8954e` — `lib/mentorship/data-server.ts`                             | Matcher uses `array-contains-any` against denormalized `normalizedExpertise` / `normalizedLearningGoals` instead of full-collection scan.     |

**Community feed / chat** (`f1e7e8b`) added two new collections: `game_community_events` (24 docs, append-only) and `game_community_messages` (2 messages so far). Chat is rate-limited via Upstash (10 posts / 60s); the panel is **not** realtime — it's a pull on refresh, so it doesn't add listener load.

**Snapshot doc current size:** 684 KB / 1 MB Firestore document limit (68%). At ~2× current tile count or ~3× owner count this will hit the ceiling and need to be split (e.g., shard by quadrant, or move tile geometry into a sub-collection). **This is the single biggest scale risk in the new infra.**

---

## 4. User & engagement breakdown

**Auth (last 10d):** 112 new users, 136 active. Daily new-user signups by day (max 22 on May 4 & May 5 — most likely the cohort-1 admit waves; also 14 on May 7 = broadcast `send-broadcast-2026-05-07.ts`; 11 on May 11).

**Game player base (70 total, 66 active):**
- Caste split: white 14 / blue 14 / green 13 / red 13 / black 10 / unset 6
- Total turns spent: 24,525 (avg 350/active player)
- 14 attacks logged in the window (`game_attacks` count + `game_tiles.lastAttackedAt`)
- 0 recruits and 0 far-expeditions stored as separate docs — those operations are likely embedded in the player/tile mutations, not their own collections

**Retention signal:** Game-player → auth ratio is 17% (70/404). New-user → game-player conversion is the next thing worth measuring; not directly observable from current data.

---

## 5. Errors & warnings

- 14 `FAILED_PRECONDITION` Firestore errors over 10 days, clustered May 4–8 (max 11 on May 6). Worth a quick `gcloud logging read` to identify — most likely transactional contention on `game_tiles` during the pre-cache surge.
- **0 active snapshot listeners** reported by Cloud Monitoring (`firestore.googleapis.com/network/snapshot_listeners` returned 0). Either the metric is not yet aggregated for this project or the new `useWorldSnapshotListener` is detaching aggressively. Worth verifying that the realtime listener is actually firing in production by adding a one-time client-side log for first-snapshot delivery.

---

## 6. Gaps in this analysis

1. **No Vercel/edge metrics.** Couldn't pull request volume, route-level latency, or function invocation counts. To close: add a `VERCEL_API_TOKEN` (read-only is enough) and we can fetch `/v6/deployments` and the analytics API.
2. **No client-side telemetry.** `instrumentation.ts` exists at the repo root — confirm whether it's wired to Sentry / OTLP / GA. If not, we have no real-user-monitoring data.
3. **Realtime DB metrics returned 0 series.** Either RTDB is provisioned but unused, or the SA lacks `firebasedatabase.viewer`. Given `firebase.json` has `database.rules.json`, it's provisioned — worth confirming no traffic is going there.
4. **Snapshot listener actual fan-out unknown.** With 70 active players potentially holding listeners, each snapshot rebuild fans out 70 reads. At full-rebuild cadence that's still small, but worth measuring once the metric reports nonzero.

---

## 7. Recommendations (ranked)

1. **Plan for snapshot-doc growth.** At 684 KB / 1 MB today with 4,419 tiles and 70 owners, this hits the Firestore single-doc limit before the cohort scales. Shard or move tile geometry to a sub-collection now, while it's an additive change.
2. **Wire Vercel analytics into this analysis.** The big unknown right now is whether the read-cost win is being eaten by edge function compute. Cheap to add.
3. **Verify the realtime listener metric.** `snapshot_listeners` showing 0 across the window is suspicious; confirm with a one-off client log.
4. **Investigate the `FAILED_PRECONDITION` cluster** on May 4–8. Likely benign (transaction retries) but cheap to confirm.
5. **Lock in the snapshot-rebuild gate.** Add a one-line metric/log for `idle vs. rebuild` cron outcomes — that's the single most informative number for the new infra and isn't in Cloud Monitoring today.
