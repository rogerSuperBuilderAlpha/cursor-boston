/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Section } from "../Section";

export function PhasesTab() {
  return (
    <>
      <Section title="Step 1 — Explore your lands">
        <p>
          You spawn with <strong>25 tiles</strong>: about 20 contiguous and 3-5
          scattered exclaves. In v2 they&apos;re already revealed, but the
          metaphor still applies: every tile your general controls had to be
          scouted, mapped, and claimed.
        </p>
        <p className="mt-3">
          From your dashboard you can also{" "}
          <strong>explore the frontier</strong> — push outward from any tile
          you own into the unrevealed wilderness. Each frontier tile costs{" "}
          <strong>1 turn</strong> and has a 3% chance to surface an{" "}
          <strong>artifact</strong>: a single-use trinket from an older war.
        </p>
      </Section>
      <Section title="Step 2 — Develop the lands">
        <p>
          Every tile you own starts as <em>unassigned</em>. You assign it one
          of three types, each with a clear job:
        </p>
        <ul className="list-disc ml-6 mt-3 space-y-2">
          <li>
            <strong>Military.</strong> Where you recruit units. The number of
            military tiles you hold caps how many soldiers you can field.
          </li>
          <li>
            <strong>Food.</strong> Determines your <em>unit capacity</em> —
            more food = more soldiers per military tile. An army that outgrows
            its food collapses; the cap is hard.
          </li>
          <li>
            <strong>Magic.</strong> Powers your spells. More magic = stronger
            spell effects (a per-tile multiplier).
          </li>
        </ul>
        <p className="mt-3">
          Assigning a tile costs <strong>1 turn</strong>. The dashboard has a
          bulk-distribute control so you don&apos;t have to click 25 times.
          Bias toward food early — armies grow faster than tiles do.
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Each land type IS a per-caste building (Garrison Hall, Old Orchard,
          etc.). The Upgrades page lets you pick one of three options per
          building to bias capacity, defense, or magic-multiplier.
        </p>
      </Section>
    </>
  );
}
