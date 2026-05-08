/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Section } from "../Section";

export function ContributorTab() {
  return (
    <>
      <Section title="What you can author">
        <p>
          Generals is open to contributor PRs that add new content. The shapes
          below are the supported ones — pick any, add a file, register it,
          open a PR. Balance review happens during PR review.
        </p>
        <ul className="list-disc ml-6 mt-3 space-y-1">
          <li>
            <strong>Spells</strong> — five tiers per caste-and-type triple.
          </li>
          <li>
            <strong>Units</strong> — one per caste per unit-type (already
            authored; deltas come via upgrades).
          </li>
          <li>
            <strong>Buildings</strong> — one per caste per land-type (already
            authored; deltas come via upgrades).
          </li>
          <li>
            <strong>Upgrades</strong> — three options per unit/building per
            caste.
          </li>
          <li>
            <strong>Artifacts</strong> — common / rare / epic / legendary; rare
            and atmospheric.
          </li>
        </ul>
      </Section>
      <Section title="Directory layout">
        <pre className="text-xs bg-neutral-100 dark:bg-neutral-900 rounded-lg p-3 overflow-x-auto leading-snug">
{`lib/game/content/
  index.ts              # ALL_* aggregators + lookup helpers
  artifacts/            # ALL_ARTIFACTS, by rarity
  buildings/
    index.ts            # exports BUILDINGS
    seeds.ts            # one entry per (caste, landType)
  spells/
    tiers.ts            # TIER_MIN_TILES, TIER_TURN_COST, TIER_STRENGTH_MULTIPLIER
    _tier-builder.ts    # helper that produces 5 tiers from one declaration
    {caste}/{type}.ts   # exports {CASTE}_{TYPE}_SPELLS: SpellDefinition[]
  units/
    {caste}/{type}.ts   # exports {CASTE}_{TYPE}_UNIT: UnitDefinition
    all.ts              # flat list of all units (for upgrades)
  upgrades/
    index.ts            # exports ALL_UPGRADES
    units.ts            # 3 options per unit
    buildings.ts        # 3 options per building`}
        </pre>
      </Section>
      <Section title="Adding a spell">
        <p>
          Spells are authored in 5-tier sets. Open{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            lib/game/content/spells/{`{caste}`}/{`{type}`}.ts
          </code>{" "}
          and edit the array. The helper computes per-tier baseStrength and
          turnCost from your tier-1 baseStrength.
        </p>
        <pre className="text-xs bg-neutral-100 dark:bg-neutral-900 rounded-lg p-3 overflow-x-auto leading-snug mt-3">
{`import { buildSpellTiers } from "../_tier-builder";

export const WHITE_DEFENSE_SPELLS = buildSpellTiers({
  caste: "white",
  type: "defense",
  baseStrength: 60,            // tier-1 base; higher tiers scale automatically
  tiers: [
    { id: "white-defense-sanctuary",
      name: "Sanctuary",
      description: "..." },
    { id: "white-defense-bulwark-t2",
      name: "Bulwark of Saints",
      description: "..." },
    // ...3 more
  ],
});`}
        </pre>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Conventions: tier-1 keeps its v1 id (no <code>-t1</code> suffix);
          tiers 2–5 append <code>-t2</code> through <code>-t5</code>. Stable
          ids matter — Firestore tile docs reference armed defense spells by
          id.
        </p>
      </Section>
      <Section title="Adding an upgrade">
        <p>
          Open{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            lib/game/content/upgrades/units.ts
          </code>{" "}
          (or{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            buildings.ts
          </code>
          ) and edit the per-caste{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            NAMES
          </code>{" "}
          and{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            DESCRIPTIONS
          </code>{" "}
          tables. Each unit/building gets exactly 3 options:
        </p>
        <ul className="list-disc ml-6 mt-3 space-y-1 text-sm">
          <li>
            <strong>Option 1</strong> — offensive lean (+attack, slight
            -defense).
          </li>
          <li>
            <strong>Option 2</strong> — defensive lean (+defense / +hp, slight
            -attack).
          </li>
          <li>
            <strong>Option 3</strong> — utility (capacity, magic-multiplier,
            situational).
          </li>
        </ul>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Effect deltas live in{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            OPTION_DELTAS_BY_TYPE
          </code>{" "}
          (units) and{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            OPTION_DELTAS_BY_LAND
          </code>{" "}
          (buildings). The same numbers are reused across castes — flavor,
          not balance, lives in the names.
        </p>
      </Section>
      <Section title="Adding a building">
        <p>
          Buildings are 1-per-(caste, landType) and live entirely in{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            lib/game/content/buildings/seeds.ts
          </code>
          . Adding new ones means adding a new land type, which is a larger
          change — open an issue first.
        </p>
      </Section>
      <Section title="Adding an artifact">
        <p>
          See{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            lib/game/content/artifacts/
          </code>{" "}
          and the rarity-bucketed map in{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            ARTIFACTS_BY_RARITY
          </code>
          . Artifacts should read like found objects, not stat blocks. The{" "}
          <strong>flavorOnFind</strong> field is what scouts say when they
          discover one.
        </p>
      </Section>
      <Section title="Submitting changes">
        <p>
          The repo&apos;s{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            CONTRIBUTORS.md
          </code>{" "}
          covers the PR mechanics. For game content the rule of thumb is: keep
          deltas small, keep prose short, and read the result out loud once
          before pushing.
        </p>
      </Section>
    </>
  );
}
