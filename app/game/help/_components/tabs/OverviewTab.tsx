/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Section } from "../Section";

export function OverviewTab() {
  return (
    <>
      <Section title="The shape of a game">
        <p>
          Every general moves through four phases. The early phases are guided
          and short; the last one is the actual game and never ends.
        </p>
        <ol className="list-decimal ml-6 mt-3 space-y-2">
          <li>
            <strong>Explore.</strong> Reveal your starting lands one by one.
            Skipped for new players in v2 — your 25-tile cluster lands already
            revealed.
          </li>
          <li>
            <strong>Distribute.</strong> Decide what each tile is for —{" "}
            <em>military</em>, <em>food</em>, or <em>magic</em>. This sets your
            economy for the rest of the game (you can change types later at a
            turn cost).
          </li>
          <li>
            <strong>Caste.</strong> Pick one of five factions. The choice is
            permanent.
          </li>
          <li>
            <strong>Play.</strong> The open game. Recruit units on your
            military tiles, cast spells from magic tiles, push the frontier,
            attack neighbors, hunt artifacts, apply upgrades.
          </li>
        </ol>
      </Section>
      <Section title="The turn economy">
        <p>
          You start with <strong>300 turns</strong> when you enlist — enough to
          assign every tile, recruit a real army, and push the frontier.
        </p>
        <p className="mt-3">After that, turns refill weekly:</p>
        <ul className="list-disc ml-6 mt-3 space-y-1">
          <li>
            Merge at least one PR into{" "}
            <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
              cursor-boston
            </code>{" "}
            during the week (Sunday-to-Sunday, EST).
          </li>
          <li>
            The next Sunday at midnight EST, your bucket resets to{" "}
            <strong>100 turns</strong>.
          </li>
          <li>No PR, no turns. The week skips you.</li>
        </ul>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Turn costs at a glance: explore 1, distribute 1, attack 1, recruit 5,
          tier-1 spell 5 (tier-5 spells cost up to 25), upgrade apply or remove
          1 each.
        </p>
      </Section>
      <Section title="A practical first-day plan">
        <ol className="list-decimal ml-6 space-y-2">
          <li>
            Bulk-assign your 25 starter tiles: ~10 food, ~10 military, ~5
            magic. (~25 turns.)
          </li>
          <li>Pick a caste that matches how you want to fight.</li>
          <li>Recruit one or two batches of ground units. (~10 turns.)</li>
          <li>
            Push the frontier 30-50 tiles outward — chase artifacts. (~30-50
            turns.)
          </li>
          <li>
            Apply one or two starter upgrades on your favourite unit and your
            food building. (~2 turns.)
          </li>
          <li>Sit back. Wait out the shield. Read the lore.</li>
        </ol>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          That uses ~70-100 of your 300 starter turns. The rest is yours.
        </p>
      </Section>
    </>
  );
}
