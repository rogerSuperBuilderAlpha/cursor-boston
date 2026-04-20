#!/usr/bin/env node
/**
 * One-off announcement to the general email list (Firestore `eventContacts`)
 * for Cursor Boston × Boston Tech Week: Sports Hack on 2026-05-26.
 *
 * Usage:
 *   npx tsx scripts/send-sports-hack-2026-announce.ts --dry-run
 *   npx tsx scripts/send-sports-hack-2026-announce.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const LUMA_URL = "https://luma.com/t5vseeed";
const WEBSITE_SIGNUP_URL =
  "https://www.cursorboston.com/hackathons/sports-hack-2026/signup";
const EVENT_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-sports-hack-2026";
const COMMUNITY_REPO_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

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
  const firstHtml = escapeHtml(
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"
  );
  const firstText =
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const subject = "Sports Hack — May 26 in Cambridge. Two steps to reserve your spot.";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${firstHtml},</p>

<p>A new one for the calendar — <strong>Cursor Boston × Boston Tech Week: Sports Hack</strong>, Tuesday <strong>May 26, 10:00 AM – 4:00 PM ET, in Cambridge</strong>.</p>

<p>It's a morning hackathon blending tech and the sports industry — networking, a guest lecture from the <strong>London School of Economics</strong>, a <strong>2-hour build sprint</strong> with talks from partners (Hult International, BeatM, Red Bull, NFX, MIT Sports Lab), AI-powered project scoring, and live pitches.</p>

<p><strong>What's in it for you:</strong> Cursor credits and prizes for selected participants.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Two steps to reserve your spot</h3>
<p style="margin-top:0;"><em>You need both, or you won't be on the list.</em></p>

<p><strong>1. RSVP on Luma</strong> (handles door entry &amp; approvals)<br/>
→ <a href="${LUMA_URL}">${LUMA_URL}</a></p>

<p><strong>2. Register on the website</strong> (locks you into the ranking for one of 80 confirmed seats)<br/>
→ <a href="${WEBSITE_SIGNUP_URL}">${WEBSITE_SIGNUP_URL}</a></p>

<p>Then <strong>merge PRs</strong> to the community repo to climb the leaderboard — selection priority goes to contributors, so every PR before the freeze moves you up.<br/>
→ <a href="${COMMUNITY_REPO_URL}">${COMMUNITY_REPO_URL}</a></p>

<p>Not sure if you're already registered on one but not the other? The signup page shows both statuses per-user — you'll see a ✓ On Luma pill if the cross-reference matched.</p>

<p>Full event detail: <a href="${EVENT_DETAIL_URL}">${EVENT_DETAIL_URL}</a></p>

<p>See you May 26.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a> · <a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you registered for a Cursor Boston event on Luma.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

A new one for the calendar — Cursor Boston × Boston Tech Week: Sports Hack, Tuesday May 26, 10:00 AM – 4:00 PM ET, in Cambridge.

It's a morning hackathon blending tech and the sports industry — networking, a guest lecture from the London School of Economics, a 2-hour build sprint with talks from partners (Hult International, BeatM, Red Bull, NFX, MIT Sports Lab), AI-powered project scoring, and live pitches.

What's in it for you: Cursor credits and prizes for selected participants.

TWO STEPS TO RESERVE YOUR SPOT
You need both, or you won't be on the list.

1. RSVP on Luma (handles door entry & approvals)
   → ${LUMA_URL}

2. Register on the website (locks you into the ranking for one of 80 confirmed seats)
   → ${WEBSITE_SIGNUP_URL}

Then merge PRs to the community repo to climb the leaderboard — selection priority goes to contributors, so every PR before the freeze moves you up.
   → ${COMMUNITY_REPO_URL}

Not sure if you're already registered on one but not the other? The signup page shows both statuses per-user — you'll see a ✓ On Luma pill if the cross-reference matched.

Full event detail: ${EVENT_DETAIL_URL}

See you May 26.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

---
You're receiving this because you registered for a Cursor Boston event on Luma.
Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const send = args.includes("--send");

  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }

  if (send) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
  }

  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS)."
    );
    process.exit(1);
  }

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
      const { subject, html } = buildEmail(sample);
      console.log(`Sample email to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`\nHTML preview:\n---\n${html.slice(0, 900)}\n…(truncated)\n---`);
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
