/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Section } from "../Section";

export function CastesTab() {
  return (
    <Section title="Pick a caste">
      <p>
        Castes are color-keyed factions inherited from a tabletop tradition.
        They describe a strategic flavor, not anything else. Each is good at
        two things and weak at one — pick the shape that fits how you like to
        play.
      </p>
      <ul className="list-disc ml-6 mt-3 space-y-2">
        <li>
          <strong>White</strong> — light, hallowed, knightly. Defensive
          specialist. Strong ground, very strong defense spells, weak offense.
          Survives long enough to win the long game.
        </li>
        <li>
          <strong>Blue</strong> — water, sky, moon. Magic specialist. Strong
          air units, very strong production spells. Plays the economy.
        </li>
        <li>
          <strong>Black</strong> — death, blood, bone. Generalist offense.
          Slightly above average everywhere, devastating offensive spells.
        </li>
        <li>
          <strong>Red</strong> — fire, fury, forge. Siege specialist. Strong
          siege, brutal offense spells, fragile defense. Glass cannon.
        </li>
        <li>
          <strong>Green</strong> — wood, growth, territory. The territory
          caste. Highest tile capacity (more units per tile), strong ground.
        </li>
      </ul>
      <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        The caste choice is permanent. You can&apos;t un-pick.
      </p>
    </Section>
  );
}
