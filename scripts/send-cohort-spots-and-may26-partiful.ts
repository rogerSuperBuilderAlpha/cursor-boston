#!/usr/bin/env node
/**
 * Push to the broader event list with two asks:
 *   1. Last ~40 cohort-1 spots are still open — apply now.
 *   2. The May 26 Hult / Cursor Boston event is on the Boston Tech Week
 *      Partiful — RSVPing there is required for Tech Week, and sharing
 *      the link boosts our visibility during Tech Week.
 *
 * Recipients: every `eventContacts` doc that isn't unsubscribed.
 *   - We do NOT exclude already-applied folks; the May 26 / Partiful
 *     piece is relevant to them too.
 *   - The cohort-1 CTA is framed as "if you haven't already" so
 *     applicants don't get confused.
 *
 * Usage:
 *   npx tsx scripts/send-cohort-spots-and-may26-partiful.ts --dry-run
 *   npx tsx scripts/send-cohort-spots-and-may26-partiful.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

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

const APPLY_URL = "https://cursorboston.com/summer-cohort";
const PARTIFUL_URL = "https://partiful.com/e/tuwaHOMgiJHvTfOFUJzA?c=EIywhmXE";
const SPOTS_REMAINING = 39; // 100 cohort-1 cap minus 61 current applicants

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

  const subject = `~${SPOTS_REMAINING} cohort 1 spots left + RSVP on Partiful for our Boston Tech Week day (5/26)`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${firstHtml},</p>

<p>Two quick things before Boston Tech Week kicks off.</p>

<h2 style="margin-top:28px;margin-bottom:6px;">1. ~${SPOTS_REMAINING} spots left in Cohort 1 of the Summer Cohort</h2>

<p>Cohort 1 is filling up — out of <strong>100 seats</strong>, only about <strong>${SPOTS_REMAINING} are still open</strong>. If you&apos;ve been thinking about applying, this is the moment.</p>

<p>It&apos;s a six-week ship-every-week program: project management → comms → marketing → AI for education → AI for startups → open source. Each week ends with a Friday voting call where the cohort picks a winner. If you win, you get to keep building — your repo, your roadmap, with the cohort behind you.</p>

<p>Withdrawing later is one click, so applying is low-stakes.</p>

<p><a href="${APPLY_URL}" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Apply for Cohort 1 →</a></p>

<p style="font-size:14px;color:#555;">If you&apos;ve already applied — you&apos;re set, ignore this part. Skip to #2.</p>

<hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;"/>

<h2 style="margin-top:28px;margin-bottom:6px;">2. RSVP on Partiful for the May 26 Hult day — required for Boston Tech Week</h2>
<p style="margin-top:0;color:#555;">Tuesday <strong>May 26</strong> · Hult International, Cambridge · kicks off Boston Tech Week</p>

<p><strong>Boston Tech Week requires every event to be on Partiful</strong> to count toward the official Tech Week listing — so even if you already RSVP&apos;d on Luma or signed up on the website, please <strong>also RSVP on Partiful</strong>. It&apos;s the only way the event shows up in Tech Week&apos;s aggregated calendar.</p>

<p><a href="${PARTIFUL_URL}" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">RSVP on Partiful →</a></p>

<p style="margin-top:24px;"><strong>And — share the Partiful link.</strong> The bigger the RSVP count on Partiful, the more visible Cursor Boston is during Tech Week. Forward this email, post the link on X / LinkedIn / your group chats, drop it in any Boston-tech Slack you&apos;re in:</p>

<p style="margin:8px 0;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:13px;word-break:break-all;"><a href="${PARTIFUL_URL}">${PARTIFUL_URL}</a></p>

<p>Every share helps us look like a real Tech Week presence — which is the whole point.</p>

<hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;"/>

<p>Thanks — see you at Hult on the 26th.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a> · <a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you registered for a Cursor Boston event on Luma.<br/>
Don&apos;t want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Two quick things before Boston Tech Week kicks off.


1. ~${SPOTS_REMAINING} SPOTS LEFT IN COHORT 1 OF THE SUMMER COHORT

Cohort 1 is filling up — out of 100 seats, only about ${SPOTS_REMAINING} are still open. If you've been thinking about applying, this is the moment.

It's a six-week ship-every-week program: project management → comms → marketing → AI for education → AI for startups → open source. Each week ends with a Friday voting call where the cohort picks a winner. If you win, you get to keep building — your repo, your roadmap, with the cohort behind you.

Withdrawing later is one click, so applying is low-stakes.

Apply for Cohort 1:
→ ${APPLY_URL}

(If you've already applied — you're set, ignore this part and skip to #2.)


---


2. RSVP ON PARTIFUL FOR THE MAY 26 HULT DAY — REQUIRED FOR BOSTON TECH WEEK
Tuesday May 26 · Hult International, Cambridge · kicks off Boston Tech Week

Boston Tech Week requires every event to be on Partiful to count toward the official Tech Week listing — so even if you already RSVP'd on Luma or signed up on the website, please also RSVP on Partiful. It's the only way the event shows up in Tech Week's aggregated calendar.

RSVP on Partiful:
→ ${PARTIFUL_URL}

And — share the Partiful link. The bigger the RSVP count on Partiful, the more visible Cursor Boston is during Tech Week. Forward this email, post the link on X / LinkedIn / your group chats, drop it in any Boston-tech Slack you're in:

   ${PARTIFUL_URL}

Every share helps us look like a real Tech Week presence — which is the whole point.


---

Thanks — see you at Hult on the 26th.

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

  // Snapshot of cohort-1 application count for context only — we do NOT
  // exclude applied folks, since the Partiful CTA matters for them too.
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  let cohort1Count = 0;
  for (const doc of appsSnap.docs) {
    const cohorts = doc.data().cohorts;
    if (Array.isArray(cohorts) && cohorts.includes("cohort-1")) cohort1Count++;
  }
  console.log(
    `Cohort 1 applicant count: ${cohort1Count} (cap 100, ~${100 - cohort1Count} spots open)`
  );

  console.log("Loading contacts from eventContacts…");
  const snap = await db.collection("eventContacts").get();
  console.log(`Total contacts: ${snap.size}`);

  const contacts: ContactData[] = [];
  let skippedUnsubscribed = 0;
  let skippedNoEmail = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    if (data.unsubscribed === true) {
      skippedUnsubscribed++;
      continue;
    }
    const email = (data.email || doc.id || "").toString().trim();
    if (!email || !email.includes("@")) {
      skippedNoEmail++;
      continue;
    }

    contacts.push({
      email,
      name: data.name || "",
      firstName: data.firstName || "",
    });
  }

  console.log(
    `Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsubscribed} | Skipped no-email: ${skippedNoEmail}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = contacts[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample email to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(
        `\n---- TEXT preview ----\n${text}\n---- end TEXT ----\n`
      );
      console.log(
        `\n---- HTML preview (first 2400 chars) ----\n${html.slice(0, 2400)}\n…`
      );
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
      if (sent % 25 === 0) {
        console.log(`  Progress: ${sent}/${contacts.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${contact.email}`, e);
    }
    await sleep(450);
  }

  console.log(
    `\nDone. Sent ${sent}, failed ${failed}, skipped ${skippedUnsubscribed + skippedNoEmail}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
