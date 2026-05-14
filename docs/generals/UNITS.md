# Units

A unit is a stack archetype that can be recruited on military tiles and sent into combat. Generals ships with **15 units** — 5 castes × 3 types (`ground | siege | air`). Each caste has exactly one of each type; this is enforced by `getUnitForCasteAndType` in `lib/game/content/index.ts`.

---

## Where unit content lives

```
lib/game/content/units/
├── black/
│   ├── air.ts      → exports BLACK_AIR_UNIT
│   ├── ground.ts   → exports BLACK_GROUND_UNIT
│   └── siege.ts    → exports BLACK_SIEGE_UNIT
├── blue/    (air, ground, siege)
├── green/   (air, ground, siege)
├── red/     (air, ground, siege)
└── white/   (air, ground, siege)
```

Each file exports a single `UnitDefinition` constant. The registry (`lib/game/content/index.ts`) imports all 15 and exposes them via `ALL_UNITS`, `UNITS_BY_ID`, and `getUnitForCasteAndType`.

---

## Schema

```ts
export const BLACK_GROUND_UNIT: UnitDefinition = {
  id: "black-ground-reaver",         // unique, kebab-case, format: ${caste}-${type}-${slug}
  caste: "black",                    // must match folder
  type: "ground",                    // must match filename
  name: "Reaver",                    // display name
  attack: 12,                        // see bands
  defense: 10,                       // see bands
  hp: 9,                             // see bands
  description: "Bone-armored shock infantry that swarms past the corpses of its own.",
};
```

Pulled from `lib/game/types.ts`:

```ts
export interface UnitDefinition {
  id: string;
  caste: Caste;
  type: UnitType;
  name: string;
  attack: number;
  defense: number;
  hp: number;
  description: string;
}
```

---

## Stat bands

| Stat | Range in code | Typical specialization |
|---|---|---|
| `attack` | 9 – 22 | Siege 16–22, air 13–16, ground 9–12 |
| `defense` | 5 – 14 | Ground 10–14, air 7–9, siege 5–7 |
| `hp` | 7 – 12 | Ground 9–12, air 7–8, siege 7–9 |
| Sum | 29 – 35 | Hold the budget constant; redistribute for flavor |

A unit must specialize. Don't ship one that's max in all three — pick a strength, accept a weakness. See [BALANCE.md](BALANCE.md) for the underlying combat math.

For reference, here are the existing units (read-only — don't edit other people's lore for flavor):

| Caste | Type | Name | atk / def / hp |
|---|---|---|---|
| white | ground | Pikeman | 9 / 14 / 11 |
| white | siege | Bombardier | 16 / 7 / 9 |
| white | air | Pegasus Knight | 13 / 9 / 8 |
| blue | ground | Stormcaller | 11 / 10 / 9 |
| blue | siege | Skyglass Catapult | 17 / 5 / 8 |
| blue | air | Sky Reader | 16 / 7 / 7 |
| black | ground | Reaver | 12 / 10 / 9 |
| black | siege | Bone Hurler | 18 / 6 / 7 |
| black | air | Vampire Bat | 14 / 8 / 7 |
| red | ground | Marauder | 12 / 10 / 10 |
| red | siege | Inferno Engine | 22 / 5 / 8 |
| red | air | Phoenix Talon | 15 / 8 / 7 |
| green | ground | Warden | 10 / 13 / 12 |
| green | siege | Wood-Spitter | 16 / 7 / 9 |
| green | air | Eagle Scout | 13 / 9 / 8 |

**Outliers worth knowing:** the Pikeman sits at the floor of `attack` (9) and the ceiling of `defense` (14) — it's the most pure-defensive unit in the game. The Inferno Engine sits at the ceiling of `attack` (22) with the floor of `defense` (5) — it's the most fragile-but-deadly siege unit. Both bend the bands to make their identity legible. New units should generally stay inside 10–18 attack and 5–13 defense; if you need to push to the edge, justify it in your PR.

---

## Adding or editing a unit

There are exactly 15 unit slots — one per (caste, type) pair — so you cannot **add** a unit unless you also add a new caste (see [CASTES.md](CASTES.md)). What you **can** do:

- **Tweak stats** within the bands. Open a PR explaining the design intent.
- **Rename** a unit and rewrite its description. Keep the `id` stable so existing player rosters don't break.
- **Add a new caste**, which adds 3 unit slots. See [CASTES.md](CASTES.md).

### Renaming an existing unit

```ts
// Before
export const BLACK_GROUND_UNIT: UnitDefinition = {
  id: "black-ground-reaver",
  ...
  name: "Reaver",
  description: "Bone-armored shock infantry that swarms past the corpses of its own.",
};

// After — rename + new flavor, id stays the same
export const BLACK_GROUND_UNIT: UnitDefinition = {
  id: "black-ground-reaver",         // do NOT change
  ...
  name: "Bone Reaver",
  description: "Black-iron infantry that fights with the calm of the already-dead.",
};
```

### Tuning stats

```ts
// Original
attack: 12, defense: 10, hp: 9,    // sum 31, ground specialist

// Acceptable retune — same sum, redistributed
attack: 11, defense: 11, hp: 9,    // softer attack, harder defense

// NOT acceptable — out of band
attack: 22, defense: 10, hp: 9,    // attack > 18
```

---

## Combat-side context (what your numbers do)

When the server resolves an attack:

1. Sum unit-side power: `Σ count[type] × unit.attack × casteUnitBonus[type] × rpsMultiplier`. Same for defense.
2. Add spell power, artifact power, tile capacity adjustments.
3. Multiply each side by a seeded RNG roll in [0.9, 1.1].
4. Apply the underdog bonus (×1.25 to defense) if `defender.unitsAlive < 0.5 × attacker.unitsAlive`.
5. Compare totals and decide outcome.

So a unit's `attack` is multiplied by **caste's unit-type bonus** (0.85–1.30) and **RPS multiplier** when it's the beating type. A black ground unit with attack 12 attacking a green siege defender gets `12 × 1.05 (black ground bonus) × ground-beats-siege multiplier`. Don't try to invert this off-line — trust the bands and read `lib/game/combat.ts` if you need the exact constants.

---

## Testing

Run the content tests after editing:

```bash
npm test -- __tests__/lib/game
```

There's no per-unit test (units are just data), but `combat.test.ts` exercises the resolver with realistic stacks and will fail if you accidentally land a stat that breaks unit caps or the RNG bounds.

If you want to manually verify your unit pulls its weight, log in locally, switch caste on `/game/setup`, recruit your unit on `/game/recruit`, and attack a neutral tile.
