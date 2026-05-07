# Lore — descriptions, narratives, flavor text

Lore is the contribution surface most likely to land cleanly: every unit, spell, artifact, and turn action carries a short prose payload that you can write or rewrite. No mechanics change, no balance review, no test failures unless you accidentally break a string literal.

---

## Three places lore lives

### 1. Content descriptions

Every `UnitDefinition`, `SpellDefinition`, `ArtifactDefinition`, and `BuildingDefinition` has a `description` field. This is the one-line blurb shown next to the item in the inventory and recruit/spell pages.

| Type | File | Field |
|---|---|---|
| Unit | `lib/game/content/units/{caste}/{type}.ts` | `description` |
| Spell | `lib/game/content/spells/{caste}/{type}.ts` | `description` |
| Artifact | `lib/game/content/artifacts/{rarity}.ts` | `description` |
| Building | `lib/game/content/buildings/index.ts` | `description` |

Tone target: **one sentence, evocative, functional.** Look at the existing descriptions for style:

> "Bone-armored shock infantry that swarms past the corpses of its own."
> "A trebuchet wound from femurs and sinew. Still warm."
> "A river-smoothed stone with three runes scratched into it."

Don't write a paragraph. Don't explain mechanics in the description ("This unit has +20% attack vs. siege" goes in code, not in lore).

### 2. Artifact `flavorOnFind`

Artifacts have a second prose field, `flavorOnFind`, shown the moment you discover one. This is where the **story** of the artifact lives. Tone scales with rarity:

- **Common.** Mundane, slight surreal edge. 1-2 sentences.
- **Rare.** Mid-stakes. 1-2 sentences.
- **Epic.** Eerie, half-explained. Witnesses disagree. 2-3 sentences.
- **Legendary.** Quiet, almost mythic. The story refuses to fully explain itself. 2-4 sentences.

Read `legendary.ts` for the high-end target tone. The "Crown of the First General" entry is the model: spare, suggestive, slightly haunted.

### 3. Turn-report narratives

Every turn-action (explore, build, distribute, spell-arm, spell-produce, attack) generates a one-line narrative for the player's report log. These live in:

```
lib/game/content/narratives/
├── explore.ts            → EXPLORE_NARRATIVES
├── build.ts              → BUILD_NARRATIVES
├── distribute.ts         → DISTRIBUTE_NARRATIVES
├── spell-arm.ts          → SPELL_ARM_NARRATIVES
├── spell-produce.ts      → SPELL_PRODUCE_NARRATIVES
└── attack-fragments.ts   → ATTACK_OPENINGS, ATTACK_MIDS, ATTACK_OUTCOMES
```

Each non-attack file follows the same pattern:

```ts
const HUMAN_X_NARRATIVES: string[] = [
  // Hand-curated lines. Add new lines here.
];

const AI_X_NARRATIVES: string[] = [
  // AI-generated stock lines. Replace with HUMAN lines as we go.
];

export const X_NARRATIVES = [...HUMAN_X_NARRATIVES, ...AI_X_NARRATIVES];
```

The runtime picks one line at random (seeded) per turn. **Add new lines to the `HUMAN_*` block.** Don't edit the `AI_*` block — those are placeholders we want to retire over time, but rewriting them line-by-line is churn without value. If you want to retire an AI line, copy it into the human block, rewrite it there, and delete it from the AI block in the same PR.

### Attack narratives are templated

`attack-fragments.ts` is structured differently because attack reports need to reference real numbers (units sent, casualties, outcome). The runtime picks one fragment from each of `ATTACK_OPENINGS`, `ATTACK_MIDS`, `ATTACK_OUTCOMES`, in order, and stitches them together with the structured details.

Example final report:
> "Your forces marched out before dawn. After a brutal skirmish across the border line, the tile fell to your colors. You lost 23 ground; they lost 41."

When adding fragments:
- **Openings** are about the launch ("Your forces marched out before dawn.")
- **Mids** are about the engagement ("After a brutal skirmish across the border line,")
- **Outcomes** are about the result; provide variants for each `AttackOutcome`: `captured | repelled | stalemate`

Each fragment must read naturally when joined to any other fragment in its sibling pools. Don't write a mid that contradicts a possible opening or outcome.

---

## Tone guide for the whole game

Generals' lore lives in a vague pre-industrial world: banners, columns, captains, scouts, smiths, sergeants, priests, kings. Read 5 existing units and 5 existing artifacts before writing anything new — you'll absorb the register.

What works:
- Sensory detail (smell of wood smoke, frost on the morning grass)
- Specific small actions (a quartermaster signs a ledger, a child presses something into a hand)
- Restraint about magic (it happens, it's described matter-of-factly, no one explains it)
- Time slipping (centuries-old grass, cold ash, dust still rising)

What doesn't:
- Modern military terminology ("regiment-strength force conducted a frontal assault")
- Direct mechanical descriptions ("granting +30 attack")
- Gore for gore's sake (death is present, but not graphic)
- Real-world politics, religions, or ethnic groups

---

## Adding a HUMAN narrative line — example

```ts
// lib/game/content/narratives/explore.ts
const HUMAN_EXPLORE_NARRATIVES: string[] = [
  // ... existing lines ...
  "Your scouts find a stone bridge over a stream that vanishes underground a hundred yards downstream. The bridge is in better repair than the road that leads to it.",
];
```

That's the entire change. Run:

```bash
npm run lint
npm test -- __tests__/lib/game
```

The narrative-pick logic is tested via `turn-report.test.ts`. As long as your line is a non-empty string, it'll pass.

---

## Style rules

- **One sentence per line for explore/build/distribute narratives.** Two sentences max. The report log is read fast.
- **No second-person plural.** "Your scouts" not "your scouts and you." The player is the general; scouts are agents.
- **Past or simple-present tense.** Mix is fine. Avoid future ("will arrive") — those read like a forecast, not a report.
- **Avoid pronouns that could be misread.** "He" / "she" / "they" without a clear antecedent get confusing across narrative lines. Prefer named roles (scout, captain, smith).
- **No emojis. No exclamation marks.** The tone is restrained.
- **No real proper nouns.** No place names, no historical figures, no IP references. Castes are color-keyed; no faction has a real-world name.

---

## Big lore additions

If your contribution is more than a handful of new lines — say, a full mythology document for the white caste, or a worldbuilding writeup for what the artifacts collectively imply — open a discussion in your PR before merging. Mythology that contradicts existing artifact flavor will get pushback. The existing legendaries (especially "The Last Banner" and "Stillborn Storm") implicitly suggest a world; new lore should fit that world rather than overwriting it.

A reasonable structure for big lore work:
1. PR 1: a `docs/generals/lore/` markdown collection that proposes the worldbuilding without changing any code.
2. Discussion thread on the PR — get reviewer alignment.
3. PR 2: rewrite descriptions / narratives in the code to match.

Lore that lives only in markdown is fine; not all lore needs to ship in-game.
