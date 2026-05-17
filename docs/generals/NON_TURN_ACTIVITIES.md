# Non-turn player activities

Players in Generals start a week with **100 turns** (300 for new players) and every meaningful gameplay action — explore, build, attack, cast, siege, upgrade, Armageddon — consumes turns. Burn through the budget on Monday and there's nothing to *do* until the next grant.

PR #969 added **ten participatory player actions that don't consume turns** to bridge that gap. They're social, creative, and lore-oriented — explicitly designed to *not* affect combat or economy balance. The goal is to deepen mid-week engagement without inflating the turn economy.

This page is for contributors changing those activities, adding new ones, or extending the patterns to other parts of the site.

## The ten activities

| # | Feature | Surface | Key file(s) |
|---|---|---|---|
| 1 | Profile pages + editable bio | `/game/players/[playerId]` | `app/game/players/[playerId]/page.tsx`, `app/api/game/players/me/bio/route.ts`, `app/api/game/players/[playerId]/route.ts` |
| 2 | Auto-awarded titles (Tile Baron, Warlord, Sealbreaker, Seer, …) | profile page | `lib/game/titles.ts` (pure derivation, no separate awards table) |
| 3 | Reactions (⚔️ / 🛡️ / 📜) on chat, feed, and hero events | dashboard + hero detail | `lib/game/reactions.ts`, `app/api/game/reactions/route.ts`, `app/game/_components/dashboard/ReactionsRow.tsx` |
| 4 | Hero chapters (in-app chronicle submissions) | `/game/heroes/[heroId]` | `lib/game/hero-lore.ts`, `app/api/game/heroes/[heroId]/chapter/route.ts` |
| 5 | Hero epitaphs (fallen-only eulogies) | `/game/heroes/[heroId]` | same module |
| 6 | Tile inscriptions (cosmetic, revealed via intel) | `/game/tiles/[tileId]` | `app/api/game/tile/[tileId]/inscription/route.ts`, `setTileInscriptionServer` in `lib/game/data-server.ts` |
| 7 | Caste-scoped chat rooms | dashboard `CommunityPanel` | `lib/game/community.ts` (`scope` field on `CommunityMessage`), `app/api/game/community/chat/route.ts` |
| 8 | Battle dispatches (≤280-char taunts on attacks) | `/game/attacks`, attack form | `lib/game/data-server.ts` (attack write site), `GameAttack.dispatch` |
| 9 | Public pacts (non-aggression vows, auto-flagged on break) | profile pages | `lib/game/pacts.ts`, `app/api/game/pacts/route.ts` |
| 10 | Armageddon prophecies | `/game/armageddon` | `lib/game/prophecies.ts`, `app/api/game/prophecies/route.ts` (see also [ARMAGEDDON.md](ARMAGEDDON.md)) |

## Shared patterns

All ten activities share five conventions. **Use the same patterns when adding an eleventh.**

### 1. Server-side `sanitizeText()` on every free-text field

