# Balance — guardrails for Generals content

This is the load-bearing doc. Every other content guide links back to the bands defined here. Read this first if you intend to add or tune numbers anywhere.

---

## Why bands matter

Generals is asymmetric — castes have different strengths and one is supposed to dominate certain matchups — but the **floor and ceiling** of every stat is fixed so no one strategy makes the game unplayable. The published bands give contributors freedom to flavor units and spells without accidentally landing a 4× outlier.

If your design needs to break a band, that's fine — but call it out in the PR description with the rationale, and expect a longer review.

---

## Combat math you should know before tuning

The combat resolver lives in `lib/game/combat.ts`. The simplified shape:

```
attackerPower = Σ(units[type].count × unit.attack × casteUnitBonus[type] × rpsMultiplier)
              + offenseSpell.baseStrength × magicMultiplier × casteSpellBonus.offense
              + offenseArtifact.baseStrength       (if used)

defenderPower = Σ(units[type].count × unit.defense × casteUnitBonus[type])
              + defenseSpell.baseStrength × magicMultiplier × casteSpellBonus.defense
              + defenseArtifact.baseStrength       (if armed)
              + tileCapacity * tileDefenseFactor   (military tiles only)

attackerRoll  = uniform(0.9, 1.1)   // seeded RNG, deterministic per (userId, turn)
defenderRoll  = uniform(0.9, 1.1)

if defender.unitsAlive < 0.5 × attacker.unitsAlive:
    defensePower *= 1.25            // underdog bonus

outcome = compare(attackerPower × attackerRoll, defensePower × defenderRoll)
```

**Knobs and where they live:**

| Constant | Value | File |
|---|---|---|
| `BASE_TILE_CAPACITY` | 500 | `lib/game/combat.ts` |
| `LAND_TYPE_CAPACITY_DELTA` | military +200, food 0, magic −100 | `lib/game/combat.ts` |
| `UNDERDOG_SIZE_RATIO` | 0.5 | `lib/game/combat.ts` |
| `UNDERDOG_DEFENSE_BONUS` | 0.25 | `lib/game/combat.ts` |
| `RNG_LOWER` / `RNG_RANGE` | 0.9 / 0.2 | `lib/game/combat.ts` |
| `magicMultiplier(n)` | 1 + 0.05·min(n,50) + 0.025·max(n−50,0) | `lib/game/combat.ts` |
| `unitCapFromFoodLands(n)` | 5·min(n,50) + 2.5·max(n−50,0) | `lib/game/combat.ts` |
| `ATTACK_TURN_COST` | 1 | `lib/game/data-server.ts` |
| `SPELL_TURN_COST` | 5 | `lib/game/data-server.ts` |
| `BUILD_UNITS_TURN_COST` | 5 | `lib/game/data-server.ts` |
| `BUILD_UNITS_PER_TURN` | 10 | `lib/game/data-server.ts` |
| `ARTIFACT_DROP_RATE` | 0.03 | `lib/game/artifacts.ts` |
| `RARITY_WEIGHTS` | common 70 / rare 22 / epic 7 / legendary 1 | `lib/game/artifacts.ts` |

These are not content. **Tuning them is a separate review** — open an issue before touching them.

---

## Rock-paper-scissors among unit types

```
air > ground > siege > air
```

Same-type matchups are neutral (1.0×). Beating-type pairs apply a multiplier inside `combat.ts`. If you add a unit, you do **not** add a new type — every unit must be `ground | siege | air`. The RPS structure is baked into the combat math.

---

## Stat bands by content type

These are the ranges you should stay inside. Each pointer doc (`UNITS.md`, `SPELLS.md`, `ARTIFACTS.md`, `CASTES.md`) repeats these for convenience, but this is the source of truth.

### Units

| Stat | Recommended | Hard floor / ceiling in code | Notes |
|---|---|---|---|
| `attack` | 10 – 18 | 9 – 22 | Siege rises toward the top; air is mid; ground is low–mid. The Inferno Engine (red siege, attack 22) is the explicit ceiling — most units stay ≤ 18. |
| `defense` | 5 – 13 | 5 – 14 | Ground is highest; siege is lowest. The Pikeman (white ground, defense 14) is the ceiling. |
| `hp` | 7 – 12 | 7 – 12 | Ground is highest; siege/air are lower. |
| Sum (att+def+hp) | 30 – 35 | 29 – 35 | Roughly constant per unit; flavor differences come from how the budget is split, not the total. |

A unit must specialize. Don't ship one that's at the top of all three bands — pick a strength, accept a weakness. If your design needs to bend a recommended band (like the Inferno Engine bends `attack`), that's fine, but call it out in your PR.

### Spells

| Type | Caste's hard primary | Caste's soft primary | Caste's off-suit | Rationale |
|---|---|---|---|---|
| Offense | 65–80 | (n/a) | 25–40 | The "main weapon" of red/black; weak utility for the others. |
| Defense | 55–65 | 35–45 | 25–35 | White's specialty; green's softer defense; weak for offense-focused castes. |
| Production | 60–75 | 45–55 | 25–40 | Blue's specialty; green's softer production; modest for everyone else. |

