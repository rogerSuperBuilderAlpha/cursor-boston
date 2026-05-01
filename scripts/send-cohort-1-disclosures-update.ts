#!/usr/bin/env node
/**
 * Email Cohort 1 applicants asking them to:
 *   1. Add their locality disclosure (local + planning to attend live events?)
 *   2. Add their presenting/maintaining-the-platform comfort disclosure
 *   3. Confirm their RSVP to the May 26 Hult / Cursor Boston immersion event
 *      (Luma — same event id as sports-hack-2026)
 *
 * Personalized per recipient:
 *   - Skips the disclosure ask for applicants who already filled in BOTH new
 *     fields (sends only the May-26-RSVP nudge).
 *   - Inlines a "✓ already on the Luma list" confirmation if they're already
 *     RSVP'd, otherwise inlines the Luma link.
 *
 * Filters:
 *   - cohort-1 only (must include "cohort-1" in `cohorts`)
 *   - status in {pending, admitted} — skips withdrawn/rejected/waitlist
 *
 * Usage:
 *   npx tsx scripts/send-cohort-1-disclosures-update.ts --dry-run
 *   npx tsx scripts/send-cohort-1-disclosures-update.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import {
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORT_IMMERSION,
  isValidCohortId,
} from "../lib/summer-cohort";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Recipient {
  email: string;
  name: string;
  /** Both new disclosure fields are filled in. */
  disclosuresComplete: boolean;
  /** Email is on the May 26 Luma list (hackathonLumaRegistrants doc exists). */
  rsvpedToMay26: boolean;
}

const COHORT_URL = "https://cursorboston.com/summer-cohort";

function buildEmail(r: Recipient): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(r.name?.split(" ")[0]?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = r.disclosuresComplete
    ? `Cohort 1 — confirm your ${SUMMER_COHORT_IMMERSION.label} RSVP`
    : "Cohort 1 — two quick questions + confirm your May 26 RSVP";

  // ---- May 26 status block (HTML)
  const may26HtmlBlock = r.rsvpedToMay26
    ? `<p style="margin:8px 0;padding:10px 14px;background:#ecfdf5;border-left:4px solid #10b981;border-radius:4px;">
  <strong>✓ ${escapeHtml(SUMMER_COHORT_IMMERSION.label)} immersion event:</strong>
  you're on the Luma list. We'll see you there.
</p>`
    : `<p style="margin:8px 0;padding:10px 14px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;">
  <strong>${escapeHtml(SUMMER_COHORT_IMMERSION.label)} — please RSVP on Luma.</strong>
  Cohort 1 gets priority on the 80-person cap, but you still have to grab the Luma seat.<br/>
  <a href="${escapeHtml(SUMMER_COHORT_IMMERSION.lumaUrl)}" style="color:#111;font-weight:600;">Reserve your spot on Luma →</a>
</p>`;

  // ---- May 26 status block (text)
  const may26TextBlock = r.rsvpedToMay26
    ? `  ✓ ${SUMMER_COHORT_IMMERSION.label} immersion event: you're on the Luma list. We'll see you there.`
    : `  ⚠ ${SUMMER_COHORT_IMMERSION.label} — please RSVP on Luma:
    ${SUMMER_COHORT_IMMERSION.lumaUrl}
    Cohort 1 gets priority on the 80-person cap, but you still have to grab the seat.`;

  // ---- Disclosure ask (only when disclosures are missing)
  const disclosuresHtmlBlock = r.disclosuresComplete
    ? ""
    : `<p>Two quick disclosures we just added to the application — please update them on your page so we can plan around your situation:</p>

<ol style="margin:8px 0;padding-left:20px;">
  <li>
    <strong>Are you local to Boston and planning to attend live events?</strong><br/>
    It's totally fine to participate from outside Boston — most of the cohort is on Zoom. We just need to know who's local.<br/>
    <em>Why we're asking:</em> for the first 3 weeks (PM tool / comms platform / marketing platform), in-person attendance at the live demo event is mandatory if you want to be eligible to win that week's vote.
  </li>
  <li style="margin-top:10px;">
    <strong>If you win a week-1/2/3 vote, are you comfortable presenting AND managing the platform for the rest of the cohort?</strong><br/>
    Not everyone has to. We only want people who are comfortable both presenting their work AND maintaining the winning platform through the rest of the cohort. Saying no still gets you full participation; you just won't be eligible to win the vote that week.
  </li>
</ol>`;

  const disclosuresTextBlock = r.disclosuresComplete
    ? ""
    : `TWO QUICK DISCLOSURES (just added to the application — please update them on your page)

  1. Are you local to Boston and planning to attend live events?
     It's totally fine to participate from outside Boston — most of the cohort
     is on Zoom. We just need to know who's local.
     Why: for the first 3 weeks (PM tool / comms platform / marketing
     platform), in-person attendance at the live demo event is mandatory if
     you want to be eligible to win that week's vote.

  2. If you win a week-1/2/3 vote, are you comfortable presenting AND
     managing the platform for the rest of the cohort?
     Not everyone has to. We only want people who are comfortable both
     presenting their work AND maintaining the winning platform through the
     rest of the cohort. Saying no still gets you full participation; you
     just won't be eligible to win the vote that week.

`;

  const ctaLabel = r.disclosuresComplete
    ? "Confirm my May 26 RSVP →"
    : "Update my application →";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>You're on the list for <strong>Cohort 1</strong> of the Cursor Boston Summer Cohort. A couple of housekeeping items before we kick off Mon, May 11:</p>

${disclosuresHtmlBlock}

<p style="margin-top:20px;"><strong>${escapeHtml(SUMMER_COHORT_IMMERSION.label)} mid-cohort immersion event</strong></p>
${may26HtmlBlock}

<p style="margin-top:20px;">
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">${ctaLabel}</a>
</p>
<p style="margin-top:8px;color:#555;font-size:14px;">Or paste this into your browser: <a href="${COHORT_URL}">${COHORT_URL}</a></p>

<p>Reply to this email with any questions.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you applied to Cohort 1 of the Cursor Boston Summer Cohort.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.name?.split(" ")[0]?.trim() || "there"},

