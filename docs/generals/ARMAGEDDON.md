# Armageddon

Armageddon is the **end-game** for a season of Generals. It introduces a 7-Seal mechanic: each cast of the `armageddon` spell rolls against a per-caster success chance, and a success **breaks one seal** of the seven. When the **seventh** seal breaks, the world enters a `resolving` state — turn-spending actions refuse, a top-of-tile-lottery draw runs, the hall of fame snapshot persists, and the world wipes to start a new season.

Heroes survive the wipe in `awaitingResurrection` limbo. Hall-of-fame docs persist forever. Player tiles, units, turns, and production spells reset.

This page is for contributors changing the seal mechanics, the lottery weights, the prophecy system, or the resolver. Shipped via PRs #952, #954, #956, #958, #967, with the prophecy + Seer-title surface added in #969.

## Code map

| Concern | File |
|---|---|
| Seal count, turn cost, gate, success-chance math | `lib/game/content/armageddon.ts` |
| The cast handler (turn deduction, success roll, seal break) | `lib/game/data-server.ts` — search for `sealsBroken` |
| Resolution job (wipe, lottery, hall-of-fame, hero limbo) | `lib/game/armageddon-resolve.ts` |
| Prophecy system (filing, resolution, Seer title) | `lib/game/prophecies.ts` |
| Type defs (`GameWorldMeta`, `SealRecord`, `ArmageddonWinner`, `ArmageddonEventRecord`, `Prophecy`) | `lib/game/types.ts` |
| Player UI: cast button + per-seal progress | `app/game/armageddon/page.tsx`, `app/game/_components/dashboard/SealsPanel.tsx` |
| Player UI: prophecy form + roster | `app/game/armageddon/page.tsx` (`PropheciesPanel`) |
| Hall-of-fame collection | `game_armageddon_events` (Firestore) |

## The 7 Seals

`SEAL_COUNT = 7` (in `lib/game/content/armageddon.ts`). Each cast attempts to break the next unbroken seal. The cast costs `ARMAGEDDON_TURN_COST = 100` turns regardless of outcome.

### Cast eligibility

Three gates, all checked in the cast handler before the success roll:

