/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense } from "react";

const TABS = [
  { id: "overview",    label: "Overview" },
  { id: "phases",      label: "Phases" },
  { id: "castes",      label: "Castes" },
  { id: "combat",      label: "Combat" },
  { id: "world",       label: "World & Lore" },
  { id: "contributor", label: "Contributor" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function HelpPageInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = search?.get("tab") ?? "overview";
  const active: TabId =
    (TABS.find((t) => t.id === tabParam)?.id as TabId) ?? "overview";

  const setTab = (id: TabId) => {
    const params = new URLSearchParams(Array.from(search?.entries() ?? []));
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Generals — How to play</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <p className="text-neutral-600 dark:text-neutral-300 mb-6 leading-relaxed">
          Generals is a slow, persistent, turn-based strategy game shared by
          the whole cursor-boston community. Read whichever tab fits where you
          are: new players start with Overview; long-time players head for
          Combat and Contributor.
        </p>

        <div
          role="tablist"
          aria-label="Help sections"
          className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800 mb-8"
        >
          {TABS.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors ${
                  isActive
                    ? "border-emerald-500 text-emerald-700 dark:text-emerald-400 font-medium"
                    : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {active === "overview" && <OverviewTab />}
        {active === "phases" && <PhasesTab />}
        {active === "castes" && <CastesTab />}
        {active === "combat" && <CombatTab />}
        {active === "world" && <WorldTab />}
        {active === "contributor" && <ContributorTab />}

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

export default function GameHelpPage() {
  return (
    <Suspense fallback={null}>
      <HelpPageInner />
    </Suspense>
  );
}

function OverviewTab() {
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

function PhasesTab() {
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

function CastesTab() {
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

function CombatTab() {
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
          Each unit and each per-caste building has <strong>three upgrade
          options</strong>; only one can be active per target. Applying or
          removing one costs <strong>1 turn</strong>, so switching from option
          A to option B is 2 turns total — the same shape as land
          re-assignment.
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

function WorldTab() {
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

function ContributorTab() {
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
    <section id={id} className="mb-8 scroll-mt-24">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
