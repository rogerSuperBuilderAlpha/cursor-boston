#!/usr/bin/env node
/**
 * Sports Hack 2026 — over-the-cap announcement.
 *
 * The May 26 list is now 96+ signups against an 80-person cap. Two ways to
 * lock in a seat:
 *   1. Apply to Summer Cohort 1 — cohort applicants are prioritized in the
 *      May 26 immersion ranking (the in-person event for the cohort).
 *   2. Merge PRs to the community repo — the leaderboard re-ranks live and
 *      every merged PR moves you up.
 *
 * Recipient set: union of
 *   - hackathonEventSignups where eventId=sports-hack-2026
 *   - hackathonLumaRegistrants where eventId=sports-hack-2026
 * Deduped by lowercased email. Judge/declined/unsubscribed filtered.
 *
 * Usage:
 *   npx tsx scripts/send-sports-hack-2026-over-cap.ts --dry-run
 *   npx tsx scripts/send-sports-hack-2026-over-cap.ts --send
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import {
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_CAPACITY,
} from "../lib/sports-hack-2026";
import {
  getDeclinedEmailsForEvent,
  getJudgeEmailsForEvent,
} from "../lib/hackathon-event-signup";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const SIGNUP_URL =
  "https://www.cursorboston.com/hackathons/sports-hack-2026/signup";
const COHORT_APPLY_URL = "https://www.cursorboston.com/summer-cohort";
const COMMUNITY_REPO_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const PARTIFUL_URL = "https://partiful.com/e/tuwaHOMgiJHvTfOFUJzA?c=EIywhmXE";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstNameOf(name: string | undefined, email: string): string {
  if (name && name.trim()) return name.trim().split(/\s+/)[0]!;
  const local = email.split("@")[0] || "there";
  return local.split(/[._-]/)[0] || "there";
}

type Recipient = {
  email: string;
  firstName: string;
  source: "website" | "luma" | "both";
};

function buildEmail(
  to: Recipient,
  totalCount: number
): { subject: string; html: string; text: string } {
  const first = escapeHtml(to.firstName);
  const firstText = to.firstName;
  const unsubUrl = buildUnsubscribeUrl(to.email);
  const over = totalCount - SPORTS_HACK_2026_CAPACITY;

  const subject = `${totalCount} on the May 26 list, ${SPORTS_HACK_2026_CAPACITY} seats — lock in your spot + RSVP on Partiful`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick update on Sports Hack (May 26 at Hult):</p>

<p><strong>${totalCount} people are now on the list. The room only fits ${SPORTS_HACK_2026_CAPACITY}.</strong> That&apos;s ${over} people over capacity, and more are still signing up.</p>

<p>Two things to do — one to lock in your seat, one to make sure you&apos;re actually counted for Boston Tech Week:</p>

<p><strong>1. Lock in your seat — pick one (or both):</strong></p>

<p style="margin-left:20px;"><strong>a. Apply to Summer Cohort 1, then merge a PR.</strong><br/>
The May 26 event is the in-person kickoff for our 6-week summer cohort. Cohort 1 applicants get prioritized on the May 26 list — you&apos;ll see them at the top of the leaderboard with a violet "Cohort 1" pill. <strong>Apply, then merge any PR to the cursorboston.com repo and you&apos;re auto-admitted to Cohort 1 — that locks in your May 26 seat.</strong><br/>
→ Apply: <a href="${COHORT_APPLY_URL}">${COHORT_APPLY_URL}</a><br/>
→ Repo: <a href="${COMMUNITY_REPO_URL}">${COMMUNITY_REPO_URL}</a></p>

<p style="margin-left:20px;"><strong>b. Or just merge PRs to the community repo.</strong><br/>
Even without applying to the cohort, the leaderboard ranks by merged PRs and re-sorts in real time. One or two merged PRs jumps you past most people who signed up and stopped there:<br/>
→ <a href="${COMMUNITY_REPO_URL}">${COMMUNITY_REPO_URL}</a></p>

<p>Check your current spot any time:<br/>
→ <a href="${SIGNUP_URL}">${SIGNUP_URL}</a></p>

<p><strong>2. RSVP on Partiful — required for Boston Tech Week.</strong><br/>
Partiful is the official source of truth for Boston Tech Week. Even if you&apos;re already on Luma or signed up on the website, you also need to RSVP on Partiful — it&apos;s the only way the event counts toward the official Tech Week listing:<br/>
→ <a href="${PARTIFUL_URL}">RSVP on Partiful</a></p>

<p>Selection freezes about a week before the event. Move now.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a> · <a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you signed up for Sports Hack 2026.<br/>
Don&apos;t want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Quick update on Sports Hack (May 26 at Hult):

${totalCount} people are now on the list. The room only fits ${SPORTS_HACK_2026_CAPACITY}. That's ${over} people over capacity, and more are still signing up.

Two things to do — one to lock in your seat, one to make sure you're actually counted for Boston Tech Week:

1. LOCK IN YOUR SEAT — pick one (or both):

   a. Apply to Summer Cohort 1, then merge a PR.
      The May 26 event is the in-person kickoff for our 6-week summer cohort.
      Cohort 1 applicants get prioritized on the May 26 list — you'll see them
      at the top of the leaderboard with a violet "Cohort 1" pill.
      Apply, then merge any PR to the cursorboston.com repo and you're
      auto-admitted to Cohort 1 — that locks in your May 26 seat.
      → Apply: ${COHORT_APPLY_URL}
      → Repo:  ${COMMUNITY_REPO_URL}

   b. Or just merge PRs to the community repo.
      Even without applying to the cohort, the leaderboard ranks by merged
      PRs and re-sorts in real time. One or two merged PRs jumps you past
      most people who signed up and stopped there:
      → ${COMMUNITY_REPO_URL}

   Check your current spot any time:
   → ${SIGNUP_URL}

2. RSVP ON PARTIFUL — required for Boston Tech Week.
   Partiful is the official source of truth for Boston Tech Week. Even if
   you're already on Luma or signed up on the website, you also need to
   RSVP on Partiful — it's the only way the event counts toward the
   official Tech Week listing:
   → ${PARTIFUL_URL}

Selection freezes about a week before the event. Move now.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

---
You're receiving this because you signed up for Sports Hack 2026.
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
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  // Mirror Mailgun bounces + complaints before reading the list, so
  // anything Mailgun has flagged since the last send gets skipped here.
  // The Luma collection doesn't carry its own `unsubscribed` flag, so we
  // also keep the address Set to filter that path explicitly.
  const suppressionResult = await syncMailgunSuppressions(db);
  const mailgunSuppressed = suppressionResult.allSuppressed;

  const judgeEmails = getJudgeEmailsForEvent(SPORTS_HACK_2026_EVENT_ID);
  const declinedEmails = getDeclinedEmailsForEvent(SPORTS_HACK_2026_EVENT_ID);

  const byEmail = new Map<string, Recipient>();

  // 1. Website signups
  const signupSnap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", SPORTS_HACK_2026_EVENT_ID)
    .get();

  let skippedUnsubWebsite = 0;
  let skippedJudgeWebsite = 0;
  let missingEmailWebsite = 0;

  for (const doc of signupSnap.docs) {
    const uid = doc.data().userId as string | undefined;
    if (!uid) continue;
    const userDoc = await db.collection("users").doc(uid).get();
    const x = userDoc.data() as Record<string, unknown> | undefined;
    const email = (typeof x?.email === "string" ? x.email : "").toLowerCase();
    if (!email) {
      missingEmailWebsite++;
      continue;
    }
    if (x?.unsubscribed === true) {
      skippedUnsubWebsite++;
      continue;
    }
    if (judgeEmails.has(email) || declinedEmails.has(email)) {
      skippedJudgeWebsite++;
      continue;
    }
    const displayName = typeof x?.displayName === "string" ? x.displayName : "";
    byEmail.set(email, {
      email,
      firstName: firstNameOf(displayName, email),
      source: "website",
    });
  }

  // 2. Luma registrants
  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", SPORTS_HACK_2026_EVENT_ID)
    .get();

  let skippedJudgeLuma = 0;
  let skippedSuppressedLuma = 0;

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (typeof d.email === "string" ? d.email : "").toLowerCase();
    if (!email) continue;
    if (judgeEmails.has(email) || declinedEmails.has(email)) {
      skippedJudgeLuma++;
      continue;
    }
    if (mailgunSuppressed.has(email)) {
      skippedSuppressedLuma++;
      continue;
    }
    const existing = byEmail.get(email);
    if (existing) {
      existing.source = "both";
      continue;
    }
    const name = typeof d.name === "string" ? d.name : "";
    byEmail.set(email, {
      email,
      firstName: firstNameOf(name, email),
      source: "luma",
    });
  }

  const recipients = Array.from(byEmail.values()).sort((a, b) =>
    a.email.localeCompare(b.email)
  );
  const totalCount = recipients.length;

  console.log(
    `Recipients: ${totalCount} total ` +
      `(website-only: ${recipients.filter((r) => r.source === "website").length}, ` +
      `luma-only: ${recipients.filter((r) => r.source === "luma").length}, ` +
      `both: ${recipients.filter((r) => r.source === "both").length})`
  );
  console.log(
    `Website skipped — unsubscribed: ${skippedUnsubWebsite}, judge/declined: ${skippedJudgeWebsite}, missing email: ${missingEmailWebsite}`
  );
  console.log(
    `Luma skipped — judge/declined: ${skippedJudgeLuma}, mailgun-suppressed: ${skippedSuppressedLuma}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, text } = buildEmail(sample, totalCount);
      console.log(`--- sample email to ${sample.email} ---`);
      console.log(`Subject: ${subject}\n`);
      console.log(text);
    }
    console.log(`\nWould send to ${totalCount} recipients.`);
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r, totalCount);
    try {
      await sendEmail({ to: r.email, subject, html, text });
      sent++;
      if (sent % 20 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (error) {
      failed++;
      console.error(`Failed: ${r.email}`, error);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
