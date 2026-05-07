# Castes

A caste is a faction with its own asymmetric strengths. Generals ships with **5 castes**: white, blue, black, red, green. The names are inherited from a tabletop tradition (Magic-style color identity); they describe a strategic flavor, not a real-world group.

This is the deepest contribution surface. Renaming a caste, redesigning its profile, or adding a sixth caste touches lore, units, spells, the setup page, and the combat math. **Read this whole doc before opening a caste PR.**

---

## Where caste content lives

| File | What's there |
|---|---|
| `lib/game/types.ts` | `Caste` type alias |
| `lib/game/content/castes.ts` | `CASTE_PROFILES` registry |
| `lib/game/content/units/{caste}/{type}.ts` | One unit definition per caste×type |
| `lib/game/content/spells/{caste}/{type}.ts` | One spell definition per caste×type |
| `lib/game/content/index.ts` | Imports + exposes `ALL_UNITS`, `ALL_SPELLS` |
| `app/game/setup/page.tsx` | The caste-pick UI |

Adding a caste means writing in **all six** of those places. Renaming a caste means updating the first one (the type) and renaming everything that references it.

---

## Schema

```ts
// lib/game/types.ts
export type Caste = "black" | "red" | "white" | "green" | "blue";

// lib/game/content/castes.ts
export interface CasteProfile {
  caste: Caste;
  tileCapacityMultiplier: number;
  unitTypeBonuses: Record<UnitType, number>;     // ground, siege, air
  spellTypeBonuses: Record<SpellType, number>;   // defense, offense, production
}
```

Existing profiles for reference:

```ts
white:  cap 1.00, units {g 1.20, s 0.90, a 1.00}, spells {def 1.30, off 0.85, prod 1.00}
blue:   cap 0.90, units {g 0.95, s 0.95, a 1.20}, spells {def 0.95, off 0.95, prod 1.30}
black:  cap 1.00, units {g 1.05, s 1.05, a 1.05}, spells {def 0.90, off 1.30, prod 0.90}
red:    cap 1.00, units {g 1.00, s 1.20, a 1.00}, spells {def 0.85, off 1.30, prod 0.95}
green:  cap 1.20, units {g 1.20, s 0.95, a 0.95}, spells {def 1.00, off 0.95, prod 1.10}
```

Read horizontally:
- **white** is a defensive specialist. Strong ground, very strong defense spells, weak offense spells.
- **blue** is a magic specialist. Strong air, very strong production spells (long-game economy).
- **black** is a generalist offensive caste. Slightly above average everywhere, very strong offense spells.
- **red** is a siege/burn specialist. Strong siege, very strong offense spells, fragile defense.
- **green** is the territory caste. Highest tile capacity (more units per tile), strong ground, balanced spells.

---

## The design constraints (read this carefully)

```
Sum of unitTypeBonuses across types  ≈ 3.00
Sum of spellTypeBonuses across types ≈ 3.15
tileCapacityMultiplier               ∈ [0.85, 1.20]
Each individual bonus                ∈ [0.85, 1.30]
```

The **sum constraint** matters more than the individual numbers. A caste with `{1.30, 1.30, 1.30}` for unit bonuses sums to 3.90 and dominates every type — that's not asymmetric balance, it's just power. Hold the sum near 3.00 and trade strengths for weaknesses.

A good rule of thumb: each caste gets **one strong slot per row** (1.20–1.30), one neutral (0.95–1.05), one weak (0.85–0.95). That sums to ~3.00 and makes the matchups feel different.

---

## Renaming an existing caste

If you want to rename "black" to "obsidian":

