#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Broadcast to every eventContacts member who is NOT on either of the two
 * upcoming May events:
 *   - May 13 PyData × Cursor Boston (Moderna)
 *   - May 26 Boston Tech Week Sports Hack at Hult
 *
 * Three sections:
 *   1. Cohort 1 starts Mon, May 11 — apply if you haven't.
 *   2. Come play Generals — and contribute if you're into game dev.
 *   3. What should we build next? — solicit event ideas + organizers.
 *
 * Exclusion set (anyone we DON'T want this message to reach):
 *   - eventContacts.eventNames includes any of:
 *       "Cursor Boston-PyData Data Science Hack"
 *       "Cursor Boston - AIC - Hult International - Boston Tech Week Speakers & Workshop"
 *       "Cursor Boston - Boston Tech Week Sports Hack"
 *   - email ∈ hackathonEventSignups (eventId=sports-hack-2026)
 *   - email ∈ pydataHack2026Registrations (status != cancelled)
 *   - eventContacts.unsubscribed === true
 *
 * Usage:
 *   npx tsx scripts/send-not-attending-may-events-prompt.ts --dry-run
 *   npx tsx scripts/send-not-attending-may-events-prompt.ts --send
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { PYDATA_2026_REGISTRATIONS_COLLECTION } from "../lib/pydata-2026";
import { SUMMER_COHORT_IMMERSION } from "../lib/summer-cohort";

const SPORTS_HACK_EVENT_ID = SUMMER_COHORT_IMMERSION.eventId;

const COHORT_URL = "https://www.cursorboston.com/summer-cohort";
const GENERALS_URL = "https://www.cursorboston.com/game";
const GENERALS_LEADERBOARD_URL = "https://www.cursorboston.com/game/leaderboard";
const GENERALS_DOCS_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/docs/generals/README.md";
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const EVENTS_URL = "https://www.cursorboston.com/events";

const EXCLUDED_EVENT_NAMES = new Set<string>([
  "Cursor Boston-PyData Data Science Hack",
  "Cursor Boston - AIC - Hult International - Boston Tech Week Speakers & Workshop",
  "Cursor Boston - Boston Tech Week Sports Hack",
]);

interface Recipient {
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

function buildEmail(r: Recipient): { subject: string; text: string; html: string } {
  const greet = r.firstName ? `Hi ${r.firstName},` : "Hi there,";
  const unsub = buildUnsubscribeUrl(r.email);
  const subject =
    "Cursor Boston — Cohort 1 starts Mon, come play Generals, and what should we build next?";

  const text = `${greet}

You're on the Cursor Boston list, but we don't have you down for either of the two big May events (PyData × Moderna May 13, or the Boston Tech Week hack at Hult on May 26 — both are at capacity / closing). That's fine — there's other stuff happening, and we'd love your input on what comes next.

Three things, all optional, pick whichever apply:

1. SUMMER COHORT 1 — STARTS MONDAY, MAY 11

The first Cursor Boston cohort kicks off this Monday. Six weeks of structured shipping, weekly check-ins, mentor pairing, and an immersion day at Hult on May 26. Designed for people who want a real reason to commit time to leveling up their AI-tooling skills alongside others doing the same.

Apply: ${COHORT_URL}
(Cohort 2 is also open if Cohort 1 timing doesn't work.)

2. PLAY GENERALS — AND HELP BUILD IT IF YOU'RE INTO GAME DEV

Generals is the turn-based strategy game we've been growing inside the Cursor Boston site. Recruit units, claim tiles, raid for artifacts. Designed to be picked up in 2 minutes a day.

Play: ${GENERALS_URL}
Leaderboard: ${GENERALS_LEADERBOARD_URL}

If you're into game development — Three.js, WebGL, graphical interfaces for gaming, or just gameplay design — this is a real open contribution surface. Lore, units, spells, artifacts, castes, buildings, balance, the map renderer, the 3D layer — every piece is documented with exact file paths and what testing we expect.

Contribution guide: ${GENERALS_DOCS_URL}
Repo: ${REPO_URL}

Open a PR, get a review, see your work ship.

3. WHAT SHOULD WE BUILD NEXT? — REPLY WITH IDEAS

We want to hear from you. Two specific questions:

  a. What kind of event would you actually show up for?
     Hack night, talk series, hardware tinkering, robotics, voice agents, biotech × AI,
     game dev night, design jam, weekend retreat, something else? Niche is fine — we
     can host small things easily.

  b. Want to organize one?
     If you've got an idea AND want to help run it (find a venue, recruit a few people,
     pick a date), reply and tell me. We have venue partners around Boston and a
     mailing list that's easy to mobilize. The biggest constraint isn't space or
     audience — it's people willing to organize.

Reply to this email. I read everything.

You can also browse what's already on the calendar: ${EVENTS_URL}

— Roger
Cursor Boston

---
You're getting this because you've been to a Cursor Boston event before but aren't on either of the two May events.
Unsubscribe: ${unsub}
`;

  const html = `<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px;line-height:1.6;">
  <p>${escapeHtml(greet)}</p>

  <p>You&apos;re on the Cursor Boston list, but we don&apos;t have you down for either of the two big May events (PyData × Moderna May 13, or the Boston Tech Week hack at Hult on May 26 — both at capacity / closing). That&apos;s fine — there&apos;s other stuff happening, and we&apos;d love your input on what comes next.</p>

  <p>Three things, all optional, pick whichever apply:</p>

  <h3 style="margin-top:28px;margin-bottom:8px;">1. Summer Cohort 1 — starts Monday, May 11</h3>

  <p>The first Cursor Boston cohort kicks off <strong>this Monday</strong>. Six weeks of structured shipping, weekly check-ins, mentor pairing, and an immersion day at Hult on May 26. Designed for people who want a real reason to commit time to leveling up their AI-tooling skills alongside others doing the same.</p>

  <p><a href="${COHORT_URL}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Apply to Cohort 1 →</a></p>

  <p style="color:#555;font-size:14px;">(Cohort 2 is also open if Cohort 1 timing doesn&apos;t work.)</p>

  <h3 style="margin-top:28px;margin-bottom:8px;">2. Play Generals — and help build it if you&apos;re into game dev</h3>

  <p><strong>Generals</strong> is the turn-based strategy game we&apos;ve been growing inside the Cursor Boston site. Recruit units, claim tiles, raid for artifacts. Designed to be picked up in 2 minutes a day. <a href="${GENERALS_URL}">Play</a> · <a href="${GENERALS_LEADERBOARD_URL}">Leaderboard</a></p>

  <p>If you&apos;re into <strong>game development</strong> — Three.js, WebGL, graphical interfaces for gaming, or just gameplay design — this is a real open contribution surface. Lore, units, spells, artifacts, castes, buildings, balance, the map renderer, the 3D layer — every piece is documented with exact file paths and what testing we expect.</p>

  <p><a href="${GENERALS_DOCS_URL}">Contribution guide</a> · <a href="${REPO_URL}">Repo</a> — open a PR, get a review, see your work ship.</p>

  <h3 style="margin-top:28px;margin-bottom:8px;">3. What should we build next? — reply with ideas</h3>

  <p>We want to hear from you. Two specific questions:</p>

  <ol style="padding-left:20px;color:#222;">
    <li style="margin-bottom:14px;">
      <strong>What kind of event would you actually show up for?</strong><br>
      <span style="color:#555;">Hack night, talk series, hardware tinkering, robotics, voice agents, biotech × AI, game dev night, design jam, weekend retreat, something else? Niche is fine — we can host small things easily.</span>
    </li>
    <li>
      <strong>Want to organize one?</strong><br>
      <span style="color:#555;">If you&apos;ve got an idea <em>and</em> want to help run it (find a venue, recruit a few people, pick a date), reply and tell me. We have venue partners around Boston and a mailing list that&apos;s easy to mobilize. The biggest constraint isn&apos;t space or audience — it&apos;s people willing to organize.</span>
    </li>
  </ol>

  <p style="margin-top:20px;"><strong>Reply to this email.</strong> I read everything.</p>

  <p style="color:#555;">You can also browse what&apos;s already on the calendar: <a href="${EVENTS_URL}">${EVENTS_URL}</a></p>

  <p>— Roger<br>Cursor Boston</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
  <p style="font-size:12px;color:#999;">
    You&apos;re getting this because you&apos;ve been to a Cursor Boston event before but aren&apos;t on either of the two May events.
    <a href="${unsub}" style="color:#999;">Unsubscribe</a>
  </p>
</body>
</html>`;

  return { subject, text, html };
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
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  if (send) await syncMailgunSuppressions(db);

  // --- Build the exclusion set: anyone associated with either May event ---

  // a. Sports-hack-2026 website signups → user emails.
  const signupSnap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", SPORTS_HACK_EVENT_ID)
    .get();
  const sportsUserIds = signupSnap.docs
    .map((d) => d.data().userId as string | undefined)
    .filter((u): u is string => Boolean(u));
  const sportsWebsiteEmails = new Set<string>();
  for (let i = 0; i < sportsUserIds.length; i += 10) {
    const chunk = sportsUserIds.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      const e = s.data()?.email;
      if (typeof e === "string") sportsWebsiteEmails.add(e.trim().toLowerCase());
    }
  }

  // b. PyData site registrations.
  const pydataSnap = await db.collection(PYDATA_2026_REGISTRATIONS_COLLECTION).get();
  const pydataRegisteredEmails = new Set<string>();
  for (const d of pydataSnap.docs) {
    const data = d.data();
    if (data.status === "cancelled") continue;
    const e = (data.email || "").toString().trim().toLowerCase();
    if (e) pydataRegisteredEmails.add(e);
  }

  // c. eventContacts: load once for both unsubscribe and event-name exclusion + recipient names.
  const ecSnap = await db.collection("eventContacts").get();
  console.log(`eventContacts: ${ecSnap.size}`);

  const recipients: Recipient[] = [];
  const seenEmails = new Set<string>();
  let skippedEventOverlap = 0;
  let skippedSportsSite = 0;
  let skippedPydataSite = 0;
  let skippedUnsub = 0;
  let skippedNoEmail = 0;
  let skippedDup = 0;

  for (const doc of ecSnap.docs) {
    const data = doc.data();
    const email = (typeof data.email === "string" ? data.email : doc.id)
      .toString()
      .trim()
      .toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (seenEmails.has(email)) {
      skippedDup++;
      continue;
    }
    seenEmails.add(email);

    if (data.unsubscribed === true) {
      skippedUnsub++;
      continue;
    }

    const eventNames = Array.isArray(data.eventNames) ? data.eventNames : [];
    const overlapsExcludedEvent = eventNames.some(
      (n: unknown) => typeof n === "string" && EXCLUDED_EVENT_NAMES.has(n)
    );
    if (overlapsExcludedEvent) {
      skippedEventOverlap++;
      continue;
    }
    if (sportsWebsiteEmails.has(email)) {
      skippedSportsSite++;
      continue;
    }
    if (pydataRegisteredEmails.has(email)) {
      skippedPydataSite++;
      continue;
    }

    const firstName =
      (typeof data.firstName === "string" && data.firstName.trim()) ||
      ((typeof data.name === "string" ? data.name : "").split(" ")[0] || "").trim();
    recipients.push({ email, firstName });
  }

  console.log(
    `\nExclusions:`
  );
  console.log(
    `  eventName overlap (PyData / May 26):  ${skippedEventOverlap}`
  );
  console.log(
    `  sports-hack-2026 site signup:          ${skippedSportsSite} (additional, not already counted)`
  );
  console.log(
    `  pydata site registration:              ${skippedPydataSite} (additional, not already counted)`
  );
  console.log(
    `  unsubscribed:                          ${skippedUnsub}`
  );
  console.log(
    `  blank email / dup:                     ${skippedNoEmail + skippedDup}`
  );
  console.log(`\nRecipients: ${recipients.length}`);

  if (dryRun) {
    const sample = recipients[0];
    if (sample) {
      const { subject, text } = buildEmail(sample);
      console.log(`\n--- sample to ${sample.email} (${sample.firstName || "(no first name)"}) ---`);
      console.log(`Subject: ${subject}\n`);
      console.log(text);
    } else {
      console.log("\n(no recipients — nothing to preview)");
    }
    console.log(`\nWould send to ${recipients.length} recipients.`);
    return;
  }

  console.log(`\nSending to ${recipients.length} recipients…`);
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, text, html } = buildEmail(r);
    try {
      await sendEmail({ to: r.email, subject, text, html });
      sent++;
      if (sent % 25 === 0 || sent === recipients.length) {
        console.log(`  sent ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`  FAILED ${r.email}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((res) => setTimeout(res, 80));
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
