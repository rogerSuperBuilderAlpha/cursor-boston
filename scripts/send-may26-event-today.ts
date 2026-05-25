#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Day-of broadcast for the May 26 Sports Hack.
 *
 * Audience: union of website signups (`hackathonEventSignups`) + Luma /
 * Partiful approved (`hackathonLumaRegistrants` — refreshed 2026-05-25 by
 * scripts/sync-may26-partiful-and-luma.ts), deduped by email + matching
 * GitHub login. Filters out judges, declined emails, unsubscribed, and
 * anything already stamped with `sportsHack2026EventTodayEmailedAt`.
 *
 * Single message (no segmentation) — day-of logistics + schedule + prizes.
 *
 * Usage:
 *   npx tsx scripts/send-may26-event-today.ts --dry-run
 *   npx tsx scripts/send-may26-event-today.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-may26-event-today.ts --send
 *   npx tsx scripts/send-may26-event-today.ts --send --force
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import {
  getDeclinedEmailsForEvent,
  getJudgeEmailsForEvent,
} from "../lib/hackathon-event-signup";
import {
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_NAME,
} from "../lib/sports-hack-2026";

const EVENT_ID = SPORTS_HACK_2026_EVENT_ID;
const STAMP_FIELD = "sportsHack2026EventTodayEmailedAt";

const FROM_ADDRESS = "Roger <roger@cursorboston.com>";

interface Recipient {
  email: string;
  firstName: string;
  source: "website" | "luma";
  sourceDocId: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getOnlyEmailFlag(): string | null {
  const a = process.argv.find((x) => x.startsWith("--only-email="));
  return a ? a.slice("--only-email=".length).trim().toLowerCase() : null;
}

function firstNameFrom(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().split(/\s+/)[0] ?? "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildEmail(r: Recipient): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = "Sports Hack TODAY — 9am check-in, eat before you come, pizza @ 2:30";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Today is <strong>${escapeHtml(SPORTS_HACK_2026_NAME)}</strong> at Hult International, Cambridge. A few quick logistics so you arrive ready.</p>

<div style="border:2px solid #b91c1c;border-radius:8px;padding:14px;margin:18px 0;background:#fef2f2;color:#7f1d1d;text-align:center;">
  <p style="margin:0;font-size:18px;font-weight:700;">EAT + GRAB COFFEE BEFORE YOU COME.</p>
  <p style="margin:6px 0 0 0;font-size:14px;">No coffee or food in the AM. Pizza + drinks arrive around 2:30pm — plan ahead if you need to eat before then.</p>
</div>

<h3 style="margin-top:22px;margin-bottom:10px;">When to arrive</h3>
<ul style="padding-left:20px;">
  <li style="margin-bottom:8px;"><strong>Check-in opens around 9am.</strong> Show by 10am if you can — earlier is better.</li>
  <li style="margin-bottom:8px;">200-person venue. Don&apos;t cut it close.</li>
</ul>

<h3 style="margin-top:22px;margin-bottom:10px;">The day</h3>
<ol style="padding-left:20px;">
  <li style="margin-bottom:8px;"><strong>Talk from Antonio Mele</strong> (London School of Economics) — kicks off the morning.</li>
  <li style="margin-bottom:8px;"><strong>Hackathon sprint</strong> — build for two hours after the talk.</li>
  <li style="margin-bottom:8px;"><strong>Submit your project</strong> → you get a <strong>Cursor credit link</strong>. Everyone who submits gets one.</li>
  <li style="margin-bottom:8px;"><strong>Pizza + drinks ~2:30pm.</strong></li>
  <li style="margin-bottom:8px;"><strong>6 winners total: 3 AI-judged + 3 human-judge picked.</strong> Winners announced at 4pm.</li>
</ol>

<h3 style="margin-top:22px;margin-bottom:10px;">Bring</h3>
<ul style="padding-left:20px;">
  <li style="margin-bottom:6px;">Laptop, charger, whatever you need to build (your own infra — no shared machines).</li>
  <li style="margin-bottom:6px;">Coffee + something to eat <strong>before you walk in</strong>.</li>
</ul>

<p style="margin-top:22px;">See you at Hult.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you registered for the Cursor Boston May 26 event on Luma, Partiful, or the website.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Today is ${SPORTS_HACK_2026_NAME} at Hult International, Cambridge. A few quick logistics so you arrive ready.

⚠️ EAT + GRAB COFFEE BEFORE YOU COME.
No coffee or food in the AM. Pizza + drinks arrive around 2:30pm —
plan ahead if you need to eat before then.

WHEN TO ARRIVE
  - Check-in opens around 9am. Show by 10am if you can — earlier is better.
  - 200-person venue. Don't cut it close.

THE DAY
  1. Talk from Antonio Mele (London School of Economics) — kicks off the morning.
  2. Hackathon sprint — build for two hours after the talk.
  3. Submit your project → you get a Cursor credit link. Everyone who submits gets one.
  4. Pizza + drinks ~2:30pm.
  5. 6 winners total: 3 AI-judged + 3 human-judge picked. Winners announced at 4pm.

BRING
  - Laptop, charger, whatever you need to build (your own infra — no shared machines).
  - Coffee + something to eat BEFORE you walk in.

See you at Hult.

— Roger
roger@cursorboston.com

---
You're receiving this because you registered for the Cursor Boston May 26 event on Luma, Partiful, or the website.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const send = process.argv.includes("--send");
  const force = process.argv.includes("--force");
  const onlyEmail = getOnlyEmailFlag();
  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  if (send && (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN)) {
    console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }
  if (send) await syncMailgunSuppressions(db);

  const signupSnap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", EVENT_ID)
    .get();
  const websiteUserIds = signupSnap.docs
    .map((d) => d.data().userId as string | undefined)
    .filter((u): u is string => Boolean(u));
  const userMap = new Map<string, FirebaseFirestore.DocumentData>();
  for (let i = 0; i < websiteUserIds.length; i += 10) {
    const chunk = websiteUserIds.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) if (s.exists) userMap.set(s.id, s.data() ?? {});
  }
  console.log(`Website signups (${EVENT_ID}): ${signupSnap.size}`);

  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", EVENT_ID)
    .get();
  console.log(`Luma+Partiful registrants (${EVENT_ID}): ${lumaSnap.size}`);

