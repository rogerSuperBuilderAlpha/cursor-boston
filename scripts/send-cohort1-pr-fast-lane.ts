#!/usr/bin/env node
/**
 * One-off push to every PENDING Cohort 1 applicant about the new
 * "merge a PR before May 9 → auto-admitted" fast lane.
 *
 * Recipients: summerCohortApplications where status === "pending" AND
 *   cohorts contains "cohort-1" AND prFastLaneEmailedAt is unset.
 *
 * The idempotency flag (`prFastLaneEmailedAt` on the application doc) lets
 * this script be re-run safely after late applicants come in — already-
 * emailed pending folks are skipped.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-pr-fast-lane.ts --dry-run
 *   npx tsx scripts/send-cohort1-pr-fast-lane.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import {
  SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_LABEL,
  SUMMER_COHORT_COLLECTION,
} from "../lib/summer-cohort";

const PAGE_URL = "https://cursorboston.com/summer-cohort";
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const FIRST_CONTRIB_URL = `${REPO_URL}/blob/develop/docs/FIRST_CONTRIBUTION.md`;
const ISSUES_URL = `${REPO_URL}/issues`;

interface PendingApp {
  uid: string;
  name: string;
  email: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmail(app: PendingApp): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(app.name?.split(" ")[0]?.trim() || "there");
  const firstText = app.name?.split(" ")[0]?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(app.email);

  const subject = `Skip the queue — lock in your Cohort 1 spot by ${SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_LABEL}`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick update for you as a pending Cohort 1 applicant — we just shipped a way to <strong>claim your spot now</strong>, before the May 10 admit round.</p>

<h2 style="margin-top:24px;margin-bottom:6px;">The deal</h2>
<p style="margin-top:0;">
Get <strong>one PR merged into the cursor-boston community repo by ${escapeHtml(SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_LABEL)}</strong>, and you&apos;re <strong>auto-admitted to Cohort 1 immediately</strong>.
No need to wait. Refresh the application page after the merge — your status will read <em>Admitted</em>.
</p>

<p>It&apos;s small + correct that wins, not big + half-done. Fix a typo, tighten a doc, polish a component, ship a small feature off an open issue. The bar is real-PR-that-gets-merged, not "biggest PR".</p>

<h2 style="margin-top:24px;margin-bottom:6px;">How to start</h2>
<ol style="margin:8px 0;padding-left:20px;">
  <li><a href="${ISSUES_URL}">Browse open issues</a> — or pick anything that bugs you on the site or in docs.</li>
  <li>Read the <a href="${FIRST_CONTRIB_URL}">FIRST_CONTRIBUTION.md</a> guide (DCO sign-off, branch, PR conventions).</li>
  <li>Open a PR against <code>develop</code>. Roger reviews and merges fast.</li>
</ol>

<p style="margin-top:16px;">
  <a href="${PAGE_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Open my application →</a>
</p>

<h2 style="margin-top:24px;margin-bottom:6px;">A few caveats</h2>
<ul style="margin:8px 0;padding-left:20px;">
  <li>Cohort 1 is capped at 100 seats. Auto-admit stops if we hit the cap.</li>
  <li>If you don&apos;t make the deadline — <strong>that&apos;s fine</strong>. The regular admit round still runs on May 10. This is just a fast lane.</li>
  <li>Already getting started on a PR? Make sure your GitHub login is connected on your <a href="${PAGE_URL}">profile</a> so the auto-admit can match the merge to you.</li>
</ul>

<p>Reply with any questions.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you applied to Cohort 1 of the Cursor Boston Summer Cohort.<br/>
Don&apos;t want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Quick update for you as a pending Cohort 1 applicant — we just shipped a way to CLAIM YOUR SPOT NOW, before the May 10 admit round.


THE DEAL

Get one PR merged into the cursor-boston community repo by ${SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_LABEL}, and you're AUTO-ADMITTED to Cohort 1 immediately. No need to wait. Refresh the application page after the merge — your status will read "Admitted".

It's small + correct that wins, not big + half-done. Fix a typo, tighten a doc, polish a component, ship a small feature off an open issue. The bar is real-PR-that-gets-merged, not "biggest PR".


HOW TO START

  1. Browse open issues — or pick anything that bugs you on the site or in docs.
     ${ISSUES_URL}
  2. Read the FIRST_CONTRIBUTION.md guide (DCO sign-off, branch, PR conventions).
     ${FIRST_CONTRIB_URL}
  3. Open a PR against \`develop\`. Roger reviews and merges fast.

Open my application:
  ${PAGE_URL}


A FEW CAVEATS

  • Cohort 1 is capped at 100 seats. Auto-admit stops if we hit the cap.
  • If you don't make the deadline — that's fine. The regular admit round still runs on May 10. This is just a fast lane.
  • Already getting started on a PR? Make sure your GitHub login is connected on your profile so the auto-admit can match the merge to you.

Reply with any questions.

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
  if (dryRun === send) {
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

  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .where("status", "==", "pending")
    .get();

  let totalPending = 0;
  let skippedNotCohort1 = 0;
  let alreadyEmailed = 0;
  let skippedNoEmail = 0;
  const queue: PendingApp[] = [];

  for (const doc of snap.docs) {
    totalPending++;
    const data = doc.data();
    const cohorts = Array.isArray(data.cohorts) ? data.cohorts : [];
    if (!cohorts.includes("cohort-1")) {
      skippedNotCohort1++;
      continue;
    }
    if (data.prFastLaneEmailedAt) {
      alreadyEmailed++;
      continue;
    }
    const email = (data.email || "").toString().trim();
    if (!email || !email.includes("@")) {
      skippedNoEmail++;
      continue;
    }
    queue.push({
      uid: (data.userId || doc.id).toString(),
      name: typeof data.name === "string" ? data.name : "",
      email,
    });
  }

  console.log(
    `Pending applications: ${totalPending} | not in cohort-1: ${skippedNotCohort1} | already emailed: ${alreadyEmailed} | no email: ${skippedNoEmail}`
  );
  console.log(`To email now: ${queue.length}`);

  if (dryRun) {
    const sample = queue[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(
        `\n=== Sample email ===\nTo: ${sample.email} (${sample.name || "(no name)"})\nSubject: ${subject}\n`
      );
      console.log(`---- TEXT ----\n${text}\n`);
      console.log(
        `---- HTML preview (first 2000 chars) ----\n${html.slice(0, 2000)}\n…`
      );
    } else {
      console.log("\n(no eligible recipients)");
    }
    console.log("\n--dry-run: no emails sent, no writes.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const app of queue) {
    const { subject, html, text } = buildEmail(app);
    try {
      await sendEmail({ to: app.email, subject, html, text });
      await db.collection(SUMMER_COHORT_COLLECTION).doc(app.uid).set(
        { prFastLaneEmailedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      sent++;
      if (sent % 10 === 0) {
        console.log(`  Progress: ${sent}/${queue.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${app.email}`, e);
    }
    await sleep(450);
  }

  console.log(
    `\nDone. Sent ${sent}, failed ${failed}, already-emailed ${alreadyEmailed}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
