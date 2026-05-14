#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * /game jumpstart — emails Cohort 1 admits who have NOT yet created a
 * /game player, telling them they have a 300-turn starting bucket and a
 * brand-new first-run wizard waiting at /game.
 *
 * Idempotent via `gameJumpstartEmailedAt` on the application doc.
 *
 * Usage:
 *   npx tsx scripts/send-game-jumpstart-300.ts --dry-run
 *   npx tsx scripts/send-game-jumpstart-300.ts --send
 *   npx tsx scripts/send-game-jumpstart-300.ts --send --force
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const GAME_URL = "https://cursorboston.com/game";
const STAMP_FIELD = "gameJumpstartEmailedAt";

interface Recipient {
  applicationId: string;
  userId: string;
  email: string;
  firstName: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmail(r: Recipient): { subject: string; html: string; text: string } {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = "Your /game general is waiting — 300 turns to get started";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>You're admitted to Cohort 1 but haven't fired up <strong>/game</strong> yet — and the rest of the cohort is already racking up territory and PRs against it. Time to claim your general.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">What's waiting for you</h3>
<ul style="padding-left:20px;">
  <li><strong>300 turns</strong> in your starting bucket — enough to clear setup (claim 25 lands, pick a caste) and still have a substantial pool for early recruiting and your first attacks.</li>
  <li><strong>Brand-new first-run wizard</strong> we just shipped — walks you through tile distribution, caste selection, and your first moves so you don't have to read the docs to get going.</li>
  <li><strong>+100 turns every Sunday</strong> on top of whatever you've banked, as long as you merged a PR that week. No cap on banking — hoarders win.</li>
</ul>

<h3 style="margin-top:24px;margin-bottom:8px;">Why play it</h3>
<p>The whole point: it's a real persistent web game built inside the same repo we use for everything else. Recruit units, run threats, cast spells, climb the leaderboard. And if you spot something you'd want different — a new spell, a tile-type tweak, a UI fix — <strong>open a PR</strong>. Contributions to /game are exactly the kind of work this cohort is here to do.</p>

<p>
  <a href="${GAME_URL}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Start playing →
  </a>
</p>

<p style="font-size:14px;color:#6b7280;">10 minutes is all the wizard needs. Most of the cohort is in the <code>distribute</code> or <code>play</code> phase already — catch up before the leaderboard locks in.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you're an admitted member of Cursor Boston Cohort 1.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "there"},

You're admitted to Cohort 1 but haven't fired up /game yet — and the rest of the cohort is already racking up territory and PRs against it. Time to claim your general.

WHAT'S WAITING FOR YOU
  • 300 turns in your starting bucket — enough to clear setup (claim 25 lands, pick a caste) and still have a substantial pool for early recruiting and your first attacks.
  • Brand-new first-run wizard we just shipped — walks you through tile distribution, caste selection, and your first moves.
  • +100 turns every Sunday on top of whatever you've banked, as long as you merged a PR that week. No cap on banking — hoarders win.

WHY PLAY IT
The whole point: it's a real persistent web game built inside the same repo we use for everything else. Recruit units, run threats, cast spells, climb the leaderboard. And if you spot something you'd want different — a new spell, a tile-type tweak, a UI fix — open a PR. Contributions to /game are exactly the kind of work this cohort is here to do.

Start playing: ${GAME_URL}

10 minutes is all the wizard needs.

— Roger
roger@cursorboston.com

---
You're receiving this because you're an admitted member of Cursor Boston Cohort 1.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const send = process.argv.includes("--send");
  const force = process.argv.includes("--force");
  if (!dryRun && !send) {
    console.error("Pass --dry-run or --send.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  console.log("Loading cohort-1 admits + existing players...");
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const playersSnap = await db.collection("game_players").get();
  const playerUserIds = new Set<string>();
  for (const p of playersSnap.docs) {
    const d = p.data() as { isNpc?: boolean };
    if (d.isNpc !== true) playerUserIds.add(p.id);
  }

  const recipients: Recipient[] = [];
  let skippedNotAdmitted = 0;
  let skippedAlreadyPlaying = 0;
  let skippedNoUserId = 0;
  let skippedNoEmail = 0;
  let skippedAlreadyEmailed = 0;

  for (const appDoc of appsSnap.docs) {
    const d = appDoc.data() as {
      cohorts?: string[];
      status?: string;
      userId?: string;
      email?: string;
      name?: string;
      [STAMP_FIELD]?: unknown;
    };
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts : [];
    if (!cohorts.includes("cohort-1")) continue;
    if (d.status !== "admitted") {
      skippedNotAdmitted++;
      continue;
    }
    if (!d.userId) {
      skippedNoUserId++;
      continue;
    }
    if (playerUserIds.has(d.userId)) {
      skippedAlreadyPlaying++;
      continue;
    }
    if (!d.email) {
      skippedNoEmail++;
      continue;
    }
    if (!force && d[STAMP_FIELD]) {
      skippedAlreadyEmailed++;
      continue;
    }
    const name = d.name?.trim() || "";
    const firstName = name.split(" ")[0] || "";
    recipients.push({
      applicationId: appDoc.id,
      userId: d.userId,
      email: d.email.trim(),
      firstName,
    });
  }

  console.log(`Eligible (admitted, not playing, not yet emailed): ${recipients.length}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — already playing: ${skippedAlreadyPlaying}`);
  console.log(`Skipped — no userId: ${skippedNoUserId}`);
  console.log(`Skipped — no email: ${skippedNoEmail}`);
  console.log(`Skipped — already emailed: ${skippedAlreadyEmailed}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML preview (first 1800 chars) ---");
      console.log(html.slice(0, 1800));
      console.log("\n--- Text preview (first 1800 chars) ---");
      console.log(text.slice(0, 1800));
    }
    console.log(`\nWould send to ${recipients.length} contacts.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r);
    try {
      await sendEmail({ to: r.email, subject, html, text });
      await db
        .collection(SUMMER_COHORT_COLLECTION)
        .doc(r.applicationId)
        .update({ [STAMP_FIELD]: FieldValue.serverTimestamp() });
      sent++;
      if (sent % 25 === 0) console.log(`  Progress: ${sent}/${recipients.length}`);
    } catch (e) {
      failed++;
      console.error(`Failed: ${r.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
