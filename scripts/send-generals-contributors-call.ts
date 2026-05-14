#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-off broadcast to all eventContacts inviting people to contribute to
 * Generals — the in-repo strategy game. Lead with the game pitch + how to
 * play, then call out the four contribution lanes (logic, balancing,
 * graphic design, live playtesting) and how this slots into open-source
 * experience that's portfolio-worthy.
 *
 * Mirrors send-broadcast-2026-05-07.ts mechanics: pulls from eventContacts,
 * skips unsubscribed, syncs Mailgun suppressions first, HMAC unsubscribe
 * link.
 *
 * Usage:
 *   npx tsx scripts/send-generals-contributors-call.ts --dry-run
 *   npx tsx scripts/send-generals-contributors-call.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const GAME_URL = "https://www.cursorboston.com/game";
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const ISSUES_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/issues?q=is%3Aissue+is%3Aopen+label%3Agame";
const HELP_URL = "https://www.cursorboston.com/game/help";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ContactData {
  email: string;
  name: string;
  firstName: string;
}

function buildEmail(contact: ContactData): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(
    contact.firstName?.trim() ||
      contact.name?.split(" ")[0]?.trim() ||
      "there"
  );
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const subject =
    "Cursor Boston is building a game — come help shape it";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick note about something we'd love your help with: <strong>Generals</strong>, the strategy game we've been quietly building inside the Cursor Boston repo. It's playable today at <a href="${GAME_URL}">cursorboston.com/game</a> — and we're opening up four clear lanes for people who want to contribute.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">What is it?</h3>

<p>Generals is a turn-based, browser-based strategy game on a hex map. You pick one of five castes (Black, Blue, Green, Red, White — each plays differently), explore land, assign tiles to <em>military</em>, <em>food</em>, or <em>magic</em>, recruit ground/siege/air armies, and attack neighbors. There's a rock-paper-scissors layer (air > ground > siege > air), supply-line bonuses, defense spells you can pre-arm on tiles, offense spells, intel/spy spells with caste-specific reveals, and now a live battle-simulation panel that projects outcomes <em>before</em> you commit turns.</p>

<p>Everyone gets <strong>100 turns per week</strong>. Attacks cost 1 turn, recruits 5, big spells 5+. So a week is roughly 30–60 deliberate decisions. Easy to dip into; deep enough that "what if I had cast a Siege debuff first" is a real question.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Why it's fun</h3>

<p>It's the kind of game where you check in once a day, look at your borders, run a sim against a tempting target, decide to <em>not</em> attack and instead reinforce, and feel smart about it. Or you go for it, lose, and learn what spell stack would have worked. The community plays alongside NPCs and a small but growing set of real players, with a leaderboard you can filter to humans-only.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">How to start playing (5 minutes)</h3>

<ol>
  <li>Sign in at <a href="${GAME_URL}">cursorboston.com/game</a>.</li>
  <li>Explore a few starting tiles, distribute land types, pick a caste.</li>
  <li>Visit <a href="${HELP_URL}">/game/help</a> if you want the full mechanics tour.</li>
  <li>Open <strong>/game/threats</strong> and try the battle-simulation panel against a neighbor.</li>
</ol>

<h3 style="margin-top:24px;margin-bottom:8px;">Where you can plug in as a contributor</h3>

<p>This is where it gets interesting. The whole game is in our open-source repo — TypeScript, Next.js, Firestore. <strong>Four contribution lanes</strong>, pick whichever calls to you:</p>

<ul>
  <li><strong>Game logic</strong> — new spells, new unit types, new tile mechanics, intel passives. Core math lives in <code>lib/game/combat.ts</code> and <code>lib/game/data-server.ts</code>.</li>
  <li><strong>Balancing</strong> — units, spells, supply curves, RNG bands, tile-type modifiers. We have ~1,800 tests in <code>__tests__/lib/game/</code> that make it safe to tune values and ship.</li>
  <li><strong>Graphic design</strong> — tile art, faction iconography, battle-readout polish, map UI. The game is currently text-and-grid forward; visual upgrades have huge leverage.</li>
  <li><strong>Live playtesting</strong> — play the game, file good bug reports, propose mechanics changes from a player's perspective. The two best bug fixes shipped <em>today</em> came from a single playtest screenshot.</li>
</ul>

<h3 style="margin-top:24px;margin-bottom:8px;">Why bother?</h3>

<p>This is a real, deployed product with users, not a toy repo. Working on it means:</p>
<ul>
  <li>Genuine open-source experience — PRs get reviewed, merged, and shipped to production typically the same day.</li>
  <li>A portfolio piece you can point a hiring manager at: "I designed and shipped this spell mechanic" or "I rebalanced the air-unit RPS modifier and here's the data."</li>
  <li>Skills that compound: game logic teaches you state machines, transactions, and adversarial testing in a domain that's fun to talk about.</li>
  <li>Community: you're building something other people in Cursor Boston actually play.</li>
</ul>

<h3 style="margin-top:24px;margin-bottom:8px;">How to start contributing</h3>

<ol>
  <li><strong>Play first.</strong> Even a 10-minute session gives you ideas. <a href="${GAME_URL}">cursorboston.com/game</a></li>
  <li><strong>Look at open issues</strong> labeled <code>game</code>: <a href="${ISSUES_URL}">github.com/rogerSuperBuilderAlpha/cursor-boston/issues</a></li>
  <li><strong>Read the repo</strong>: <a href="${REPO_URL}">github.com/rogerSuperBuilderAlpha/cursor-boston</a> — start with <code>lib/game/</code> and <code>app/game/</code></li>
  <li><strong>Open a PR</strong> with the change you want to see. Even a one-line balance tweak with a test is a great first contribution.</li>
  <li><strong>Stuck or want a starter task?</strong> Reply to this email and I'll point you at something sized to your interest and skill level.</li>
