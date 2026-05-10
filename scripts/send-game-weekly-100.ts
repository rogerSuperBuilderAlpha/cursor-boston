#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Weekly turn-grant notification — emails real (non-NPC) /game players
 * after the Sunday rollover lands their +100 turns. Personalizes with
 * caste + current balance.
 *
 * Idempotent via `weekly100EmailWeekStart` on the player doc; re-running
 * the same week is a no-op for anyone already emailed.
 *
 * Usage:
 *   npx tsx scripts/send-game-weekly-100.ts --dry-run
 *   npx tsx scripts/send-game-weekly-100.ts --send
 *   npx tsx scripts/send-game-weekly-100.ts --send --force
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
import { weekStartIsoForRollover } from "../lib/game/turns";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const GAME_URL = "https://cursorboston.com/game";
const STAMP_FIELD = "weekly100EmailWeekStart";

interface Recipient {
  userId: string;
  email: string;
  firstName: string;
  displayName: string;
  caste: string | null;
  turnsRemaining: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmail(r: Recipient): { subject: string; html: string; text: string } {
  const first = escapeHtml(r.firstName?.trim() || "general");
  const general = escapeHtml(r.displayName?.trim() || "your general");
  const balance = r.turnsRemaining;
  const casteLine = r.caste ? `Your ${escapeHtml(r.caste)} caste is ready for the week.` : "";
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = `+100 turns just landed on ${general}`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Sunday rollover went through — <strong>${general} just got +100 turns</strong>. ${casteLine}</p>

<p>Your current bucket: <strong>${balance} turns</strong>.</p>

<p>The grant <em>adds</em> to whatever you'd banked, so hoarders win. There's no cap. Spend them on recruiting, attacks, spells, exploration — whatever moves you up the leaderboard before next Sunday's refill.</p>

<p>
  <a href="${GAME_URL}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open /game →
  </a>
</p>

<p style="font-size:14px;color:#6b7280;">Reminder: weekly grants only fire if you merged a PR in the prior 7 days. If you want next Sunday's 100, ship something this week — even a tiny PR to /game counts.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you have an active general at cursorboston.com/game.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "general"},

Sunday rollover went through — ${r.displayName?.trim() || "your general"} just got +100 turns.${r.caste ? ` Your ${r.caste} caste is ready for the week.` : ""}

Your current bucket: ${balance} turns.

The grant adds to whatever you'd banked, so hoarders win. There's no cap. Spend them on recruiting, attacks, spells, exploration — whatever moves you up the leaderboard before next Sunday's refill.

Open /game: ${GAME_URL}

Reminder: weekly grants only fire if you merged a PR in the prior 7 days. If you want next Sunday's 100, ship something this week.

— Roger
roger@cursorboston.com

---
You're receiving this because you have an active general at cursorboston.com/game.
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

  const wkStart = weekStartIsoForRollover(new Date());
  console.log(`Week start: ${wkStart}`);
  console.log("Loading real players...");
  const playersSnap = await db.collection("game_players").get();

  // Build userId → email lookup from cohort applications
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const emailByUserId = new Map<string, string>();
  for (const doc of appsSnap.docs) {
    const d = doc.data() as { userId?: string; email?: string };
    if (d.userId && d.email) emailByUserId.set(d.userId, d.email.trim());
  }

  const recipients: Recipient[] = [];
  let skippedNpc = 0;
  let skippedNoGrant = 0;
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;

  for (const doc of playersSnap.docs) {
    const d = doc.data() as {
      isNpc?: boolean;
      displayName?: string;
      caste?: string | null;
      turnsRemaining?: number;
      lastWeeklyGrantWeekStart?: string;
      [STAMP_FIELD]?: string;
    };
    if (d.isNpc === true) {
      skippedNpc++;
      continue;
    }
    if (d.lastWeeklyGrantWeekStart !== wkStart) {
      skippedNoGrant++;
      continue;
    }
    if (!force && d[STAMP_FIELD] === wkStart) {
      skippedAlreadyEmailed++;
      continue;
    }
    const email = emailByUserId.get(doc.id);
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    const displayName = (d.displayName || "").trim() || "your general";
    const firstName = displayName.split(" ")[0] || "general";
    recipients.push({
      userId: doc.id,
      email,
      firstName,
      displayName,
      caste: d.caste ?? null,
      turnsRemaining: d.turnsRemaining ?? 0,
    });
  }

  console.log(`Eligible (granted this week, not yet emailed): ${recipients.length}`);
  console.log(`Skipped — NPC: ${skippedNpc}`);
  console.log(`Skipped — no grant this week: ${skippedNoGrant}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}=${wkStart}): ${skippedAlreadyEmailed}`);
  console.log(`Skipped — no email on cohort application: ${skippedNoEmail}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML preview (first 1500 chars) ---");
      console.log(html.slice(0, 1500));
      console.log("\n--- Text preview (first 1500 chars) ---");
      console.log(text.slice(0, 1500));
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
        .collection("game_players")
        .doc(r.userId)
        .update({ [STAMP_FIELD]: wkStart, updatedAt: FieldValue.serverTimestamp() });
      sent++;
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
