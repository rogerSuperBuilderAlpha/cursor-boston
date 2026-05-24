#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Heads-up email for the May 26 list: the GitHub / Discord Connect
 * buttons on cursorboston.com were broken for most of Sun 2026-05-24
 * due to an Upstash rate-limit infrastructure outage. Fixed this
 * afternoon (release #1454 + #1452, deployed 17:14 ET). Anyone who
 * hit "Too many connect attempts" and gave up — try again now, it
 * just works.
 *
 * Recipient set mirrors send-may26-confirm-attendance.ts:
 * union of website signups + Luma-only, minus judges/declined/unsubscribed,
 * deduped by email + matching GitHub login. Carries its own stamp
 * (`sportsHack2026ConnectFixedEmailedAt`) so it does NOT collide with
 * the confirm-attendance send.
 *
 * Idempotent via `sportsHack2026ConnectFixedEmailedAt` stamped on:
 *   - hackathonEventSignups/{id} for website signups
 *   - hackathonLumaRegistrants/{id} for Luma-only attendees
 *
 * Usage:
 *   npx tsx scripts/send-may26-connect-fixed.ts --dry-run
 *   npx tsx scripts/send-may26-connect-fixed.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-may26-connect-fixed.ts --send
 *   npx tsx scripts/send-may26-connect-fixed.ts --send --force
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
const STAMP_FIELD = "sportsHack2026ConnectFixedEmailedAt";

const SIGNUP_URL = `https://cursorboston.com/hackathons/${EVENT_ID}/signup`;
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
  const arg = process.argv.find((a) => a.startsWith("--only-email="));
  if (!arg) return null;
  return arg.slice("--only-email=".length).trim().toLowerCase();
}

function buildEmail(r: Recipient): { subject: string; html: string; text: string } {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = "Connect Discord / GitHub now works — sorry, my fault earlier";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick heads-up for <strong>${escapeHtml(SPORTS_HACK_2026_NAME)}</strong> on Tuesday.</p>

<p>If you tried to <strong>Connect your Discord or GitHub</strong> on cursorboston.com today and got <em>&quot;Too many connect attempts&quot;</em> — it wasn&apos;t you. The site&apos;s rate-limit infrastructure was misconfigured and denying nearly every OAuth callback, even on the first try.</p>

<p><strong>That&apos;s fixed now</strong> (root cause: an Upstash Redis integration was never installed for the project, so the rate-limit backend was failing closed). Live as of about 1:15 PM ET. I just disconnected and reconnected my own GitHub end-to-end as a sanity check.</p>

<p>If you bailed out earlier, please try again:</p>

<p><a href="${SIGNUP_URL}" style="display:inline-block;padding:12px 22px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Go back and connect →</a></p>

<p>Connecting both GitHub and Discord is what gets you into Tier A on the ranking — and Tier A is who gets a confirmed seat + a shot at one of the 119 Cursor credit codes on Tuesday.</p>

<p>Sorry for the noise.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you registered for the Cursor Boston May 26 event on Luma, Partiful, or the website.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Quick heads-up for ${SPORTS_HACK_2026_NAME} on Tuesday.

If you tried to Connect your Discord or GitHub on cursorboston.com today and got "Too many connect attempts" — it wasn't you. The site's rate-limit infrastructure was misconfigured and denying nearly every OAuth callback, even on the first try.

That's fixed now (root cause: an Upstash Redis integration was never installed for the project, so the rate-limit backend was failing closed). Live as of about 1:15 PM ET. I just disconnected and reconnected my own GitHub end-to-end as a sanity check.

If you bailed out earlier, please try again:

  ${SIGNUP_URL}

Connecting both GitHub and Discord is what gets you into Tier A on the ranking — and Tier A is who gets a confirmed seat + a shot at one of the 119 Cursor credit codes on Tuesday.

Sorry for the noise.

— Roger
roger@cursorboston.com

---
You're receiving this because you registered for the Cursor Boston May 26 event on Luma, Partiful, or the website.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function firstNameFrom(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().split(/\s+/)[0] ?? "";
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
  console.log(`Luma registrants (${EVENT_ID}): ${lumaSnap.size}`);

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
    if (!userId) {
      skippedNoEmail++;
      continue;
    }
    const profile = userMap.get(userId) ?? {};
    const email =
      typeof profile.email === "string"
        ? profile.email.trim().toLowerCase()
        : null;
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (judgeEmails.has(email) || declinedEmails.has(email)) {
      skippedJudgeOrDeclined++;
      continue;
    }
    if (unsubscribedEmails.has(email)) {
      skippedUnsubscribed++;
      continue;
    }
    if (!force && data[STAMP_FIELD]) {
      skippedAlreadyEmailed++;
      continue;
    }
    if (onlyEmail && email !== onlyEmail) {
      skippedOnlyEmailFilter++;
      continue;
    }
    seenEmails.add(email);
    const ghLogin =
      profile.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login ?? null
        : null;
    if (ghLogin) websiteGithubLogins.add(ghLogin.toLowerCase());
    recipients.push({
      email,
      firstName: firstNameFrom(
        typeof profile.displayName === "string" ? profile.displayName : ""
      ),
      source: "website",
      sourceDocId: doc.id,
    });
  }

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string | undefined)?.trim().toLowerCase() ?? "";
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (judgeEmails.has(email) || declinedEmails.has(email)) {
      skippedJudgeOrDeclined++;
      continue;
    }
    if (unsubscribedEmails.has(email)) {
      skippedUnsubscribed++;
      continue;
    }
    if (seenEmails.has(email)) continue;
    const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
    if (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase())) continue;
    if (!force && d[STAMP_FIELD]) {
      skippedAlreadyEmailed++;
      continue;
    }
    if (onlyEmail && email !== onlyEmail) {
      skippedOnlyEmailFilter++;
      continue;
    }
    seenEmails.add(email);
    recipients.push({
      email,
      firstName: firstNameFrom(typeof d.name === "string" ? d.name : ""),
      source: "luma",
      sourceDocId: doc.id,
    });
  }

  console.log(
    `\nRecipients: ${recipients.length}${onlyEmail ? ` (--only-email=${onlyEmail})` : ""}`,
  );
  console.log(`Skipped — judge/declined:           ${skippedJudgeOrDeclined}`);
  console.log(`Skipped — unsubscribed:             ${skippedUnsubscribed}`);
  console.log(`Skipped — no email:                 ${skippedNoEmail}`);
  console.log(`Skipped — already emailed (stamp):  ${skippedAlreadyEmailed}`);
  if (onlyEmail) {
    console.log(`Skipped — --only-email filter:      ${skippedOnlyEmailFilter}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email} (${sample.source})`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- Text ---");
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
        .catch((e) => {
          console.warn(`  [stamp-fail] ${r.email}`, e);
        });
      sent++;
      console.log(`  [ok] ${r.email}`);
      if (sent % 25 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`  [fail] ${r.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