  const ecSnap = await db.collection("eventContacts").get();
  const unsubscribedEmails = new Set<string>();
  for (const doc of ecSnap.docs) {
    if (doc.data().unsubscribed === true) {
      const e = (doc.data().email || doc.id).toString().trim().toLowerCase();
      if (e) unsubscribedEmails.add(e);
    }
  }
  console.log(`Unsubscribed emails (global): ${unsubscribedEmails.size}`);

  const judgeEmails = getJudgeEmailsForEvent(EVENT_ID);
  const declinedEmails = getDeclinedEmailsForEvent(EVENT_ID);

  const recipients: Recipient[] = [];
  const seenEmails = new Set<string>();
  const websiteGithubLogins = new Set<string>();

  let skippedAlreadyEmailed = 0;
  let skippedOnlyEmailFilter = 0;
  let skippedJudgeOrDeclined = 0;
  let skippedUnsubscribed = 0;
  let skippedNoEmail = 0;

  for (const doc of signupSnap.docs) {
    const data = doc.data();
    const userId = data.userId as string | undefined;
    if (!userId) { skippedNoEmail++; continue; }
    const profile = userMap.get(userId) ?? {};
    const email =
      typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null;
    if (!email) { skippedNoEmail++; continue; }
    if (judgeEmails.has(email) || declinedEmails.has(email)) { skippedJudgeOrDeclined++; continue; }
    if (unsubscribedEmails.has(email)) { skippedUnsubscribed++; continue; }
    if (!force && data[STAMP_FIELD]) { skippedAlreadyEmailed++; continue; }
    if (onlyEmail && email !== onlyEmail) { skippedOnlyEmailFilter++; continue; }
    seenEmails.add(email);
    const ghLogin =
      profile.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login ?? null
        : null;
    if (ghLogin) websiteGithubLogins.add(ghLogin.toLowerCase());
    recipients.push({
      email,
      firstName: firstNameFrom(
        typeof profile.displayName === "string" ? profile.displayName : "",
      ),
      source: "website",
      sourceDocId: doc.id,
    });
  }

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string | undefined)?.trim().toLowerCase() ?? "";
    if (!email) { skippedNoEmail++; continue; }
    if (judgeEmails.has(email) || declinedEmails.has(email)) { skippedJudgeOrDeclined++; continue; }
    if (unsubscribedEmails.has(email)) { skippedUnsubscribed++; continue; }
    if (seenEmails.has(email)) continue;
    const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
    if (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase())) continue;
    if (!force && d[STAMP_FIELD]) { skippedAlreadyEmailed++; continue; }
    if (onlyEmail && email !== onlyEmail) { skippedOnlyEmailFilter++; continue; }
    seenEmails.add(email);
    recipients.push({
      email,
      firstName: firstNameFrom(typeof d.name === "string" ? d.name : ""),
      source: "luma",
      sourceDocId: doc.id,
    });
  }

  console.log(`\nRecipients: ${recipients.length}${onlyEmail ? ` (--only-email=${onlyEmail})` : ""}`);
  const wsCount = recipients.filter((r) => r.source === "website").length;
  console.log(`  Website-signup recipients:        ${wsCount}`);
  console.log(`  Luma/Partiful-only recipients:    ${recipients.length - wsCount}`);
  console.log(`Skipped — judge/declined:           ${skippedJudgeOrDeclined}`);
  console.log(`Skipped — unsubscribed:             ${skippedUnsubscribed}`);
  console.log(`Skipped — no email:                 ${skippedNoEmail}`);
  console.log(`Skipped — already emailed (stamp):  ${skippedAlreadyEmailed}`);
  if (onlyEmail) console.log(`Skipped — --only-email filter:      ${skippedOnlyEmailFilter}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, text } = buildEmail(sample);
      console.log(`=== Sample → ${sample.email} ===`);
      console.log(`Subject: ${subject}`);
      console.log("--- Text ---");
      console.log(text);
    }
    console.log(`\nWould send to ${recipients.length} recipients.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r);
    try {
      await sendEmail({ from: FROM_ADDRESS, to: r.email, subject, html, text });
      const collection =
        r.source === "website" ? "hackathonEventSignups" : "hackathonLumaRegistrants";
      await db
        .collection(collection)
        .doc(r.sourceDocId)
        .update({ [STAMP_FIELD]: FieldValue.serverTimestamp() })
        .catch((e) => console.warn(`  [stamp-fail] ${r.email}`, e));
      sent++;
      console.log(`  [ok] ${r.email}`);
      if (sent % 25 === 0) console.log(`  Progress: ${sent}/${recipients.length}`);
    } catch (e) {
      failed++;
      console.error(`  [fail] ${r.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
