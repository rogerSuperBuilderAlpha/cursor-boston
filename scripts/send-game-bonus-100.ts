#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-shot bonus-grant notification — emails every real (non-NPC) player who
 * received the +100 bonus grant keyed by BONUS_KEY. Personalizes with caste +
 * current balance. Pair with scripts/admin-grant-100-bonus.ts (run grant
 * first so the balance shown is accurate).
 *
 * Idempotent via `bonusEmailsSent` map on the player doc, keyed by BONUS_KEY.
 *
 * Usage:
 *   npx tsx scripts/send-game-bonus-100.ts --dry-run
 *   npx tsx scripts/send-game-bonus-100.ts --send
 *   npx tsx scripts/send-game-bonus-100.ts --send --force
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

const BONUS_KEY = "2026-05-20-bonus-100";
const GAME_URL = "https://cursorboston.com/game";

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

function buildEmailContent(r: Recipient): { subject: string; html: string; text: string } {
  const first = escapeHtml(r.firstName?.trim() || "general");
  const general = escapeHtml(r.displayName?.trim() || "your general");
  const balance = r.turnsRemaining;
  const casteLine = r.caste
    ? `Your ${escapeHtml(r.caste)} caste has the run of the field.`
    : "";
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = `Surprise: +100 bonus turns for everyone — yours just landed`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Today every active general got a <strong>+100 turn bonus</strong> on the house. <strong>${general}</strong> is one of them. ${casteLine}</p>

<p>Your current bucket: <strong>${balance} turns</strong>.</p>

<p>This is a one-time gift on top of the normal Sunday grant — no PR required, no strings. Burn them on recruiting, attacks, spells, exploration — whatever moves you up the leaderboard.</p>

<p>
  <a href="${GAME_URL}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open /game →
  </a>
</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you have an active general at cursorboston.com/game.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "general"},

Today every active general got a +100 turn bonus on the house. ${r.displayName?.trim() || "Your general"} is one of them.${r.caste ? ` Your ${r.caste} caste has the run of the field.` : ""}

Your current bucket: ${balance} turns.

This is a one-time gift on top of the normal Sunday grant — no PR required, no strings. Burn them on recruiting, attacks, spells, exploration — whatever moves you up the leaderboard.

Open /game: ${GAME_URL}

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

  console.log(`Bonus key: ${BONUS_KEY}`);
  console.log("Loading real players...");
  const playersSnap = await db.collection("game_players").get();

  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const emailByUserId = new Map<string, string>();
  for (const doc of appsSnap.docs) {
    const d = doc.data() as { userId?: string; email?: string };
    if (d.userId && d.email) emailByUserId.set(d.userId, d.email.trim());
  }

  const recipients: Recipient[] = [];
  let skippedNpc = 0;
  let skippedNoBonus = 0;
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;

  for (const doc of playersSnap.docs) {
    const d = doc.data() as {
      isNpc?: boolean;
      displayName?: string;
      caste?: string | null;
      turnsRemaining?: number;
      bonusGrantsApplied?: Record<string, unknown>;
      bonusEmailsSent?: Record<string, unknown>;
    };
    if (d.isNpc === true) {
      skippedNpc++;
      continue;
    }
    if (!d.bonusGrantsApplied?.[BONUS_KEY]) {
      skippedNoBonus++;
      continue;
    }
    if (!force && d.bonusEmailsSent?.[BONUS_KEY]) {
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

  console.log(`Eligible (got bonus, not yet emailed, has email): ${recipients.length}`);
  console.log(`Skipped — NPC: ${skippedNpc}`);
  console.log(`Skipped — bonus not applied: ${skippedNoBonus}`);
  console.log(`Skipped — already emailed (${BONUS_KEY}): ${skippedAlreadyEmailed}`);
  console.log(`Skipped — no email on cohort application: ${skippedNoEmail}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmailContent(sample);
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
    const { subject, html, text } = buildEmailContent(r);
    try {
      await sendEmail({ to: r.email, subject, html, text });
      await db
        .collection("game_players")
        .doc(r.userId)
        .update({
          [`bonusEmailsSent.${BONUS_KEY}`]: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
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
