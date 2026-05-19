/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Section } from "../Section";

export function HeroesTab() {
  return (
    <>
      <Section title="What heroes are">
        <p>
          Heroes are exceptional units that emerge from your kingdom over time
          and live on a single tile. There&apos;s at most one per tile, and
          they boost what that tile does — combat for military heroes,
          recruitment for farm heroes, spell-casting for magic heroes.
        </p>
        <p className="mt-3">
          You don&apos;t recruit heroes the way you recruit units. They{" "}
          <strong>emerge</strong> probabilistically when you take a
          class-aligned action on a class-aligned tile — a won battle on a
          military tile may produce a military hero, a recruitment on a food
          tile may produce a farm hero, a spell cast from a magic tile may
          produce a magic hero. You don&apos;t pick when they show up; you
          just keep doing the work and one day a banner unfurls.
        </p>
      </Section>

      <Section title="The three classes">
        <ul className="list-disc ml-6 space-y-3">
          <li>
            <strong>Military hero</strong> — boosts attack from and defense on
            their tile (+20% / +25% baseline). Six specialties further weight
            the bonus toward a unit type (ground, siege, air) or a stance
            (garrison, raid, supply).
          </li>
          <li>
            <strong>Farm hero</strong> — kingdom-wide recruitment buff
            (+10% per farm hero, capped at +50%). Adds a chance to roll
            caste-themed <em>special units</em> from recruitments on their
            tile. The <em>summoner</em> specialty doubles that.
          </li>
          <li>
            <strong>Magic hero</strong> — boosts spell magnitude from their
            tile (+15% baseline) and contributes &ldquo;virtual magic
            lands&rdquo; to your Armageddon multiplier. The{" "}
            <em>armageddon</em> specialty doubles their contribution to
            end-game casts.
          </li>
        </ul>
      </Section>

      <Section title="Stamina, and what happens in battle">
        <p>
          Heroes track <strong>stamina</strong> (0–100). They regen +20 per
          owner turn since their last engagement, and lose −25 per engagement
          (attack from <em>or</em> attack on their tile). An exhausted hero is
          a weaker hero.
        </p>
        <p className="mt-3">
          When you win an attack on a tile that has a defending hero, you
          choose what happens to them:
        </p>
        <ul className="list-disc ml-6 mt-2 space-y-1">
          <li>
            <strong>Kill</strong> (default) — you capture the tile; the hero
            is dead and entered into the Hall of the Fallen.
          </li>
          <li>
            <strong>Spare</strong> — you choose <em>not</em> to take the tile.
            The hero loses extra stamina (−50 total for the engagement) but
            the defender keeps everything.
          </li>
          <li>
            <strong>Convert</strong> — only available when the hero&apos;s
            stamina is ≤ 25. Rolls against (100% − stamina%), capped at 90%.
            On success, the hero defects to you at stamina 50. On fail, you
            fall back to the choice you preset (<em>kill</em> or{" "}
            <em>spare</em>).
          </li>
        </ul>
      </Section>

      <Section title="The chronicle — chapters and epitaphs">
        <p>
          Every hero has a public lore page at{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            /game/heroes/&lt;id&gt;
          </code>
          . Three things land there:
        </p>
        <ul className="list-disc ml-6 mt-3 space-y-2">
          <li>
            <strong>Backstory chapters</strong> — markdown lore committed via
            PR to{" "}
            <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
              lib/game/content/hero-backstories/
            </code>
            . Append-only; new chapters get added, old ones aren&apos;t
            rewritten.
          </li>
          <li>
            <strong>In-game chapters</strong> — anyone can submit a chapter to
            any hero via the page. If you own the hero, your submission
            publishes immediately. Strangers&apos; submissions land pending
            admin approval. Rate-limited to 3 per day.
          </li>
          <li>
            <strong>Epitaphs</strong> — short (≤280 char) eulogies on heroes
            that have fallen or are awaiting resurrection. Anyone can post.
            Rate-limited to 5 per day.
          </li>
        </ul>
      </Section>

      <Section title="Visibility — who sees what">
        <p>
          Living heroes have their location and stamina hidden from most
          viewers. The rules:
        </p>
        <ul className="list-disc ml-6 mt-3 space-y-1">
          <li>
            <strong>Owner</strong> — sees everything.
          </li>
          <li>
            <strong>Adjacent general</strong> — sees the tile + stamina too.
          </li>
          <li>
            <strong>Stranger</strong> — sees only name, class, specialty,
            caste. Location + stamina hidden.
          </li>
          <li>
            <strong>Fallen or limbo</strong> — fully public.
          </li>
        </ul>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Use intel spells if you want to see an enemy hero&apos;s stamina
          before you commit to a strike.
        </p>
      </Section>

      <Section title="Where to find them in the UI">
        <ul className="list-disc ml-6 space-y-1">
          <li>
            <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
              /game/heroes
            </code>{" "}
            — roster browser. Three scopes:{" "}
            <em>Mine</em> (your roster), <em>All</em> (every living hero,
            visibility-filtered), <em>Hall of the Fallen</em> (deceased and
            limbo heroes, fully public).
          </li>
          <li>
            <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
              /game/heroes/&lt;id&gt;
            </code>{" "}
            — single-hero detail: stats, chronicle, event timeline, reactions
            on each event.
          </li>
          <li>
            Dashboard <strong>Hero card</strong> + <strong>Roster card</strong>
             — quick view of your featured heroes.
          </li>
        </ul>
      </Section>
    </>
  );
}
