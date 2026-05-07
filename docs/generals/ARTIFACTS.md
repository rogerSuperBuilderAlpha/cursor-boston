# Artifacts

Artifacts are single-use, caste-agnostic items found on a turn-spend. Unlike units and spells (which are bound to castes and have fixed slots), artifacts are an open-ended content surface — **you can add as many as you want**, as long as they fit the rarity bands. Today's repo has roughly: 17 common, 11 rare, 7 epic, 4 legendary.

This is the easiest place to contribute lore + mechanics together.

---

## Where artifact content lives

```
lib/game/content/artifacts/
├── common.ts        → exports COMMON_ARTIFACTS    (array)
├── rare.ts          → exports RARE_ARTIFACTS      (array)
├── epic.ts          → exports EPIC_ARTIFACTS      (array)
├── legendary.ts     → exports LEGENDARY_ARTIFACTS (array)
└── index.ts         → concatenates into ALL_ARTIFACTS + ARTIFACTS_BY_RARITY
```

To add an artifact, append a new object to the relevant rarity array. No registry edits needed — `index.ts` picks it up automatically.

---

## Schema

```ts
export const COMMON_ARTIFACTS: ArtifactDefinition[] = [
  // ... existing artifacts ...
  {
    id: "common-windworn-helm",       // unique, kebab-case, format: ${rarity}-${slug}
    name: "Windworn Helm",
    rarity: "common",
    type: "defense",                   // "offense" | "defense" | "production" | "utility"
    baseStrength: 32,                  // see bands
    description: "A dented half-helm that sings when struck.",
    flavorOnFind:
      "A goatherd had been using it as a milk pail. He hands it over for a fair trade and seems pleased to be rid of it.",
  },
];
```

Pulled from `lib/game/types.ts`:

```ts
export interface ArtifactDefinition {
  id: string;
  name: string;
  rarity: ArtifactRarity;       // "common" | "rare" | "epic" | "legendary"
  type: ArtifactType;            // "offense" | "defense" | "production" | "utility"
  baseStrength: number;
  description: string;
  flavorOnFind: string;          // narrative line shown when the artifact is found
}
```

---

## What each artifact type does

| Type | Effect at use-time |
|---|---|
| `offense` | Flat add to attacker's combat total |
| `defense` | Flat add to defender's combat total when used on a tile |
| `production` | Flat add to unit cap **or** magic multiplier (interpretation varies by artifact) |
| `utility` | Contextual — extra exploration, free turn refunds, etc.; described in flavor text |

Artifacts are **not** scaled by caste bonuses or magic multipliers. The number you write is the number that lands. That's why the bands are tight.

---

## Rarity bands and drop economy

| Rarity | `baseStrength` band | Drop weight | Approx. drops per 100 turns |
|---|---|---|---|
| `common` | 25 – 40 | 70 | 2.1 |
| `rare` | 60 – 82 | 22 | 0.66 |
| `epic` | 115 – 142 | 7 | 0.21 |
| `legendary` | 200 – 240 | 1 | 0.03 |

The base drop rate is `ARTIFACT_DROP_RATE = 0.03` (3% per turn-spend) — see `lib/game/artifacts.ts`. Multiply by the rarity's share of the 100-weight pool to get the per-rarity rate. A legendary lands once every ~3,300 turn-spends in the wild — that's the design intent. They're supposed to feel like genuine events.

If you propose a 500-baseStrength legendary "to make it special," the answer is no. Legendaries are already special by being rare. The cap exists so a single lucky drop doesn't decide a multiplayer match.

---

## Flavor text — `flavorOnFind` is the heart of the artifact

`description` shows in the inventory ("a small, dented shield"). `flavorOnFind` shows the moment you discover it ("It was being used as a roof tile by a goatherd…"). The `flavorOnFind` line is what makes the artifact feel like a story.

Tone guide:
- **Common.** Mundane discovery, slight surreal edge. A goatherd, a child, a dented thing in the mud. 1–2 sentences.
- **Rare.** Mid-stakes. Someone gives it to you, or you find it where it shouldn't be. 1–2 sentences.
- **Epic.** Eerie, half-explained. Witnesses disagree. The object behaves slightly impossibly. 2–3 sentences.
- **Legendary.** Quiet, almost mythic. The story refuses to fully explain itself. The artifact has agency. 2–4 sentences.

Read the existing artifacts in `legendary.ts` for the tone target. The "Crown of the First General" entry is a good example: spare, suggestive, slightly haunted.

---

## Adding a new artifact — example

Here's a complete diff for adding a new common defense artifact:

```ts
// lib/game/content/artifacts/common.ts
export const COMMON_ARTIFACTS: ArtifactDefinition[] = [
  // ... existing ones ...
  {
    id: "common-twice-buried-shield",
    name: "Twice-Buried Shield",
    rarity: "common",
    type: "defense",
    baseStrength: 36,
    description: "A round shield that has clearly been pulled out of the earth more than once.",
    flavorOnFind:
      "Your scouts dig it up by accident while pitching a tent. The previous owner had buried it carefully; whoever buried it before that did the same.",
  },
];
```

Then run:

```bash
npm test -- __tests__/lib/game/artifacts.test.ts
```

The test suite verifies:
- All artifact IDs are unique
- Every artifact has the required fields populated
- Rarity is one of the four valid values
- Type is one of the four valid values
- Drop rate over 5,000 rolls is within ±1.5% of nominal
- Rarity distribution roughly matches `RARITY_WEIGHTS`

If your PR breaks any of those, the test fails. Fix the data; don't loosen the test.

---

## Things that don't ship

- **Cursed / negative artifacts.** Artifacts are always good. The mechanic isn't there to roll a bad thing on a turn-spend.
- **Caste-specific artifacts.** Artifacts are caste-agnostic by design. If your idea reads "the Blue-only Kelp Crown," redesign it as a generic-defense artifact whose flavor leans aquatic.
- **Permanent artifacts.** All artifacts are single-use. The runtime tracks `used` and `usedAtTurn`. Don't propose a passive item.
- **Artifacts that change other players' state.** Combat already does that. Artifact effects apply to the using player only.

---

## Testing your artifact

1. Add it.
2. `npm test -- __tests__/lib/game/artifacts.test.ts`
3. Local smoke: log in, run frontier explore on `/game` repeatedly. At 3% drop with heavy common weighting, you'll hit a common artifact within 30–50 turns. Check `/game/artifacts` for the inventory; click your new artifact to confirm flavor text renders.
4. To test rare/epic/legendary, temporarily bump `ARTIFACT_DROP_RATE` to 1.0 in `lib/game/artifacts.ts` **locally only** — never commit that change.