Every user-authored text field (bio, inscription, chapter, epitaph, dispatch, pact statement, prophecy text) goes through `sanitizeText()` from `lib/sanitize.ts` before persistence. This strips ASCII control characters and normalizes whitespace, but does **not** strip HTML — React's JSX auto-escapes `<`, `>`, `"`, `'`, `&` at render time, so HTML strings render as literal text rather than markup.

Never store a raw user string without going through this function. Adding a new free-text field? Sanitize it on the server inside the same handler that validates the length.

### 2. Per-user Upstash rate-limit keyed by feature

No new daily-counter Firestore docs. Every write endpoint uses `checkUpstashRateLimit(\`<feature>:${uid}\`, { windowMs, maxRequests })` from `lib/upstash-rate-limit.ts`. The in-memory fallback handles cases where Upstash isn't configured.

Current keys + limits:

| Key | Window | Max |
|---|---|---|
| `bio:${uid}` | 24h | 5 |
| `reaction:${uid}` | 1m | 60 |
| `chapter:${uid}` | 24h | 3 |
| `epitaph:${uid}` | 24h | 5 |
| `inscription:${uid}` | 24h | 20 |
| `pact:${uid}` | 24h | 1 |
| `prophecy:${uid}` | 24h | 1 |

When adding an eleventh activity, pick a window + cap and stick to the pattern. Don't reach for a per-doc counter unless you genuinely need cross-user coordination.

### 3. Soft-delete moderation

Every user-authored row carries the same shape:

```ts
deletedAt?: Timestamp | Date;
deletedByAdmin?: boolean;
```

Authors can soft-delete their own. Admins can soft-delete anyone's. Hard deletes are never used — the audit trail survives. The render layer hides `deletedAt`-stamped rows by default.

This pattern was lifted from `game_community_messages` (the chat) and reused for chapters, epitaphs, pacts, prophecies. Reuse it for #11.

### 4. Idempotent reactions via tracker docs

The reactions feature is the only one with an idempotency requirement (don't let one user spam +1 forever on the same emoji of the same doc). Solution:

- A `game_reactions/{userId}_{scope}_{docId}_{emojiIndex}` doc records "this user placed this reaction." Doc existence is the boolean.
- Toggle on → create the tracker + `FieldValue.increment(+1)` on the target's `reactions.<emoji>` counter.
- Toggle off → delete the tracker + `FieldValue.increment(-1)`.
- The whole thing runs in a single Firestore transaction so concurrent toggles can't desync.

If you add another idempotent action (e.g. "watch this hero"), follow the same tracker-doc shape.

### 5. Firestore composite indexes for any query that filters + orders

Three composite indexes were added with these features:

- `game_community_messages` — `scope ASC` + `createdAt DESC` (for caste-room reads).
- `game_pacts` — `authorId ASC` + `expiresAt DESC` and `targetId ASC` + `expiresAt DESC` (for profile-page pact lists).
- `game_prophecies` — `targetSealNumber ASC` + `createdAt DESC` (for the per-seal prophecy panel).

Indexes deploy automatically when `main` moves and `firestore.indexes.json` changed — see [CLAUDE.md](../../CLAUDE.md) for the workflow. **Every new query that filters + orders needs a matching index in `config/firebase/firestore.indexes.json`.**

## What's intentionally *not* in the patterns

- **No turn cost**, full stop. If you find yourself reaching for `turnsRemaining` on one of these features, you've drifted from the design intent. Surface it as a separate gameplay feature instead.
- **No gameplay-impactful side effects.** Reactions don't buff units. Titles don't boost magic. Pacts don't enforce. Prophecies don't unlock anything in combat. The Seer / Oracle titles are cosmetic. Don't smuggle gameplay through the cosmetic surface.
- **No combat involvement.** Pacts watch the attack handler and stamp `brokenAt` if a vow is violated; they do **not** prevent the attack. The community feed event is the punishment — reputational, not mechanical.

## Adding an eleventh activity

A rough checklist before opening the PR:

1. Decide what doc kind it lives on (new collection, new subcollection, or counter on an existing doc).
2. Add the type in `lib/game/types.ts`.
3. Server logic in a new `lib/game/<feature>.ts` module (don't bolt onto `data-server.ts` unless the feature shares a transaction with a turn-spending action).
4. API route under `app/api/game/<feature>/`. Use the same auth + parse + rate-limit + sanitize + apiSuccess shape as the existing routes.
5. Firestore rules update in `config/firebase/firestore.rules` (server-write-only, authenticated read — same as the other non-turn rows).
6. Firestore index update in `config/firebase/firestore.indexes.json` if you have a filter-+-order query.
7. UI surface — usually a small client component dropped into an existing page, not a new top-level route.
8. Tests: at minimum a route-handler test that exercises auth, rate limit, validation, sanitize.

The 10 activities are the canonical reference — copy the closest one and mutate.

## Player-facing surface

For player documentation on what these features do and where to find them, see the **Community** and **Endgame** tabs in `/game/help`.