1. Update `Caste` in `lib/game/types.ts` (rename the literal).
2. Update the key in `CASTE_PROFILES` (`lib/game/content/castes.ts`).
3. Update `caste:` in all 3 unit files (`lib/game/content/units/obsidian/*.ts`) — and rename the folder.
4. Update `caste:` in all 3 spell files (`lib/game/content/spells/obsidian/*.ts`) — and rename the folder.
5. Update `id:` in those 6 content files (`black-ground-reaver` → `obsidian-ground-reaver`). **This breaks every existing player roster** — see "ID stability" below.
6. Update import paths in `lib/game/content/index.ts`.
7. Update the caste-pick UI in `app/game/setup/page.tsx` (label, swatch color).
8. Search for the string `"black"` across `app/game/**` and `lib/game/**` and update any UI labels, color tokens, or class names.
9. Rename narratives if any reference the caste by name (most don't — narratives are intentionally caste-neutral).

Run `npm run type-check && npm run lint && npm test -- __tests__/lib/game` after.

### ID stability — the load-bearing caveat

Player documents in Firestore store `caste: "black"` as a string. Tile and unit IDs include the caste prefix. **A rename breaks live game state** for players who already chose that caste. Acceptable migration paths:

- **Soft rename (recommended).** Keep the internal `Caste` literal as `"black"`, only change the display name + color in the UI. Then `caste: "obsidian"` shown to the player but stored as `"black"`.
- **Hard rename with backfill.** Write a migration script under `scripts/` that updates existing player documents. This is much more work and needs explicit reviewer signoff.

If you are doing a soft rename, you do **not** need to touch the IDs in the unit/spell files. Just update the display strings.

---

## Redesigning a caste's profile

If you want to retune black from "generalist offense" to "anti-air specialist":

```ts
// Original
black: {
  caste: "black",
  tileCapacityMultiplier: 1.0,
  unitTypeBonuses: { ground: 1.05, siege: 1.05, air: 1.05 },     // sum 3.15 — slightly hot
  spellTypeBonuses: { defense: 0.90, offense: 1.30, production: 0.90 },   // sum 3.10
},

// Retuned — anti-air emphasis, sum stays near 3.00
black: {
  caste: "black",
  tileCapacityMultiplier: 1.0,
  unitTypeBonuses: { ground: 0.90, siege: 0.85, air: 1.30 },     // sum 3.05
  spellTypeBonuses: { defense: 0.90, offense: 1.20, production: 1.05 },   // sum 3.15
},
```

Once you've changed the profile, **rebalance the unit + spell stats** for that caste so they fit the new identity. An anti-air black caste should probably also have a higher-attack air unit; the current Vampire Bat (`atk 14`) is fine for a generalist, low for a specialist. See [UNITS.md](UNITS.md) and [SPELLS.md](SPELLS.md) for the bands.

---

## Adding a sixth caste

This is a substantial PR. Expected scope:

1. **Pick a name and color.** Keep the lore non-political. Avoid: real ethnic groups, religions, geopolitical alignments. Acceptable: nature/element themes, abstract concepts (memory, silence), invented words.

2. **Add the literal** to `Caste` in `lib/game/types.ts`:
   ```ts
   export type Caste = "black" | "red" | "white" | "green" | "blue" | "amber";
   ```
   TypeScript will then flag every `switch` and `Record<Caste, T>` that's missing a branch. Walk those errors — there are several.

3. **Write the profile** in `lib/game/content/castes.ts`:
   ```ts
   amber: {
     caste: "amber",
     tileCapacityMultiplier: 1.0,
     unitTypeBonuses: { ground: 1.10, siege: 0.95, air: 0.95 },
     spellTypeBonuses: { defense: 1.10, offense: 1.10, production: 0.95 },
   },
   ```
   Sums to ≈ 3.00 and ≈ 3.15. Pick a flavor — what's amber's identity? "Memory caste, siege via ancient war machines"? Pick one and let it shape your unit/spell choices.

4. **Write 3 units** in `lib/game/content/units/amber/{ground,siege,air}.ts`. Stat bands in [UNITS.md](UNITS.md).

5. **Write 3 spells** in `lib/game/content/spells/amber/{defense,offense,production}.ts`. Stat bands in [SPELLS.md](SPELLS.md).

6. **Wire imports** in `lib/game/content/index.ts`. Both `ALL_UNITS` and `ALL_SPELLS` arrays need amber entries.

7. **Update the setup page** in `app/game/setup/page.tsx` to show the new caste in the picker.

8. **Pick a color/swatch.** This is in the setup-page UI and possibly in `app/game/tiles/page.tsx` (hex map color). Use a Tailwind color that doesn't clash with the existing five — amber, teal, purple, etc.

9. **Run the full test suite:**
   ```bash
   npm run type-check
   npm run lint
   npm test -- __tests__/lib/game
   ```
   All five existing castes' tests must still pass.

10. **Manual smoke.** On `/game/setup` pick the new caste, recruit one of each unit type, cast each spell type, attack a neutral tile.

Lore is welcome but optional in the PR — you can ship the mechanics first and a follow-up PR can expand the lore in unit/spell descriptions.

---

## Lore tone — what reads well, what doesn't

The five existing castes are intentionally elemental + abstract:

- **white** — light, hallowed, knightly. Sanctuary, Knights, Pegasus.
- **blue** — water, sky, moon. Tide-Guard, Storm Caller, Lunar Bloom.
- **black** — death, blood, bone. Reaver, Bone Hurler, Blood Tide.
- **red** — fire, fury, forge. Marauder, Pyre Mortar, Pyre Strike.
- **green** — wood, growth, territory. Warden, Catapult, Greenwood Bloom.

A new caste should fit the same shape. Things that work: amber/memory, slate/stone, sea/depths, void/silence, ash/aftermath. Things that don't: anything that maps to a real ethnic, religious, or political group.

---

## Things to ask before submitting

- Does the profile sum near 3.00 / 3.15?
- Does the caste have a clear identity in 1 sentence?
- Are the units and spells for the caste consistent with that identity?
- Have I run all three checks (type-check, lint, tests)?
- Have I tested it locally end-to-end (setup, recruit, spell, attack)?
