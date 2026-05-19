/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Section } from "../Section";

export function CommunityTab() {
  return (
    <>
      <Section title="What this is">
        <p>
          The community surface is the part of the game that costs you no
          turns. Ten features that let you participate between weekly turn
          grants without burning your battle budget — profiles, titles,
          reactions, chat rooms, taunts on attacks, tile inscriptions, public
          pacts, and prophecies.
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          They&apos;re deliberately cosmetic. A title doesn&apos;t boost
          combat. A reaction doesn&apos;t buff units. Pacts are reputational,
          not enforced. The point is mid-week presence, not extra power.
        </p>
      </Section>

      <Section title="Profiles + titles">
        <p>
          Every general has a public profile at{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            /game/players/&lt;your-uid&gt;
          </code>
          . Edit your bio (≤500 chars, sanitized), see your derived titles,
          and see your kingdom stats at a glance.
        </p>
        <p className="mt-3">
          Titles are awarded automatically based on your milestones. Currently
          minted:
        </p>
        <ul className="list-disc ml-6 mt-2 space-y-1 text-sm">
          <li>
            <strong>Tile Knight / Tile Lord / Tile Baron</strong> — held 100 /
            500 / 1,000+ tiles.
          </li>
          <li>
            <strong>First Blood / Raider / Warlord</strong> — won 1 / 100 /
            500+ attacks.
          </li>
          <li>
            <strong>Campaigner / Veteran General</strong> — spent 1,000 /
            10,000+ turns.
          </li>
          <li>
            <strong>Sealbreaker / Apocalypse Bringer</strong> — broke 1 / 3+
            Armageddon seals.
          </li>
          <li>
            <strong>Hero Commander / Hero Marshal</strong> — currently command
            1 / 5+ heroes.
          </li>
          <li>
            <strong>Renegade</strong> — switched castes after reaching 1,000
            tiles.
          </li>
          <li>
            <strong>Seer / Oracle</strong> — had 1 / 3+ prophecies come true.
          </li>
        </ul>
      </Section>

      <Section title="Reactions on chat, feed, hero events">
        <p>
          Three small buttons under chat messages, community-feed events, and
          hero-event rows: <strong>⚔️ shield 📜</strong>. Click to react,
          click again to remove. Counts are public; the &ldquo;you reacted&rdquo;
          highlight is just for your view.
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Rate-limited at 60 reactions per minute. If you spam-click past
          that, the buttons stop responding for a bit — that&apos;s the cap,
          not a bug.
        </p>
      </Section>

      <Section title="Chat rooms — Global and your caste">
        <p>
          The community panel on the dashboard has two chat rooms now: the{" "}
          <strong>Global</strong> room (everyone can read and post) and your{" "}
          <strong>caste room</strong> (only members of your caste can read or
          post). Tap the tab strip above the chat to switch.
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Rate-limited at 10 messages per minute. Posts get sanitized
          server-side; your message is rendered as plain text, no HTML
          allowed.
        </p>
      </Section>

      <Section title="Battle dispatches — taunts attached to attacks">
        <p>
          When you launch an attack, you can attach a short dispatch
          (≤280 chars). It rides with the attack record and appears on{" "}
          <code className="text-xs px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            /game/attacks
          </code>{" "}
          for both you and the defender. Use it for trash talk, lore, or
          coordination. No combat impact.
        </p>
      </Section>

      <Section title="Tile inscriptions">
        <p>
          Owner-only. On any of your tiles, set a short inscription
          (≤120 chars). It&apos;s invisible to most viewers — but the moment
          someone casts an intel spell on the tile or attacks it, your
          inscription is revealed in their report.
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          The honest move: leave something defiant on your border tiles.
        </p>
      </Section>

      <Section title="Public pacts — non-aggression vows">
        <p>
          From another general&apos;s profile page you can <em>file a pact</em>
           — a one-line public declaration aimed at them, like &ldquo;I
          won&apos;t attack this general for the next week.&rdquo; Pacts last
          7 days by default.
        </p>
        <p className="mt-3">
          Nothing in the combat system stops you from breaking your pact. But
          if you attack the target while the pact is active, the server stamps
          your pact as <strong>broken</strong> and posts a{" "}
          <em>pact_broken</em> event to the community feed for everyone to
          see. It&apos;s a reputation system, not a rules system.
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          One pact per day per general.
        </p>
      </Section>

      <Section title="Prophecies — predict the seal falls">
        <p>
          See the <strong>Endgame</strong> tab. Short version: file a
          prediction about a specific Armageddon seal before it falls; when
          that seal does fall, your prophecy is stamped fulfilled and you
          earn the Seer title. One prophecy per day.
        </p>
      </Section>

      <Section title="Why nothing affects gameplay">
        <p>
          By design. The whole point of the community surface is that nobody
          who spends their week posting and reacting gets a combat edge over
          someone who spends their turns building an army. A reaction is not
          a unit. A title is not a buff. If we ever attach combat effects to
          these surfaces, that&apos;ll be a separate feature with its own
          turn cost.
        </p>
      </Section>
    </>
  );
}
