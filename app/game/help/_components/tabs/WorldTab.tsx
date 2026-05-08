/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Section } from "../Section";

export function WorldTab() {
  return (
    <>
      <Section title="The world — a short lore note">
        <p>
          Generals lives in a vague pre-industrial world: banners and
          quartermasters and frost on the morning grass. Five castes (white,
          blue, black, red, green) wage long, slow campaigns across a hex map
          that no one quite remembers settling.
        </p>
        <p className="mt-3">
          The world&apos;s history is half-told and contradictory. There was a{" "}
          <strong>First General</strong>, who wore a simple iron circlet and
          never lost a battle. There is a <strong>Quiet King</strong>, who
          never spoke and never lost either. There is{" "}
          <strong>The Last Banner</strong>, planted in the center of an empty
          battlefield whose battle the histories do not record. There is a{" "}
          <strong>Stillborn Storm</strong> — a glass shard from a storm that
          never finished forming. Your scouts find these things from time to
          time, and your captains argue about them around the fire.
        </p>
        <p className="mt-3">The tone the game tries to keep:</p>
        <ul className="list-disc ml-6 mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
          <li>Sensory detail, not modern military jargon.</li>
          <li>Magic happens. No one explains it.</li>
          <li>Time slips — centuries-old grass, cold ash, dust still rising.</li>
          <li>Death is present. It&apos;s not graphic.</li>
          <li>No real-world places, religions, or historical figures.</li>
        </ul>
        <p className="mt-3">
          If you find yourself reading the artifact descriptions out loud,
          that&apos;s the right reaction.
        </p>
      </Section>
      <Section title="Artifacts">
        <p>
          Every frontier-explore turn rolls a 3% chance to surface an artifact:
          a single-use trinket pulled from the older war. Common, rare, epic,
          legendary — strength scales with rarity. Artifacts live in your
          inventory until you spend them.
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Some are useful, some are just strange. The Crown of the First
          General sits on a stone bench in a sunlit grove. The grass beneath
          the bench has not grown in centuries.
        </p>
      </Section>
    </>
  );
}