Rule of thumb: **each caste gets exactly one strong spell type** (their flavor) and two weaker ones. White/blue/black/red run their primary at the hard band (60–75); green runs its primary softer (50) and its off-suits higher (35–40) — green trades a sharp ceiling for being playable in every slot. The runtime multiplies `baseStrength` by `magicMultiplier(magicLandCount) × spellTypeBonus[caste][type]`, so a 70 baseStrength offense spell on a 30-magic-land black caste lands at roughly `70 × 2.5 × 1.3 ≈ 228` effective power. That's why the bands are tight — small base changes amplify a lot.

### Artifacts (single-use, caste-agnostic)

| Rarity | `baseStrength` band | Drop weight |
|---|---|---|
| Common | 25–40 | 70 |
| Rare | 60–82 | 22 |
| Epic | 115–142 | 7 |
| Legendary | 200–240 | 1 |

`baseStrength` is added flat to the relevant combat side at use-time (offense → attacker, defense → defender, production → unit cap or magic multiplier, utility → contextual). No caste or magic-land scaling applies to artifacts. Since legendaries land at ~1 in 3,300 turn-spends (3% drop × 1% rarity), they can be game-changing — but a contributor proposing a 500-baseStrength legendary will get pushback. The cap is 240 for a reason.

### Castes

| Field | Band |
|---|---|
| `tileCapacityMultiplier` | 0.85 – 1.20 |
| `unitTypeBonuses[t]` | 0.85 – 1.30 |
| `spellTypeBonuses[t]` | 0.85 – 1.30 |
| Sum of `unitTypeBonuses` across types | ≈ 3.00 |
| Sum of `spellTypeBonuses` across types | ≈ 3.15 |

The sum constraint matters more than the individual numbers. A caste that sums to 3.6 across unit bonuses is meaningfully stronger than one at 3.0 even if no individual number breaks the band. See [CASTES.md](CASTES.md) for the full design pattern.

### Buildings

Currently empty — `lib/game/content/buildings/index.ts` exports `[]`. The v2 contract is:

| Field | Band | Notes |
|---|---|---|
| `capacityBonus` | 50 – 200 | Adds flat to a tile's effective unit capacity. |
| `unitTypeAffinity.multiplier` | 1.05 – 1.20 | Multiplies that unit type's combat stats on the tile. |

A building should grant **one** of those, not both. Stacking is not designed for.

---

## RNG and reproducibility

The artifact roll, attack roll, narrative pick, and frontier-candidate sample all use a seeded mulberry32 PRNG (`makeSeededRng` in `lib/game/combat.ts`). The seed format is:

```
artifact:${userId}:${turnsSpentTotal}     // bulk + per-step both use this
attack:${userId}:${turnsSpentTotal}       // combat resolution
explore:${userId}:${turnsSpentTotal}      // narrative pick
```

If you add new content that needs RNG, **reuse this scheme**. Don't introduce new seed shapes. The bulk-vs-per-step parity test in `__tests__/lib/game/artifacts.test.ts` pins the artifact contract — the same pattern applies elsewhere.

---

## When in doubt, model it

If you're not sure your numbers are balanced, sketch a worst-case scenario:

> "If I'm a caste-X player with 50 magic lands, full unit cap from food, and I cast my new offense spell with a legendary offense artifact equipped, what's the total power?"

If that number is above ~3,000, you're outside the design space. Most fights resolve in the 500–1,500 range; the underdog bonus and the 0.9–1.1 RNG band are calibrated for that.

---

## Armageddon balance

The end-game adds its own balance surface. See [ARMAGEDDON.md](ARMAGEDDON.md) for the full mechanic; the levers to be careful with:

- **10,000-tile gate** (`ARMAGEDDON_TILE_GATE` in `lib/game/content/armageddon.ts`) — the only structural gate on casting. Lowering it compresses the late game; raising it makes it a grind for one or two players.
- **Magic-multiplier success curve** — folds raw `magic`-type tiles + magic-hero specialty bonuses (`spellcasting` ×1.25, `armageddon` ×2.0) + active production spells. Targets ~3–5 casts per seal break at typical late-game magic optimization.
- **Lottery ticket formula** `tilesHeld × (1 + sealsBroken)` — a player who breaks one seal gets 2× the lottery weight, capped only by their tile count. The +1 base means a non-breaker with lots of tiles still has a real shot, which is intentional.
- **Hero `armageddon` specialty** (×2 magic multiplier) is the single biggest stat in the game. Treat changes to it as P0 balance work.

## Non-turn activities — intentionally non-impactful on balance

The ten non-turn activities ([NON_TURN_ACTIVITIES.md](NON_TURN_ACTIVITIES.md)) — profiles, titles, reactions, chapters, epitaphs, inscriptions, caste chat, dispatches, pacts, prophecies — are deliberately **not** gameplay-impactful. Titles are cosmetic. Pacts are reputational, not enforced. Prophecies grant a cosmetic Seer / Oracle title and nothing else.

When extending the non-turn surface, keep this invariant: don't smuggle gameplay through cosmetic features. If you find yourself wanting a reaction to grant +1 stamina, you've drifted — surface that as a separate turn-costed mechanic instead.
