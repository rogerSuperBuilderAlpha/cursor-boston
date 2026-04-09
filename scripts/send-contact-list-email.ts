#!/usr/bin/env node
/**
 * Send a one-time announcement to all eventContacts informing them about
 * the email list, listing which events they registered for, and giving
 * them an unsubscribe link.
 *
 * Usage:
 *   npx tsx scripts/send-contact-list-email.ts --dry-run
 *   npx tsx scripts/send-contact-list-email.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com"
).replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

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
  events: {
    eventName: string;
    checkedIn: boolean;
    approvalStatus: string;
  }[];
}

function buildEmail(contact: ContactData): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"
  );
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const isHackASprintRegistrant = contact.events.some(
    (e) => e.eventName.toLowerCase().includes("hack-a-sprint")
  );

  const subject = isHackASprintRegistrant
    ? "Cursor Boston — Hack-a-Sprint is next week + Boston Tech Week workshop"
    : "Cursor Boston — Two upcoming events you should know about";

  // Hack-a-Sprint CTA (different for registered vs not)
  const hackASprintBlock = isHackASprintRegistrant
    ? `<p>You're registered for the <strong>Hack-a-Sprint on April 13</strong> — it's next week! If you haven't already, make sure to complete your <a href="${SITE_ORIGIN}/hackathons/hack-a-sprint-2026/signup">website signup</a> and submit PRs to the <a href="https://github.com/rogerSuperBuilderAlpha/cursor-boston">community repo</a> to move up the leaderboard. Spots are ranked by merged PRs, then signup order.</p>`
    : `<p><strong>Hack-a-Sprint — April 13, 4:00–8:00 PM ET, Back Bay, Boston</strong><br/>Our inaugural in-person sprint for 50 builders. Solo competition, $50 in Cursor Credits for every selected participant, $1,200 prize pool. There's still time to register and earn your spot — merged PRs to the community repo are the fastest way up the leaderboard.<br/><a href="https://luma.com/uixo8hl6">Register on Luma</a> · <a href="${SITE_ORIGIN}/hackathons/hack-a-sprint-2026/signup">Claim your spot on the leaderboard</a></p>`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>A quick update from Cursor Boston with two events coming up and some news about where this community is heading.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Upcoming Events</h3>

${hackASprintBlock}

<p><strong>Open Source Workshop with AIC at Boston Tech Week — May 30, 12:00–5:00 PM ET, Boston</strong><br/>A hands-on half-day session co-hosted with AIC (AI Community). Two tracks: contribute to the Cursor Boston repo (beginner-friendly) or tackle curated impactful open source projects using Cursor as your AI co-pilot. Walk away with merged PRs, Cursor credits, and practical open source skills. No prior open source experience needed.<br/><a href="https://luma.com/w4gvg7fl">Register on Luma</a></p>

<h3 style="margin-top:24px;margin-bottom:8px;">This Community Belongs to Boston</h3>

<p>Cursor Boston isn't a company — it's a community platform that represents the builders, developers, and creators across Boston who are using AI to ship real work. The website at <a href="${SITE_ORIGIN}">cursorboston.com</a> is open source, and the events, content, and direction are shaped by the people who show up and contribute.</p>

<p>Over the next few months, we'll be adding maintainers to help guide the community, run events, and shape what Cursor Boston becomes. If you're interested in becoming a maintainer — whether you want to help organize events, review PRs, or build features on the site — reach out to <a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a>. We're looking for people who care about the community and want to help it grow.</p>

<p>Questions about anything? Email <a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a>.</p>

<p>See you soon,<br/>— Cursor Boston</p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you registered for a Cursor Boston event on Luma.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const hackASprintText = isHackASprintRegistrant
    ? `You're registered for the Hack-a-Sprint on April 13 — it's next week! Complete your website signup and submit PRs to the community repo to move up the leaderboard: ${SITE_ORIGIN}/hackathons/hack-a-sprint-2026/signup`
    : `Hack-a-Sprint — April 13, 4:00-8:00 PM ET, Back Bay, Boston
  50 builders, solo competition, $50 Cursor Credits per participant, $1,200 prize pool.
  Register: https://luma.com/uixo8hl6
  Claim your leaderboard spot: ${SITE_ORIGIN}/hackathons/hack-a-sprint-2026/signup`;

  const text = `Hi ${contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"},

A quick update from Cursor Boston with two events coming up and some news about where this community is heading.

UPCOMING EVENTS

${hackASprintText}

Open Source Workshop with AIC at Boston Tech Week — May 30, 12:00-5:00 PM ET, Boston
  Hands-on half-day session co-hosted with AIC. Two tracks: beginner-friendly Cursor Boston repo or curated impactful open source projects. No prior open source experience needed.
  Register: https://luma.com/w4gvg7fl

THIS COMMUNITY BELONGS TO BOSTON

Cursor Boston isn't a company — it's a community platform that represents the builders, developers, and creators across Boston who are using AI to ship real work. The website is open source, and the events, content, and direction are shaped by the people who show up and contribute.

Over the next few months, we'll be adding maintainers to help guide the community. If you're interested — whether you want to help organize events, review PRs, or build features — email roger@cursorboston.com.

Questions? Email roger@cursorboston.com.

See you soon,
— Cursor Boston

You're receiving this because you registered for a Cursor Boston event on Luma.
Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

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
  let skippedDeclinedOnly = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    // Skip unsubscribed contacts
    if (data.unsubscribed === true) {
      skippedUnsubscribed++;
      continue;
    }

    const events: ContactData["events"] = (data.events || []).map(
      (e: { eventName?: string; checkedIn?: boolean; approvalStatus?: string }) => ({
        eventName: e.eventName || "",
        checkedIn: e.checkedIn || false,
        approvalStatus: e.approvalStatus || "",
      })
    );

    // Count declined-only for reporting but still include them
    if (events.length > 0 && events.every((e) => e.approvalStatus === "declined")) {
      skippedDeclinedOnly++;
    }

    contacts.push({
      email: data.email || doc.id,
      name: data.name || "",
      firstName: data.firstName || "",
      events,
    });
  }

  console.log(
    `Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsubscribed} | Declined-only (still included): ${skippedDeclinedOnly}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");

    // Show sample
    const sample = contacts[0];
    if (sample) {
      const { subject, html } = buildEmail(sample);
      console.log(`Sample email to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`Events: ${sample.events.map((e) => e.eventName).join(", ")}`);
      console.log(`\nHTML preview:\n---\n${html.slice(0, 600)}…\n---`);
    }

    console.log(`\nWould send to ${contacts.length} contacts.`);
    return;
  }

  // Send emails
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
    `\nDone. Sent ${sent}, failed ${failed}, skipped ${skippedUnsubscribed + skippedDeclinedOnly}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