You're on the list for Cohort 1 of the Cursor Boston Summer Cohort. A couple of housekeeping items before we kick off Mon, May 11:

${disclosuresTextBlock}${SUMMER_COHORT_IMMERSION.label.toUpperCase()} MID-COHORT IMMERSION EVENT

${may26TextBlock}

${ctaLabel.toUpperCase().replace(" →", "")}: ${COHORT_URL}

Reply to this email with any questions.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you applied to Cohort 1 of the Cursor Boston Summer Cohort.
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
  if (send && (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN)) {
    console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS)."
    );
    process.exit(1);
  }

  // Pull every May 26 RSVP into a Set for O(1) email lookup.
  console.log(
    `Loading May 26 RSVPs from hackathonLumaRegistrants (eventId=${SUMMER_COHORT_IMMERSION.eventId})…`
  );
  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", SUMMER_COHORT_IMMERSION.eventId)
    .get();
  const rsvpedEmails = new Set<string>();
  for (const doc of lumaSnap.docs) {
    const email = (doc.data().email || "").toString().trim().toLowerCase();
    if (email) rsvpedEmails.add(email);
  }
  console.log(`May 26 RSVPs on Luma: ${rsvpedEmails.size}`);

  console.log(`Loading applications from ${SUMMER_COHORT_COLLECTION}…`);
  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .orderBy("createdAt", "asc")
    .get();
  console.log(`Total applications: ${snap.size}`);

  const recipients: Recipient[] = [];
  let skippedNoEmail = 0;
  let skippedNotCohort1 = 0;
  let skippedBadStatus = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const email = (data.email || "").toString().trim();
    if (!email || !email.includes("@")) {
      skippedNoEmail++;
      continue;
    }
    const cohorts = Array.isArray(data.cohorts)
      ? data.cohorts.filter(isValidCohortId)
      : [];
    if (!cohorts.includes("cohort-1")) {
      skippedNotCohort1++;
      continue;
    }
    const status = typeof data.status === "string" ? data.status : "pending";
    if (status !== "pending" && status !== "admitted") {
      skippedBadStatus++;
      continue;
    }

    const disclosuresComplete =
      typeof data.isLocal === "boolean" &&
      typeof data.wantsToPresent === "boolean";

    recipients.push({
      email,
      name: typeof data.name === "string" ? data.name : "",
      disclosuresComplete,
      rsvpedToMay26: rsvpedEmails.has(email.toLowerCase()),
    });
  }

  const needsDisclosures = recipients.filter((r) => !r.disclosuresComplete).length;
  const needsRsvp = recipients.filter((r) => !r.rsvpedToMay26).length;

  console.log(
    `Eligible: ${recipients.length} | needs disclosures: ${needsDisclosures} | needs May 26 RSVP: ${needsRsvp}`
  );
  console.log(
    `Skipped no-email: ${skippedNoEmail} | not cohort-1: ${skippedNotCohort1} | bad status (rejected/waitlist/etc.): ${skippedBadStatus}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    // Two samples — one with disclosures missing + no RSVP, one with the
    // happiest existing state — so we can eyeball both shapes.
    const sampleNeedsBoth = recipients.find(
      (r) => !r.disclosuresComplete && !r.rsvpedToMay26
    );
    const sampleAllSet = recipients.find(
      (r) => r.disclosuresComplete && r.rsvpedToMay26
    );

    if (sampleNeedsBoth) {
      const { subject, html, text } = buildEmail(sampleNeedsBoth);
      console.log("============================================================");
      console.log("SAMPLE 1 — needs disclosures + no May 26 RSVP");
      console.log("============================================================");
      console.log(`To:      ${sampleNeedsBoth.email} (${sampleNeedsBoth.name || "(no name)"})`);
      console.log(`Subject: ${subject}`);
      console.log(`\n---- TEXT BODY ----\n${text}\n`);
      console.log(`---- HTML PREVIEW (first 2000 chars) ----\n${html.slice(0, 2000)}\n…`);
    } else {
      console.log("(no sample matches: needs-disclosures + no-RSVP)");
    }

    if (sampleAllSet) {
      const { subject, html, text } = buildEmail(sampleAllSet);
      console.log("\n============================================================");
      console.log("SAMPLE 2 — disclosures complete + already RSVP'd");
      console.log("============================================================");
      console.log(`To:      ${sampleAllSet.email} (${sampleAllSet.name || "(no name)"})`);
      console.log(`Subject: ${subject}`);
      console.log(`\n---- TEXT BODY ----\n${text}\n`);
      console.log(`---- HTML PREVIEW (first 2000 chars) ----\n${html.slice(0, 2000)}\n…`);
    } else {
      console.log("\n(no sample matches: all-set)");
    }

    console.log(`\nWould send to ${recipients.length} cohort-1 applicants.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const { subject, html, text } = buildEmail(recipient);
    try {
      await sendEmail({ to: recipient.email, subject, html, text });
      sent++;
      if (sent % 10 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${recipient.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
