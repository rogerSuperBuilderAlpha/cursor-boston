/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Section } from "../Section";

export function EndgameTab() {
  return (
    <>
      <Section title="The seven seals">
        <p>
          Every season of Generals ends in <strong>Armageddon</strong>: seven
          magical seals separating this world from the next. The game ends
          when the seventh seal breaks. Until then, every cast of the{" "}
          <em>Armageddon</em> spell rolls against your chances of breaking
          the next one — and a successful break is permanent, attributed to
          you, and remembered forever in the Hall of Fame.
        </p>
        <p className="mt-3">
          You don&apos;t need to break a seal yourself to be remembered.
          Holding a lot of tiles when the seventh seal falls earns you a
          ticket in the closing lottery; breaking seals earns you{" "}
          <em>more</em> tickets. The top 10 weighted draws make the hall.
        </p>
      </Section>

      <Section title="When can you cast Armageddon?">
        <p>Three gates, all checked before the cast:</p>
        <ol className="list-decimal ml-6 mt-3 space-y-1">
          <li>You&apos;ve made it past onboarding (phase = play).</li>
          <li>
            You hold at least <strong>10,000 tiles</strong>.
          </li>
          <li>
            Nobody has broken the seventh seal yet (once it falls, the world
            enters resolution and all turn-spending refuses for the duration).
          </li>
        </ol>
      </Section>

      <Section title="The success roll">
        <p>
          Each cast costs <strong>100 turns</strong> regardless of outcome
          and rolls a single d100 against your{" "}
          <em>magic multiplier</em> — the higher the multiplier, the better
          your chances. The multiplier folds:
        </p>
        <ul className="list-disc ml-6 mt-3 space-y-1">
          <li>The raw count of magic-type tiles you own.</li>
          <li>
            Your magic heroes&apos; specialties (the <em>spellcasting</em>{" "}
            specialty adds ×1.25, the <em>armageddon</em> specialty adds ×2.0).
          </li>
          <li>Any active production spells boosting your magic output.</li>
        </ul>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          The <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">/game/armageddon</code>{" "}
          cast page previews your current success chance before you commit
          the turns.
        </p>
      </Section>

      <Section title="What happens when the seventh seal breaks">
        <p>
          The world enters <em>resolving</em>. Every turn-spending action
          refuses. Behind the scenes:
        </p>
        <ol className="list-decimal ml-6 mt-3 space-y-2">
          <li>
            A <strong>weighted lottery</strong> draws the top 10 winners.
            Tickets = <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">tilesHeld × (1 + sealsBroken)</code>{" "}
            — so seal-breakers are favored, but holding a big kingdom still
            buys real odds even if you didn&apos;t break any.
          </li>
          <li>
            A <strong>hall-of-fame doc</strong> is written for the season —
            the seven-seal audit trail, the top 10 lottery winners with their
            ticket counts, and a top-50-by-tiles snapshot. These never get
            deleted.
          </li>
          <li>
            <strong>Living heroes</strong> enter limbo
            (<code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">awaitingResurrection</code>).
            They survive the wipe so their chronicle stays attached to them
            in the next season.
          </li>
          <li>
            <strong>Everything else</strong> wipes: tiles, units, turns,
            production spells, artifacts. The world rolls into the next
            season fresh.
          </li>
        </ol>
      </Section>

      <Section title="Prophecies — predict the seal falls">
        <p>
          Any general can <strong>file a prophecy</strong> about a specific
          seal before that seal breaks. It&apos;s just a short prediction —
          who&apos;ll break it, what caste, when, whatever. No magic, no
          turn cost.
        </p>
        <p className="mt-3">
          When the targeted seal <em>does</em> break, every unresolved
          prophecy for that seal is stamped <em>fulfilled</em>, the breaker
          is recorded alongside, and a community-feed event announces it.
          Three fulfilled prophecies earns you the <strong>Oracle</strong>{" "}
          title on your profile (one earns you <strong>Seer</strong>).
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          One prophecy per day per general. File at{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            /game/armageddon
          </code>
          .
        </p>
      </Section>

      <Section title="Where it lives in the UI">
        <ul className="list-disc ml-6 space-y-1">
          <li>
            <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
              /game/armageddon
            </code>{" "}
            — the cast page, seal diorama, prophecy form, hall-of-fame
            history of past seasons.
          </li>
          <li>
            Dashboard <strong>Seals panel</strong> — surfaces your own
            progress toward the 10k-tile gate + your current magic
            multiplier.
          </li>
        </ul>
      </Section>
    </>
  );
}
