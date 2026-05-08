/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Section } from "../Section";

export function CombatTab() {
  return (
    <>
      <Section title="Build units">
        <p>
          Once you&apos;re in the play phase, head to <strong>Recruit</strong>{" "}
          from any military tile. Each caste fields three unit types:
        </p>
        <ul className="list-disc ml-6 mt-3 space-y-1">
          <li>
            <strong>Ground.</strong> Bread-and-butter line infantry.
          </li>
          <li>
            <strong>Siege.</strong> Slow, expensive, breaks tile defenses.
          </li>
          <li>
            <strong>Air.</strong> Fast, fragile, ignores most ground terrain.
          </li>
        </ul>
        <p className="mt-3">
          A recruit batch costs <strong>5 turns</strong> and produces a fixed
          number of units, scaled by your caste&apos;s unit-type bonus. Your
          army can&apos;t exceed the unit cap your food lands grant you.
        </p>
      </Section>
      <Section title="Cast spells (with tiers)">
        <p>
          From the <strong>Spells</strong> page you can either <em>arm</em> a
          tile with a defense spell (waiting to fire when attacked) or{" "}
          <em>cast</em> an offense or production spell directly. Spell strength
          scales with your magic-tile count and your caste&apos;s spell-type
          bonus.
        </p>
        <p className="mt-3">
          Each caste&apos;s spell book has <strong>five tiers</strong>. Higher
          tiers unlock as your territory grows and cost more turns to cast:
        </p>
        <ul className="list-disc ml-6 mt-3 space-y-1 text-sm">
          <li>Tier 1 — always available, 5 turns.</li>
          <li>Tier 2 — 500 tiles held, 8 turns.</li>
          <li>Tier 3 — 1,500 tiles held, 12 turns.</li>
          <li>Tier 4 — 5,000 tiles held, 18 turns.</li>
          <li>Tier 5 — 20,000 tiles held, 25 turns.</li>
        </ul>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Tier 1 is enough to win small wars. Tier 5 belongs to generals who
          have shaped continents.
        </p>
      </Section>
      <Section title="Upgrades">
        <p>
          Each unit and each per-caste building has{" "}
          <strong>three upgrade options</strong>; only one can be active per
          target. Applying or removing one costs <strong>1 turn</strong>, so
          switching from option A to option B is 2 turns total — the same
          shape as land re-assignment.
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Upgrades apply to all your units of that type and all your tiles of
          that building. They are not per-tile.
        </p>
      </Section>
      <Section title="Attack">
        <p>
          From <strong>Manage tiles</strong>, pick a tile bordering a neighbor
          you want to take, choose how many units to send, and resolve the
          attack. Attacks cost <strong>1 turn</strong> (plus the offense
          spell&apos;s turn cost if attached). Combat math is deterministic
          and runs server-side — capacity, defense spells, terrain, the
          underdog rule, and your active upgrades all factor in.
        </p>
        <p className="mt-3">
          New generals are <strong>shielded for 3 weeks</strong> — or until
          they&apos;ve spent 300 turns, whichever comes first. Shielded
          players can&apos;t be attacked and can&apos;t initiate attacks —
          it&apos;s time to build.
        </p>
      </Section>
    </>
  );
}
