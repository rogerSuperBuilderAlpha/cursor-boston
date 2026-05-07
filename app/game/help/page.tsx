/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to play — Generals",
  description:
    "Generals is a turn-based strategy game. Explore your lands, develop them, build units, attack neighbors. Read the progression guide and the lore.",
};

export default function GameHelpPage() {
  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-8">
          <h1 className="text-3xl font-bold">Generals — How to play</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <p className="text-neutral-600 dark:text-neutral-300 mb-10 leading-relaxed">
          Generals is a slow, persistent, turn-based strategy game shared by the
          whole cursor-boston community. You command one general on a hex map
          shared with everyone else. Turns are scarce — they&apos;re the one
          resource the game cares about. Spend them well.
        </p>

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
              <em>military</em>, <em>food</em>, or <em>magic</em>. This sets
              your economy for the rest of the game (you can change types later
              at a turn cost).
            </li>
            <li>
              <strong>Caste.</strong> Pick one of five factions. The choice is
              permanent. See the <a href="#castes" className="underline">caste
              guide</a> below.
            </li>
            <li>
              <strong>Play.</strong> The open game. Recruit units on your
              military tiles, cast spells from magic tiles, push the frontier,
              attack neighbors, hunt artifacts.
            </li>
          </ol>
        </Section>

        <Section title="Step 1 — Explore your lands">
          <p>
            You spawn with <strong>25 tiles</strong>: about 20 contiguous and 3-5
            scattered exclaves. In v2 they&apos;re already revealed, but the
            metaphor still applies: every tile your general controls had to be
            scouted, mapped, and claimed.
          </p>
          <p className="mt-3">
            From your dashboard you can also <strong>explore the frontier</strong>
             — push outward from any tile you own into the unrevealed wilderness.
            Each frontier tile costs <strong>1 turn</strong> and has a 3% chance
            to surface an <strong>artifact</strong>: a single-use trinket from
            an older war. (More on artifacts below.)
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
              more food = more soldiers per military tile. An army that
              outgrows its food collapses; the cap is hard.
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
        </Section>

        <Section title="Step 3 — Pick a caste" id="castes">
          <p>
            Castes are color-keyed factions inherited from a tabletop tradition.
            They describe a strategic flavor, not anything else. Each is good at
            two things and weak at one — pick the shape that fits how you like
            to play.
          </p>
          <ul className="list-disc ml-6 mt-3 space-y-2">
            <li>
              <strong>White</strong> — light, hallowed, knightly. Defensive
              specialist. Strong ground, very strong defense spells, weak
              offense. Survives long enough to win the long game.
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

        <Section title="Step 4 — Build units">
          <p>
            Once you&apos;re in the play phase, head to <strong>Recruit</strong>
             from any military tile. Each caste fields three unit types:
          </p>
          <ul className="list-disc ml-6 mt-3 space-y-1">
            <li><strong>Ground.</strong> Bread-and-butter line infantry.</li>
            <li><strong>Siege.</strong> Slow, expensive, breaks tile defenses.</li>
            <li><strong>Air.</strong> Fast, fragile, ignores most ground terrain.</li>
          </ul>
          <p className="mt-3">
            A recruit batch costs <strong>5 turns</strong> and produces a fixed
            number of units, scaled by your caste&apos;s unit-type bonus. Your
            army can&apos;t exceed the unit cap your food lands grant you.
          </p>
        </Section>

        <Section title="Step 5 — Cast spells">
          <p>
            From the <strong>Spells</strong> page you can either <em>arm</em> a
            tile with a defense spell (waiting to fire when attacked) or{" "}
            <em>cast</em> an offense or production spell directly. Each spell
            costs <strong>5 turns</strong>. Spell strength scales with your
            magic-tile count and your caste&apos;s spell-type bonus.
          </p>
          <ul className="list-disc ml-6 mt-3 space-y-1">
            <li><strong>Defense.</strong> Sits on a tile until attacked, then triggers.</li>
            <li><strong>Offense.</strong> One-shot effect aimed at a target tile.</li>
            <li><strong>Production.</strong> 100-turn buff to your unit cap.</li>
          </ul>
        </Section>

        <Section title="Step 6 — Attack">
          <p>
            From <strong>Manage tiles</strong>, pick a tile bordering a neighbor
            you want to take, choose how many units to send, and resolve the
            attack. Attacks cost <strong>1 turn</strong>. Combat math is
            deterministic and runs server-side — capacity, defense spells,
            terrain, and the underdog rule all factor in.
          </p>
          <p className="mt-3">
            New generals are <strong>shielded for 3 weeks</strong> (or until
            they&apos;ve spent 300 turns, whichever is later). Shielded players
            can&apos;t be attacked and can&apos;t initiate attacks — it&apos;s
            time to build.
          </p>
        </Section>

        <Section title="The turn economy">
          <p>You start with <strong>300 turns</strong> when you enlist — enough
            to assign every tile, recruit a real army, and push the frontier.
          </p>
          <p className="mt-3">After that, turns refill weekly:</p>
          <ul className="list-disc ml-6 mt-3 space-y-1">
            <li>
              Merge at least one PR into <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">cursor-boston</code>{" "}
              during the week (Sunday-to-Sunday, EST).
            </li>
            <li>
              The next Sunday at midnight EST, your bucket resets to{" "}
              <strong>100 turns</strong>.
            </li>
            <li>No PR, no turns. The week skips you.</li>
          </ul>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Turn costs at a glance: explore 1, distribute 1, attack 1, recruit
            5, spell 5.
          </p>
        </Section>

        <Section title="Artifacts">
          <p>
            Every frontier-explore turn rolls a 3% chance to surface an
            artifact: a single-use trinket pulled from the older war. Common,
            rare, epic, legendary — strength scales with rarity. Artifacts live
            in your inventory until you spend them.
          </p>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Some are useful, some are just strange. The Crown of the First
            General sits on a stone bench in a sunlit grove. The grass beneath
            the bench has not grown in centuries.
          </p>
        </Section>

        <Section title="The world — a short lore note">
          <p>
            Generals lives in a vague pre-industrial world: banners and
            quartermasters and frost on the morning grass. Five castes (white,
            blue, black, red, green) wage long, slow campaigns across a hex
            map that no one quite remembers settling.
          </p>
          <p className="mt-3">
            The world&apos;s history is half-told and contradictory. There was
            a <strong>First General</strong>, who wore a simple iron circlet
            and never lost a battle. There is a <strong>Quiet King</strong>,
            who never spoke and never lost either. There is{" "}
            <strong>The Last Banner</strong>, planted in the center of an empty
            battlefield whose battle the histories do not record. There is a{" "}
            <strong>Stillborn Storm</strong> — a glass shard from a storm that
            never finished forming. Your scouts find these things from time to
            time, and your captains argue about them around the fire.
          </p>
          <p className="mt-3">
            The tone the game tries to keep:
          </p>
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

        <Section title="A practical first-day plan">
          <ol className="list-decimal ml-6 space-y-2">
            <li>Bulk-assign your 25 starter tiles: ~10 food, ~10 military, ~5 magic. (~25 turns.)</li>
            <li>Pick a caste that matches how you want to fight.</li>
            <li>Recruit one or two batches of ground units. (~10 turns.)</li>
            <li>Push the frontier 30-50 tiles outward — chase artifacts. (~30-50 turns.)</li>
            <li>Sit back. Wait out the 3-week shield. Read the lore.</li>
            <li>When the shield drops, find a neighbor and start something.</li>
          </ol>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            That uses ~70-100 of your 300 starter turns. The rest is yours.
          </p>
        </Section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/game"
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
          >
            ← Back to dashboard
          </Link>
          <Link
            href="/game/leaderboard"
            className="px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
