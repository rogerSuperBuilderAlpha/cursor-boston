#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-off "This Week in the World" game digest to the full community
 * (eventContacts), respecting unsubscribes + Mailgun suppressions.
 *
 * Content is a recap of the last 7 days in the tile-strategy game: kingdoms
 * that grew big, new heroes that emerged, and the state of the war. Figures
 * are pulled from live game data (see the dry-run note in the chat that
 * generated this) as of 2026-06-03.
 *
 * Usage:
 *   npx tsx scripts/send-game-digest-2026-06-03.ts --dry-run
 *   npx tsx scripts/send-game-digest-2026-06-03.ts --send
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const GAME_URL = "https://cursorboston.com/game";
const COHORT_URL = "https://cursorboston.com/summer-cohort";

// Per-recipient Cohort 2 state, derived from their summer-cohort application:
//   "in"       — applied (pending or admitted) and not withdrawn → we're
//                admitting everyone who's applied; official confirmation lands
//                the weekend after June 19.
//   "comeback" — previously withdrew → warm re-invite.
//   "apply"    — no Cohort 2 application on file → invite to apply.
type Cohort2State = "in" | "comeback" | "apply";

interface ContactData {
  email: string;
  name: string;
  firstName: string;
  c2: Cohort2State;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Dynamic Cohort 2 opener, keyed off the recipient's application state. The
// official admission weekend is after June 19, so applicants are told they're
// in with that confirmation date — no promises beyond it.
function cohort2BlockHtml(state: Cohort2State): string {
  if (state === "in") {
    return `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
<p style="margin:0;"><strong>🎉 You're in for Cohort 2.</strong> We're admitting everyone who's applied so far — you're on the list. We'll send official confirmation and next steps the weekend after <strong>June 19</strong>. Nothing to do right now but get ready.</p>
</div>`;
  }
  if (state === "comeback") {
    return `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
<p style="margin:0;"><strong>The door's still open for Cohort 2.</strong> We saw you stepped back earlier — if the timing works better now, we'd love to have you. Re-apply and you're in; we send official confirmations the weekend after <strong>June 19</strong>. <a href="${COHORT_URL}" style="color:#2563eb;">Rejoin Cohort 2 →</a></p>
</div>`;
  }
  return `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
<p style="margin:0;"><strong>Cohort 2 is filling up — want in?</strong> Applications are open now, and we're admitting applicants on a rolling basis with official decisions the weekend after <strong>June 19</strong>. If you've been meaning to join, now's the time. <a href="${COHORT_URL}" style="color:#b45309;">Apply for Cohort 2 →</a></p>
</div>`;
}

function cohort2BlockText(state: Cohort2State): string {
  if (state === "in") {
    return `YOU'RE IN FOR COHORT 2
We're admitting everyone who's applied so far — you're on the list. We'll send official confirmation and next steps the weekend after June 19. Nothing to do right now but get ready.
`;
  }
  if (state === "comeback") {
    return `THE DOOR'S STILL OPEN FOR COHORT 2
We saw you stepped back earlier — if the timing works better now, we'd love to have you. Re-apply and you're in; we send official confirmations the weekend after June 19.
Rejoin: ${COHORT_URL}
`;
  }
  return `COHORT 2 IS FILLING UP — WANT IN?
Applications are open now, and we're admitting applicants on a rolling basis with official decisions the weekend after June 19. If you've been meaning to join, now's the time.
Apply: ${COHORT_URL}
`;
}

function buildEmail(contact: ContactData): { subject: string; html: string; text: string } {
  const first = escapeHtml(
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"
  );
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const subject = "This Week in the World — kingdoms rise, 42 heroes emerge ⚔️";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

${cohort2BlockHtml(contact.c2)}

<p>Now — the world has been busy. Here's your weekly dispatch from the front, what shifted across the map over the last seven days.</p>

<h3 style="margin-top:28px;margin-bottom:8px;font-size:16px;">🏰 The biggest kingdoms</h3>
<p>The map is held by <strong>74 rulers</strong> (24 of you, plus 50 NPC warbands) across <strong>7,166 tiles</strong>. The largest realms right now:</p>
<ol style="padding-left:20px;margin-top:4px;">
  <li style="margin-bottom:4px;"><strong>Ulysses</strong> (red) — <strong>469 tiles</strong>, far and away the largest realm in the world</li>
  <li style="margin-bottom:4px;"><strong>Roger Man v2</strong> (black) — 305 tiles, and the most battle-hardened ruler standing (41 wins)</li>
  <li style="margin-bottom:4px;"><strong>Potato Defender</strong> (blue) — 197 tiles and 30 victories, holding a contested frontier</li>
  <li style="margin-bottom:4px;"><strong>Captain Lighthouse</strong> (blue) — 189 tiles</li>
  <li style="margin-bottom:4px;"><strong>Julylu None</strong> (black) — 178 tiles, with a standing army of 250</li>
</ol>
<p style="font-size:13px;color:#555;">Also climbing fast: IngeniousGeneral, Dark Shadow, and Ass-Kicker — the latter only joined this week and already holds 125 tiles.</p>

<h3 style="margin-top:28px;margin-bottom:8px;font-size:16px;">🦸 New heroes have emerged</h3>
<p><strong>42 new heroes</strong> walked onto the map this week — siege-lords, sky-knights, raiders and supply-captains. A few who rallied to player banners:</p>
<ul style="padding-left:20px;margin-top:4px;">
  <li style="margin-bottom:4px;"><strong>Brown Magic</strong> drew three to the white banner — <em>Father Esmond</em>, <em>Lord Tomas</em>, and <em>Knight-Lector Storne</em>.</li>
  <li style="margin-bottom:4px;"><strong>Roger Man v2</strong> raised <em>The Echo of Vask</em>, a raid-specialist of the black caste.</li>
  <li style="margin-bottom:4px;"><strong>Julylu None</strong> gained <em>Wraith-Captain Sehl</em> and <em>Halrik Twice-Buried</em>.</li>
  <li style="margin-bottom:4px;"><strong>Captain Lighthouse</strong> took <em>Captain Whitewing</em>; <strong>Potato Defender</strong> took <em>Sky-Knight Henrik</em>.</li>
</ul>
<p style="font-size:13px;color:#555;">Not all of them will live long: five heroes were already slain in battle this week, including Vurn the Reluctant and the short-lived Hrolfgar Again.</p>

<h3 style="margin-top:28px;margin-bottom:8px;font-size:16px;">⚔️ The state of the war</h3>
<p>It was a bloody week: <strong>1,049 attacks</strong> were launched and <strong>91 tiles changed hands</strong>. Much of that churn is the NPC warbands grinding against each other along the borders — Bram Hollowwind, Captain Idriel and Khorvath were the most relentless conquerors — so there's open territory and weakened neighbors out there for anyone ready to push.</p>

<p style="margin-top:20px;">
  <a href="${GAME_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Check your kingdom →
  </a>
</p>

<p>Your turns are waiting. See you on the map.</p>

<p>— The Cursor Boston team</p>

<p style="font-size:12px;color:#888;margin-top:24px;border-top:1px solid #e5e5e5;padding-top:16px;">
You're receiving this because you registered for a Cursor Boston event. <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a> at any time.
</p>
</body></html>`;

  const text = `Hi ${first},

${cohort2BlockText(contact.c2)}
Now — the world has been busy. Here's your weekly dispatch from the front, what shifted across the map over the last seven days.

THE BIGGEST KINGDOMS
The map is held by 74 rulers (24 of you, plus 50 NPC warbands) across 7,166 tiles. The largest realms right now:
  1. Ulysses (red) — 469 tiles, far and away the largest realm in the world
  2. Roger Man v2 (black) — 305 tiles, and the most battle-hardened ruler standing (41 wins)
  3. Potato Defender (blue) — 197 tiles and 30 victories, holding a contested frontier
  4. Captain Lighthouse (blue) — 189 tiles
  5. Julylu None (black) — 178 tiles, with a standing army of 250
Also climbing fast: IngeniousGeneral, Dark Shadow, and Ass-Kicker — the latter only joined this week and already holds 125 tiles.

NEW HEROES HAVE EMERGED
42 new heroes walked onto the map this week — siege-lords, sky-knights, raiders and supply-captains. A few who rallied to player banners:
  - Brown Magic drew three to the white banner: Father Esmond, Lord Tomas, and Knight-Lector Storne.
  - Roger Man v2 raised The Echo of Vask, a raid-specialist of the black caste.
  - Julylu None gained Wraith-Captain Sehl and Halrik Twice-Buried.
  - Captain Lighthouse took Captain Whitewing; Potato Defender took Sky-Knight Henrik.
Not all of them will live long: five heroes were already slain in battle this week, including Vurn the Reluctant and the short-lived Hrolfgar Again.

THE STATE OF THE WAR
It was a bloody week: 1,049 attacks were launched and 91 tiles changed hands. Much of that churn is the NPC warbands grinding against each other along the borders — Bram Hollowwind, Captain Idriel and Khorvath were the most relentless conquerors — so there's open territory and weakened neighbors out there for anyone ready to push.

Check your kingdom: ${GAME_URL}

Your turns are waiting. See you on the map.

— The Cursor Boston team

---
You're receiving this because you registered for a Cursor Boston event.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const send = args.includes("--send");
  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  // Mirror Mailgun bounces/complaints into eventContacts.unsubscribed first.
  if (send) {
    console.log("Syncing Mailgun suppressions…");
    await syncMailgunSuppressions(db);
  }

  // Map each email -> Cohort 2 application state, so the opener is dynamic.
  console.log("Loading Cohort 2 application states…");
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const c2ByEmail = new Map<string, Cohort2State>();
  for (const doc of appsSnap.docs) {
    const x = doc.data() as Record<string, unknown>;
    const cohorts = Array.isArray(x.cohorts) ? (x.cohorts as string[]) : [];
    if (!cohorts.includes("cohort-2")) continue;
    const email = String(x.email ?? "").trim().toLowerCase();
    if (!email) continue;
    const status = String(x.status ?? "");
    // Admitting everyone who's applied → pending + admitted both read as "in".
    const state: Cohort2State = status === "withdrawn" ? "comeback" : "in";
    // If someone has multiple rows, prefer "in" over "comeback".
    if (c2ByEmail.get(email) !== "in") c2ByEmail.set(email, state);
  }

  console.log("Loading contacts from eventContacts…");
  const snap = await db.collection("eventContacts").get();
  console.log(`Total contacts: ${snap.size}`);

  const contacts: ContactData[] = [];
  let skippedUnsubscribed = 0;
  let skippedNoEmail = 0;
  const stateTally: Record<Cohort2State, number> = { in: 0, comeback: 0, apply: 0 };
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.unsubscribed === true) {
      skippedUnsubscribed++;
      continue;
    }
    const email = (data.email as string) || doc.id;
    if (!email || !email.includes("@")) {
      skippedNoEmail++;
      continue;
    }
    const c2 = c2ByEmail.get(email.trim().toLowerCase()) ?? "apply";
    stateTally[c2]++;
    contacts.push({
      email,
      name: (data.name as string) || "",
      firstName: (data.firstName as string) || "",
      c2,
    });
  }

  console.log(
    `Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsubscribed} | Skipped no-email: ${skippedNoEmail}`
  );
  console.log(
    `Cohort 2 openers — in: ${stateTally.in} | comeback: ${stateTally.comeback} | apply: ${stateTally.apply}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const { subject } = buildEmail(contacts[0] ?? { email: "x@y.com", name: "", firstName: "", c2: "apply" });
    console.log(`Subject (all recipients): ${subject}\n`);
    // Show the full email for each of the three Cohort 2 opener variants.
    for (const state of ["in", "comeback", "apply"] as Cohort2State[]) {
      const example =
        contacts.find((c) => c.c2 === state) ??
        ({ email: `${state}@example.com`, name: "Sample Person", firstName: "Sample", c2: state } as ContactData);
      const { html, text } = buildEmail(example);
      console.log(`\n========================================================`);
      console.log(`VARIANT: c2="${state}"   (example recipient: ${example.email})`);
      console.log(`========================================================`);
      console.log("--- HTML ---");
      console.log(html);
      console.log("\n--- Text ---");
      console.log(text);
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
      if (sent % 50 === 0) console.log(`  Progress: ${sent}/${contacts.length}`);
    } catch (e) {
      failed++;
      console.error(`Failed: ${contact.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}, skipped unsubscribed ${skippedUnsubscribed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
