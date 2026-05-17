# Buildings (tile upgrades)

Buildings are the **per-caste, per-land-type structures** that get placed when a tile is assigned. There are 15 today — one for each `caste × landType` combination (5 castes × 3 productive land types: `military`, `food`, `magic`).

`lib/game/content/buildings/index.ts` re-exports `BUILDING_SEEDS` from `seeds.ts`. The seed list is the contract — every productive land type for every caste must have exactly one entry, and the `id` follows the convention `<caste>-<landType>-building`.

This doc tells you what shape buildings take, where they hook into combat, and what bands they live in.

---

## Where building content lives

```
lib/game/content/buildings/
└── index.ts        → exports BUILDINGS array (currently empty)
```

For a small number of buildings, just add objects directly to the array in `index.ts`. Once we have 5+, split into per-caste files following the `units/` and `spells/` pattern (`buildings/black/forge.ts`, `buildings/index.ts` re-exports).

---

## Schema

```ts
export const BUILDINGS: BuildingDefinition[] = [
  {
    id: "neutral-watchtower",        // unique, kebab-case, format: ${caste-or-neutral}-${slug}
    caste: "neutral",                 // "neutral" or one of the five castes
    name: "Watchtower",
    description: "A timber tower that lets defenders see attackers coming.",
    capacityBonus: 80,                // optional — flat add to tile's effective unit capacity
    unitTypeAffinity: undefined,      // optional — multiplier for one unit type's combat stats
  },
];
```

Pulled from `lib/game/types.ts`:

```ts
export interface BuildingDefinition {
  id: string;
  caste: Caste | "neutral";
  name: string;
  description: string;
  capacityBonus?: number;
  unitTypeAffinity?: { type: UnitType; multiplier: number };
}
```

A building should grant **exactly one** of `capacityBonus` or `unitTypeAffinity`. Stacking is not designed for and will get pushback.

---

## What buildings do at runtime

In `lib/game/combat.ts`:

- `computeTileCapacity(landType, caste, upgradeIds)` walks `upgradeIds` and adds each building's `capacityBonus` to the tile's capacity. This raises the unit cap on that specific tile.
- The combat resolver multiplies a unit's stats by `unitTypeAffinity.multiplier` if the building grants it for that unit's type. So a "Forge" with `{ type: "siege", multiplier: 1.15 }` makes siege units on that tile hit 15% harder.

`upgradeIds` lives on `GameTile.upgradeIds: string[]`. A tile can hold multiple upgrades, but the runtime sums `capacityBonus` linearly — there's no diminishing returns. **Keep individual bonuses tight** so stacking doesn't go wild.

---

## Stat bands

| Field | Band | Notes |
|---|---|---|
| `capacityBonus` | 50 – 200 | Tile cap is `BASE_TILE_CAPACITY + landTypeDelta + capacityBonus`. A military tile is 700 base; +200 brings it to 900, which is meaningful but not game-ending. |
| `unitTypeAffinity.multiplier` | 1.05 – 1.20 | A 1.20 multiplier on top of caste bonuses (up to 1.30) and RPS multipliers can swing combat heavily. Keep most affinities in 1.05–1.10. |

If you propose a building that grants both `capacityBonus: 200` AND `unitTypeAffinity.multiplier: 1.20`, the answer is no. Pick one.

---

## Caste vs. neutral

- **`"neutral"`** buildings can be built on any tile by any player. Use this for generic infrastructure (watchtowers, forts).
- **Caste-locked** buildings only work for that caste. Use this for thematic buildings tied to a faction's lore (a "Black Mausoleum" for the black caste, etc.).

The runtime does **not** today enforce caste-locking on buildings — that's a v2 mechanic. If your contribution depends on the lock being enforced, open an issue first.

---

## Adding a building — example

```ts
// lib/game/content/buildings/index.ts
export const BUILDINGS: BuildingDefinition[] = [
  {
    id: "neutral-watchtower",
    caste: "neutral",
    name: "Watchtower",
    description: "Timber tower granting defenders an early warning of incoming columns.",
    capacityBonus: 80,
  },
  {
    id: "red-forge",
    caste: "red",
    name: "Forge",
    description: "A red-caste smithy that hardens siege engines beyond their normal tolerances.",
    unitTypeAffinity: { type: "siege", multiplier: 1.10 },
  },
];
```

Then run:

```bash
npm run type-check
npm test -- __tests__/lib/game
```

`combat.test.ts` covers `computeTileCapacity` and the unit-type-affinity multiplier path. If your new building breaks the tile-capacity math (e.g., negative result, NaN), it'll fail there.

---

## What's NOT in scope yet

These are runtime-side gaps. If your contribution wants any of them, file an issue first — they're more than a content PR.

- **A "build a building" UI flow.** The current `app/game/recruit/page.tsx` only handles unit recruitment. There's no page for placing a building on a tile yet.
- **A turn cost / resource cost for building.** The runtime doesn't model materials. Buildings would currently need a flat turn-cost similar to spells.
- **Demolition.** No way to remove an upgrade from a tile yet.

A reasonable v2 addition path: stub a `POST /api/game/build-upgrade` that costs N turns and adds the upgrade ID to `GameTile.upgradeIds`. Until that ships, building definitions are dormant.

---

## Lore tone for buildings

Same register as units and spells: 1-sentence description, evocative but functional. Look at the existing unit descriptions for tone — "Bone-armored shock infantry that swarms past the corpses of its own" is the style. Don't write a paragraph.
