#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-off announcement to all real (non-NPC) /game players:
 * the Saturday +100 turn grant requires a merged PR that week,
 * every week — and here are concrete contribution ideas (graphics,
 * lore) for players who aren't sure where to start.
 *
 * Idempotent via `prRequirementEmailedAt` on the player doc.
 *
 * Usage:
 *   npx tsx scripts/send-game-pr-requirement.ts --dry-run
 *   npx tsx scripts/send-game-pr-requirement.ts --send
 *   npx tsx scripts/send-game-pr-requirement.ts --send --force
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
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const STAMP_FIELD = "prRequirementEmailedAt";

interface Recipient {
  userId: string;
  email: string;
  firstName: string;
  displayName: string;
  caste: string | null;
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
  const casteLine = r.caste
    ? `Your ${escapeHtml(r.caste)} caste is on the board — keep it fed.`
    : "";
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = `Earn ${general}'s +100 turns: merge a PR this week`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick standing-rule reminder for everyone with a general at <a href="${GAME_URL}">cursorboston.com/game</a>:</p>

<p><strong>The Saturday +100 turn grant only fires for players who merged a PR in the prior 7 days. Every week. No PR, no 100.</strong> ${casteLine}</p>

<p>Turns are how you recruit, attack, cast, and explore. Miss a week and the leaderboard moves without you.</p>

<p>If you're not sure what to ship, two easy openings that the game genuinely needs:</p>

<ul>
  <li><strong>Graphics.</strong> Tile art, caste banners, artifact icons, attack-animation frames, leaderboard badges — anything visual. Drop SVG/PNG into <code>public/</code> and wire it into the relevant component. Even one icon counts.</li>
  <li><strong>Lore.</strong> Caste backstories, artifact origin myths, tile flavor text, NPC general bios. Most of the game's narrative lives in <code>content/</code> and the catalog files — extend them. A page of writing is a PR.</li>
</ul>

<p>Both are low-stakes, high-flavor, and won't conflict with anyone else's work. Either gets you on Saturday's list.</p>

<p>
  <a href="${REPO_URL}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px;">
    Open the repo →
  </a>
  <a href="${GAME_URL}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open /game →
  </a>
</p>

<p style="font-size:14px;color:#6b7280;">Ship something — even a tiny PR. Saturday rolls fast.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you have an active general at cursorboston.com/game.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "general"},

Quick standing-rule reminder for everyone with a general at ${GAME_URL}:

The Saturday +100 turn grant only fires for players who merged a PR in the prior 7 days. Every week. No PR, no 100.${r.caste ? ` Your ${r.caste} caste is on the board — keep it fed.` : ""}

Turns are how you recruit, attack, cast, and explore. Miss a week and the leaderboard moves without you.

If you're not sure what to ship, two easy openings the game genuinely needs:

  - Graphics. Tile art, caste banners, artifact icons, attack-animation frames, leaderboard badges. Drop SVG/PNG into public/ and wire it into the relevant component. Even one icon counts.

  - Lore. Caste backstories, artifact origin myths, tile flavor text, NPC general bios. Most narrative lives in content/ and the catalog files — extend them. A page of writing is a PR.

Both are low-stakes, high-flavor, and won't conflict with anyone else's work. Either gets you on Saturday's list.

Repo: ${REPO_URL}
Game: ${GAME_URL}

Ship something — even a tiny PR. Saturday rolls fast.

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
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;

  for (const doc of playersSnap.docs) {
    const d = doc.data() as {
      isNpc?: boolean;
      displayName?: string;
      caste?: string | null;
      [STAMP_FIELD]?: unknown;
    };
    if (d.isNpc === true) {
      skippedNpc++;
      continue;
    }
    if (!force && d[STAMP_FIELD] != null) {
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
    });
  }

  console.log(`Eligible (real, not yet emailed, has cohort email): ${recipients.length}`);
  console.log(`Skipped — NPC: ${skippedNpc}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD} set): ${skippedAlreadyEmailed}`);
  console.log(`Skipped — no email on cohort application: ${skippedNoEmail}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML preview ---");
      console.log(html);
      console.log("\n--- Text preview ---");
      console.log(text);
    }
    console.log(`\nRecipient emails (${recipients.length}):`);
    for (const r of recipients) console.log(`  - ${r.email}  (${r.displayName})`);
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
        .update({
          [STAMP_FIELD]: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      sent++;
      console.log(`Sent: ${r.email}`);
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