</ol>

<p>If any of this lights you up — game logic, the math of balancing, the design surface, or just being a really vocal playtester — I'd genuinely love to hear from you.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you registered for a Cursor Boston event.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"},

Quick note about something we'd love your help with: Generals, the strategy game we've been quietly building inside the Cursor Boston repo. It's playable today at ${GAME_URL} — and we're opening up four clear lanes for people who want to contribute.

WHAT IS IT?

Generals is a turn-based, browser-based strategy game on a hex map. You pick one of five castes (Black, Blue, Green, Red, White — each plays differently), explore land, assign tiles to military, food, or magic, recruit ground/siege/air armies, and attack neighbors. There's a rock-paper-scissors layer (air > ground > siege > air), supply-line bonuses, defense spells you can pre-arm on tiles, offense spells, intel/spy spells with caste-specific reveals, and now a live battle-simulation panel that projects outcomes before you commit turns.

Everyone gets 100 turns per week. Attacks cost 1 turn, recruits 5, big spells 5+. So a week is roughly 30–60 deliberate decisions. Easy to dip into; deep enough that "what if I had cast a Siege debuff first" is a real question.

WHY IT'S FUN

It's the kind of game where you check in once a day, look at your borders, run a sim against a tempting target, decide to not attack and instead reinforce, and feel smart about it. Or you go for it, lose, and learn what spell stack would have worked. The community plays alongside NPCs and a small but growing set of real players, with a leaderboard you can filter to humans-only.

HOW TO START PLAYING (5 minutes)

  1. Sign in at ${GAME_URL}.
  2. Explore a few starting tiles, distribute land types, pick a caste.
  3. Visit ${HELP_URL} if you want the full mechanics tour.
  4. Open /game/threats and try the battle-simulation panel against a neighbor.

WHERE YOU CAN PLUG IN AS A CONTRIBUTOR

This is where it gets interesting. The whole game is in our open-source repo — TypeScript, Next.js, Firestore. Four contribution lanes, pick whichever calls to you:

  - Game logic — new spells, new unit types, new tile mechanics, intel passives. Core math lives in lib/game/combat.ts and lib/game/data-server.ts.
  - Balancing — units, spells, supply curves, RNG bands, tile-type modifiers. We have ~1,800 tests in __tests__/lib/game/ that make it safe to tune values and ship.
  - Graphic design — tile art, faction iconography, battle-readout polish, map UI. The game is currently text-and-grid forward; visual upgrades have huge leverage.
  - Live playtesting — play the game, file good bug reports, propose mechanics changes from a player's perspective. The two best bug fixes shipped today came from a single playtest screenshot.

WHY BOTHER?

This is a real, deployed product with users, not a toy repo. Working on it means:

  - Genuine open-source experience — PRs get reviewed, merged, and shipped to production typically the same day.
  - A portfolio piece you can point a hiring manager at: "I designed and shipped this spell mechanic" or "I rebalanced the air-unit RPS modifier and here's the data."
  - Skills that compound: game logic teaches you state machines, transactions, and adversarial testing in a domain that's fun to talk about.
  - Community: you're building something other people in Cursor Boston actually play.

HOW TO START CONTRIBUTING

  1. Play first. Even a 10-minute session gives you ideas. ${GAME_URL}
  2. Look at open issues labeled "game": ${ISSUES_URL}
  3. Read the repo: ${REPO_URL} — start with lib/game/ and app/game/
  4. Open a PR with the change you want to see. Even a one-line balance tweak with a test is a great first contribution.
  5. Stuck or want a starter task? Reply to this email and I'll point you at something sized to your interest and skill level.

If any of this lights you up — game logic, the math of balancing, the design surface, or just being a really vocal playtester — I'd genuinely love to hear from you.

— Roger
roger@cursorboston.com
https://cursorboston.com

---
You're receiving this because you registered for a Cursor Boston event.
Don't want to hear from us? ${unsubUrl}
`;

  return { subject, html, text };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const send = process.argv.includes("--send");
  if (!dryRun && !send) {
    console.error("Pass --dry-run or --send.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS)."
    );
    process.exit(1);
  }

  await syncMailgunSuppressions(db);

  console.log("Loading contacts from eventContacts…");
  const snap = await db.collection("eventContacts").get();
  console.log(`Total contacts: ${snap.size}`);

  const contacts: ContactData[] = [];
  let skippedUnsubscribed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.unsubscribed === true) {
      skippedUnsubscribed++;
      continue;
    }
    contacts.push({
      email: data.email || doc.id,
      name: data.name || "",
      firstName: data.firstName || "",
    });
  }

  console.log(
    `Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsubscribed}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = contacts[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML preview (first 1500 chars) ---");
      console.log(html.slice(0, 1500));
      console.log("\n--- Text preview (first 1500 chars) ---");
      console.log(text.slice(0, 1500));
    }
    console.log(`\nWould send to ${contacts.length} contacts.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const contact of contacts) {
    const { subject, html, text } = buildEmail(contact);
    try {
      await sendEmail({ to: contact.email, subject, html, text });
      sent++;
      if (sent % 50 === 0) {
        console.log(`  Progress: ${sent}/${contacts.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${contact.email}`, e);
    }
    await sleep(450);
  }

  console.log(
    `\nDone. Sent ${sent}, failed ${failed}, skipped ${skippedUnsubscribed}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
