# Heroes

Heroes are unit-tier strategic assets that emerge probabilistically from class-aligned actions and live on a single tile. They shipped in two waves — the v1 emergence + combat model (PR #961) and the v2 registry + lore surface (PR #963) — and were extended in PR #969 with player-authored chapters and epitaphs.

This page is for contributors who want to add a new hero class, a new specialty, or a new lore chapter, and for maintainers reasoning about how heroes interact with the rest of the game.

## TL;DR

- **Three classes**: `military`, `farm`, `magic`. Each class emerges from a distinct action on a class-aligned tile.
- **One hero per tile**, denormalized onto the `GameTile` doc for combat math + persisted as a long-lived `game_heroes/{heroId}` registry doc so the hero survives even after the tile changes hands.
- **Combat outcomes**: when a tile with a hero is captured, the attacker picks `kill` (default), `spare` (lose-half-stamina, defender keeps tile), or `convert` (gated on stamina ≤ 25, RNG-rolled defection).
- **Visibility**: living-hero location + stamina are hidden from viewers who aren't the current owner or an adjacent tile owner. Deceased / `awaitingResurrection` heroes are fully public.
- **Lore**: every hero gets a markdown backstory under `lib/game/content/hero-backstories/<heroId>.md` (contributor-authored via PR) plus in-game chapters and epitaphs (UI-submitted, moderated soft-delete).

## Code map

| Concern | File |
|---|---|
| Hero class / specialty content | `lib/game/content/heroes.ts` |
| Emergence + stamina + combat resolution | `lib/game/heroes.ts` |
| Persistent registry + event log | `lib/game/hero-registry.ts` |
| Visibility filter (location / stamina) | `lib/game/hero-visibility.ts` |
| Player-authored chapters + epitaphs | `lib/game/hero-lore.ts` |
| Server reads for `/api/game/heroes` | `lib/game/heroes-server.ts` |
| Markdown backstory chapters | `lib/game/content/hero-backstories/<heroId>.md` |
| Backstory index (auto-built) | `lib/game/content/hero-backstories/_index.ts` |
| Type defs (`GameHero`, `GameHeroDoc`, `HeroEventKind`, ...) | `lib/game/types.ts` |

## The three classes

Each class has a class-aligned tile type that drives emergence, plus 6 specialties that scale specific effects.

### Military

- **Emergence**: probabilistic on a **won** battle (capture or successful repel). Spawns on the attacking or defending tile depending on outcome.
- **Effect**: boosts attack from the tile (~+20% base) and defense on the tile (~+25% base), specialty-weighted.
- **Specialties**: `ground`, `siege`, `air`, `garrison`, `raid`, `supply` — each weights the boost toward a unit type or stance.
- **Stamina**: scales output — exhausted heroes are weaker.

### Farm

- **Emergence**: probabilistic on a recruitment action at a `food`-type tile.
- **Effect**: kingdom-wide recruitment boost (+10% per farm hero, capped at +50%). +10% special-unit-roll chance per recruit on the hero's tile (`summoner` specialty doubles this).
- **Specialties**: `ground-recruit`, `siege-recruit`, `air-recruit`, `summoner`, `kingdom-buff` (×2).
- **Summoner side-effect**: farm heroes with the `summoner` specialty roll for **caste-themed special units** that join the player's pool, stationable on any owned tile.

### Magic

- **Emergence**: probabilistic on a spell cast from a `magic`-type tile.
- **Effect**: boosts spell magnitude from the tile (+15% base, specialty-weighted by spell type). Contributes "virtual magic lands" to the Armageddon multiplier (`armageddon` specialty ×2, `spellcasting` ×1.25).
- **Specialties**: `spellcasting`, `armageddon`, `offense-spells`, `defense-spells`, `spying`, `production-spells`.

## Stamina, kill / spare / convert

Heroes have `stamina` (0–100), `staminaMax`, and `lastEngagedAtTurn` (drives lazy regen).

- **Regen**: +20 stamina per owner turn since `lastEngagedAtTurn`, capped at `staminaMax`.
- **Decay**: -25 stamina per engagement (attack from or onto the hero's tile, regardless of outcome).
- **Conversion gate**: `convert` is only available when `stamina ≤ 25`.

When the attacker wins a battle on a tile that has a defending hero, the attacker chooses one of three actions in the request body (`AttackBody.heroAction`):

| Action | Effect on hero | Effect on tile | When available |
|---|---|---|---|
| `kill` (default) | `isDeceased = true`, stamina → 0, fully public in the registry afterwards | Attacker captures the tile | Always |
| `spare` | Stamina drops by an extra 25 (so -50 total for the engagement); hero stays with the defender | Defender keeps the tile (the attacker explicitly chose not to take it) | Always |
| `convert` | RNG roll against `(100% - stamina%)` capped at 90%; on success, hero defects to attacker at stamina = 50 | Attacker captures the tile | Only when defending hero's stamina ≤ 25 |

On a failed `convert` roll, the request also carries a `heroActionOnConvertFail` (`kill` or `spare`) that runs as the fallback.

The action is recorded in the `game_heroes/{heroId}/events` subcollection as a `slain` / `defected` event, and surfaced on `/game/heroes/[heroId]`.

## Registry + dual-write pattern

Every hero mutation writes to two places inside the same Firestore transaction:

1. The inline `GameTile.hero` snapshot — what combat math reads.
2. The persistent `game_heroes/{heroId}` doc + an append-only event in its `events` subcollection — what the registry browser reads.

This is the **dual-write pattern**. The tile snapshot is fast for combat; the registry doc is durable across tile flips, Armageddon wipes (heroes enter `awaitingResurrection: true` rather than disappearing), and contributor lore browsing.

The pattern is enforced by `appendHeroEventInTx` and `upsertHeroInTx` in `lib/game/hero-registry.ts`. **Never write to one half without the other** — readers will desync.

## Visibility rules

Living hero docs are filtered server-side at `/api/game/heroes` based on the viewer:

- **Owner**: full data — `currentTileId`, `stamina`, all events from the owner's tenure.
- **Adjacent player**: `currentTileId` + `stamina` revealed, events still tenure-filtered.
- **Stranger**: name, class, specialty, caste public; `currentTileId` + `stamina` hidden; events scoped to viewer's tenure only (usually empty).

**Deceased + `awaitingResurrection` heroes**: everything public (it's a lore browse). The Hall of the Fallen on `/game/heroes` scopes to these heroes.

The filter logic lives in `lib/game/hero-visibility.ts`.

## Lore: backstories, chapters, epitaphs

Three places lore can land:

### 1. Markdown backstory chapters (contributor-authored, in-tree)

- One file per hero: `lib/game/content/hero-backstories/<heroId>.md`.
- Append-only — new chapters get added as `## Chapter N — ...` headers, existing chapters can only be corrected for typos.
- The `_index.ts` is auto-built; you don't edit it directly.
- Use the GitHub edit link surfaced on `/game/heroes/[heroId]` ("Add a chapter →") to open a fork-and-edit flow in one click.

### 2. In-app chapters (player-submitted, moderated)

- Subcollection `game_heroes/{heroId}/chapters` — `{ body (≤2000 chars), status: 'pending' | 'approved', authorId, ... }`.
- Hero's current owner auto-publishes. Strangers land as `pending` for admin approval.
- Soft-delete pattern: `deletedAt` + `deletedByAdmin`. Author can delete their own; admin can delete any.
- Endpoint: `POST /api/game/heroes/[heroId]/chapter`, rate-limited 3/day per user via Upstash.

### 3. Epitaphs (player-submitted, on fallen heroes only)

- Subcollection `game_heroes/{heroId}/epitaphs` — `{ body (≤280 chars), ... }`.
- Available **only when** `hero.isDeceased || hero.awaitingResurrection`. POST returns 400 on a living hero.
- Endpoint: `POST /api/game/heroes/[heroId]/epitaph`, rate-limited 5/day per user.

All three lore surfaces render on `/game/heroes/[heroId]`: markdown chronicle first, in-app chapters second, epitaphs third (when applicable).

## Adding a new class or specialty

If you're proposing a new hero class (e.g. `engineer` for siege-only kingdoms), expect to touch:

1. `lib/game/types.ts` — extend `HeroClass`, `HeroSpecialty`.
2. `lib/game/content/heroes.ts` — class definition, emergence trigger, effect resolver.
3. `lib/game/heroes.ts` — emergence probabilities + effect math.
4. `lib/game/hero-registry.ts` — if the class introduces new event kinds, extend `HeroEventKind` and `appendHeroEventInTx`'s `optionalKeys`.
5. Tests in `__tests__/lib/game/heroes/` — round-trip the new class through emergence + combat outcomes.

New specialties are simpler — usually just an entry in the class's specialty pool + an effect-weighting branch.

## Things that will get a hero PR rejected

- **Stamina caps above 100** or below 0 — the visibility scale assumes a 0–100 range.
- **Class-effect numbers outside the bands** in [`BALANCE.md`](BALANCE.md) — a +500% military bonus isn't going to ship.
- **Backstory chapter edits to other contributors' chapters** beyond typo corrections — the append-only lint will block this in CI.
- **Adding a chapter via the markdown route AND the in-app route in the same PR** — those are intentionally separate surfaces; pick one.
- **Hero name pools that overlap real-world ethnic, religious, or political labels** — same rule as caste naming. See [CASTES.md](CASTES.md).

## Related player-facing surface

Heroes appear in three player UIs:

- **`/game/heroes`** — roster browser with three scopes: `mine` (heroes you own), `all` (every living hero, visibility-filtered), `fallen` (deceased + awaiting-resurrection, fully public).
- **`/game/heroes/[heroId]`** — single-hero detail page with stats, location (visibility-gated), chronicle + chapters + epitaphs, event timeline, reactions on each event.
- **Dashboard `HeroCard`** + **`HeroesRosterCard`** — surface 1–3 featured heroes on `/game`.

For player-facing documentation, see the `Heroes` tab in `/game/help`.