1. **Player phase = `play`** (you've made it past onboarding).
2. **`stats.tilesHeld ≥ ARMAGEDDON_TILE_GATE`** (default: 10,000 tiles — see `lib/game/content/armageddon.ts`).
3. **`worldMeta.armageddonState !== 'resolving'`** — once the 7th seal breaks, no more casts until the next season opens.

### Success roll

Per cast: a single d100 roll against `computeArmageddonSuccessChanceFromMultiplier(magicMultiplier)`. The multiplier folds:

- Raw `magic`-type tiles owned.
- Magic-hero bonuses (`spellcasting` specialty ×1.25, `armageddon` specialty ×2.0).
- Active production spells on the caster.

Higher multiplier → higher chance per cast. The exact curve lives in `computeArmageddonSuccessChanceFromMultiplier` — change it there if you're rebalancing the late game.

A successful roll:
- Stamps the breaking player's identity onto `SealRecord.brokenBy` (denormalized — survives the post-Armageddon player-doc wipe).
- Increments `worldMeta.sealsBroken`.
- Logs a `seal_broken` community event.
- Resolves any matching `game_prophecies` for this seal (see below).

A failed roll:
- Still costs 100 turns.
- Logs `armageddon_cast_failed` community event.

## Resolution (when seal 7 breaks)

The cast handler detects `sealsBroken >= SEAL_COUNT` after the increment and sets `worldMeta.armageddonState = 'resolving'`. From that moment, every turn-spending API call refuses with `GameArmageddonInProgressError`.

The resolver (`lib/game/armageddon-resolve.ts`) then:

1. **Snapshots hall of fame** to `game_armageddon_events/{seasonNumber}`:
   - `triggeredBy` (the player who broke seal 7).
   - `seals` (full 7-row audit trail, denormalized).
   - **Top-10 weighted lottery winners** drawn against tickets = `tilesHeld × (1 + sealsBroken)` (so seal-breakers are favored). `ArmageddonWinner[]`.
   - **Top-50 by tiles** snapshot (informational, not awarded).
   - `totalParticipants`, `totalTickets`.
2. **Flags living heroes** as `awaitingResurrection: true` and clears their `currentOwnerId` / `currentTileId`. Deceased heroes stay deceased.
3. **Wipes** `game_players`, `game_tiles`, `game_attacks`, `game_artifacts`, `game_intel_effects`. **Preserves** `game_heroes` (registry survives), `game_armageddon_events` (hall of fame), `game_community_events` (feed history), `game_community_messages` (chat), `game_reactions`, `game_pacts`, `game_prophecies`.
4. **Bumps** `worldMeta.seasonNumber`, resets `sealsBroken` to 0, clears `seals`, flips `armageddonState` back to `active`.

### Surviving the wipe — the design intent

Heroes survive because their lore is the connective tissue between seasons; the registry is the only thing that lets a returning player recognize "their" heroes after a wipe. The hall of fame survives because glory is the whole point of the lottery. Everything else (tiles, units, turns) resets so the world is fair for new seasons.

If you're adding a new collection, decide *before* adding it whether it should survive the wipe and update the resolver's preserve/wipe lists accordingly.

## Prophecies (Phase 7 of the non-turn activities)

A prophecy is a pre-filed prediction about a specific seal break. Players file one for a target seal (`1..7`) before that seal falls; when the seal breaks, every still-unresolved prophecy for that seal gets stamped `resolvedAt` + `fulfilledBy` (the breaker's identity).

### Resolution hook

Inside the cast transaction, **after** the seal break is committed, the handler calls `resolveProphesiesForSealInTx` (in `lib/game/prophecies.ts`). That function:

1. Reads `game_prophecies where targetSealNumber == brokenSealNumber`.
2. For each unresolved + non-deleted prophecy:
   - Stamps `resolvedAt` + `fulfilledBy`.
   - Increments the **author's** `game_players.prophecyFulfilledCount` via `FieldValue.increment(1)`.
   - Logs a `prophecy_fulfilled` community event.

### Seer title

`prophecyFulfilledCount` drives the `Seer` (1 fulfillment) and `Oracle` (3+) titles on the player profile — derived view via `lib/game/titles.ts`. There's no separate awards table; the count + title are computed from the player doc at read time.

### Rate limit

Filing is capped at **1 prophecy per day per user** via Upstash (`prophecy:${uid}`). Files for seals already broken are rejected with `ProphecySealAlreadyBrokenError`.

## Balance considerations

- **The 10,000-tile gate** is the only structural gate on casting Armageddon. Lower it and the late game compresses. Raise it and the late game becomes a grind for one or two players. Don't touch without intent.
- **Magic-multiplier curve** is the lever for "how many casts does a typical late-game player need to break a seal?" Right now it averages ~3–5 casts (300–500 turns ≈ 3 weeks of turn grants). Tune in `computeArmageddonSuccessChanceFromMultiplier`.
- **Lottery ticket formula** (`tilesHeld × (1 + sealsBroken)`) means a player who breaks one seal gets 2× the lottery weight, two seals gets 3×, etc. This caps the dominance of single-large-kingdom strategy without breaking the "tiles still matter" premise.
- **Hero `armageddon` specialty (×2 to magic multiplier)** is the biggest single lever a player has. If a class change is contemplated, this is the most balance-sensitive entry in `lib/game/content/heroes.ts`.
- **Prophecies and titles are explicitly non-impactful on combat / economy** — Seer/Oracle is cosmetic. Don't add gameplay effects to prophecies without explicit discussion.

## Things that will get an Armageddon PR rejected

- **Removing the `armageddonState === 'resolving'` check** anywhere on the turn-spending path. The 7th-seal window must be fully quiescent or the resolver races itself.
- **Changing `SEAL_COUNT`** without updating every place that loops `0..6` (search for `SEAL_COUNT`).
- **Adding new collections** to the world without an explicit decision on whether they survive the wipe — wired into `armageddon-resolve.ts`.
- **Failing to denormalize player identity** onto a `SealRecord` / `ArmageddonWinner` / `ArmageddonEventRecord`. The wipe will delete the player doc; the historical record has to stand on its own.
- **Self-prophecy attempts** — filing a prophecy where `authorId === fulfilledBy.userId` is allowed (you can predict yourself), but adding logic that *rewards* this would break the lore intent.

## Related player-facing surface

- `/game/armageddon` — the cast page, with seals diorama, success-chance preview, and the prophecies panel.
- Dashboard `SealsPanel` — surfaces the player's own progress toward the gate + the cumulative kingdom magic multiplier.
- Community feed — `seal_broken`, `armageddon_started`, `armageddon_completed`, `armageddon_winner`, `armageddon_cast_failed`, `prophecy_fulfilled` event kinds.

For player-facing documentation, see the `Endgame` tab in `/game/help`.
