# Spells

A spell is a one-shot effect bound to a caste and a type. Generals ships with **15 spells** — 5 castes × 3 types (`offense | defense | production`). Each caste has exactly one of each type; this is enforced by `getSpellForCasteAndType` in `lib/game/content/index.ts`.

---

## Where spell content lives

```
lib/game/content/spells/
├── black/
│   ├── defense.ts      → exports BLACK_DEFENSE_SPELL
│   ├── offense.ts      → exports BLACK_OFFENSE_SPELL
│   └── production.ts   → exports BLACK_PRODUCTION_SPELL
├── blue/    (defense, offense, production)
├── green/   (defense, offense, production)
├── red/     (defense, offense, production)
└── white/   (defense, offense, production)
```

---

## Schema

```ts
export const BLACK_OFFENSE_SPELL: SpellDefinition = {
  id: "black-offense-blood-tide",      // unique, kebab-case, format: ${caste}-${type}-${slug}
  caste: "black",                      // must match folder
  type: "offense",                     // must match filename
  name: "Blood Tide",                  // display name
  baseStrength: 70,                    // see bands
  description: "A rolling crimson surge that breaks lines and resolve.",
};
```

Pulled from `lib/game/types.ts`:

```ts
export interface SpellDefinition {
  id: string;
  caste: Caste;
  type: SpellType;          // "defense" | "offense" | "production"
  name: string;
  baseStrength: number;
  description: string;
}
```

---

## What spell types do

| Type | Effect | Where applied | Turn cost |
|---|---|---|---|
| `offense` | Adds flat power to attacker total at attack-time | `lib/game/combat.ts` | 5 (paid when attacking with the spell) |
| `defense` | Adds flat power to defender total when armed on a tile | `lib/game/combat.ts` | 5 (paid at arm-time) |
| `production` | Boosts unit cap or magic multiplier for `PRODUCTION_SPELL_DURATION_TURNS` (see `lib/game/turns.ts`) | Player-wide buff | 5 (paid at cast-time) |

The runtime computes effective spell power as:

```
effectivePower = baseStrength × magicMultiplier(magicLandCount) × spellTypeBonus[caste][type]
```

So a spell with `baseStrength: 70` cast by a black caste (offense bonus 1.30) with 30 magic lands (multiplier ≈ 2.5) lands at roughly `70 × 2.5 × 1.30 ≈ 228` effective power. **Small base changes amplify a lot** — that's why the bands are tight.

---

## Stat bands by caste-type pairing

Each caste has exactly **one strong spell type** (their flavor) and two weaker ones.

| Caste | Strong type | Off-suit |
|---|---|---|
| white | defense | offense, production |
| blue | production | defense, offense |
| black | offense | defense, production |
| red | offense | defense, production |
| green | production | defense, offense |

| Slot | `baseStrength` band |
|---|---|
| Caste's strong type (hard primary) | 60 – 80 |
| Caste's strong type (soft primary, e.g. green) | 40 – 55 |
| Caste's off-suit type | 25 – 40 |

**Hard vs. soft primaries:** white/blue/black/red run their flavor type at 60–75 and their off-suits at 25. Green is intentionally softer — its primary (production, Bloom = 50) is below the hard band, and its off-suits (defense Thornwall = 40, offense Stampede = 35) are higher. Green trades a clear ceiling for being playable in every spell slot. If you tune green spells, keep that shape; if you tune a non-green caste's primary, target 60–75.

For reference, here are the existing spells:

| Caste | Type | Name | baseStrength |
|---|---|---|---|
| white | defense (★) | Sanctuary | 60 |
| white | offense | Smite | 25 |
| white | production | Harvest Festival | 25 |
| blue | defense | Mirror Veil | 30 |
| blue | offense | Tempest | 30 |
| blue | production (★) | Arcane Surge | 70 |
| black | defense | Shadow Pact | 25 |
| black | offense (★) | Blood Tide | 70 |
| black | production | Necromancy | 30 |
| red | defense | Fire Wall | 25 |
| red | offense (★) | Inferno | 75 |
| red | production | Forge Boon | 30 |
| green | defense | Thornwall | 40 |
| green | offense | Stampede | 35 |
| green | production (★) | Bloom | 50 |

(★ = the caste's primary strength.)

Note: the existing whites/blacks/reds run their primary at the upper end and their off-suit at the lower end. Greens and blues are softer-edged. If you tune a spell, **stay consistent with the caste's archetype** — don't, e.g., push white's offense to 60. White is a defensive caste; that's the whole shape of the design.

---

## Adding or editing a spell

There are exactly 15 spell slots — one per (caste, type) pair — so you cannot **add** a spell unless you also add a new caste (see [CASTES.md](CASTES.md)). What you **can** do:

- **Tweak baseStrength** within the band for that slot.
- **Rename** a spell and rewrite its description. Keep the `id` stable.
- **Add a new caste**, which adds 3 spell slots.

### Renaming and re-flavoring an existing spell

Look up the existing `id` in the spell file before editing — never invent one.

```ts
// Before — value comes from lib/game/content/spells/red/offense.ts
export const RED_OFFENSE_SPELL: SpellDefinition = {
  id: "red-offense-inferno",
  ...
  name: "Inferno",
  description: "...",
};

// After — same id, new name + flavor
export const RED_OFFENSE_SPELL: SpellDefinition = {
  id: "red-offense-inferno",            // do NOT change
  ...
  name: "Cinder March",
  description: "Embers fall ahead of your column. Where they land, banners burn before riders arrive.",
};
```

### Tuning baseStrength

```ts
// Original — black offense (primary) at 70
baseStrength: 70,

// Acceptable retune
baseStrength: 75,  // top of the strong-type band

// NOT acceptable
baseStrength: 90,  // out of band; would dominate matchups
```

---

## Production spells specifically

Production spells don't add power to combat — they buff the player for a fixed duration. Read `lib/game/turns.ts` for the exact mechanics. The `baseStrength` of a production spell maps to a unit-cap boost and/or a magic-multiplier boost; the bigger the number, the bigger the buff.

The duration is fixed (`PRODUCTION_SPELL_DURATION_TURNS`) — don't try to design a "longer-lasting weaker buff." That's a runtime change, not a content change.

---

## Testing

Same as units — run:

```bash
npm test -- __tests__/lib/game
```

To verify in-game, log in, pick the caste whose spell you tuned, and on `/game/spells` either **arm** a defense spell on one of your tiles or **cast** a production spell. Offense spells are tested by attacking with one selected (`/game/tiles/[tileId]` enemy panel).
