#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Cohort 1 finalize reminder — pre-kickoff Saturday email to admits who
 * STILL have at least one of:
 *   - Discord not connected (cannot see the cohort channel)
 *   - GitHub not connected
 *   - Intake survey not submitted
 *
 * Single primary CTA: connect Discord. Lists the other open items
 * inline so they're not surprised on Monday. Tightly scoped — we
 * already sent the status email today; this is a "kickoff is in 2
 * days, please finish setup" follow-up to the people who still owe
 * something.
 *
 * Idempotent via `cohort1FinalizeReminderEmailedAt` on the application
 * doc.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-finalize-reminder.ts --dry-run
 *   npx tsx scripts/send-cohort1-finalize-reminder.ts --send
 *   npx tsx scripts/send-cohort1-finalize-reminder.ts --send --force
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
import { SUMMER_COHORT_INTAKE_COLLECTION } from "../lib/summer-cohort-intake";

const COHORT_URL = "https://www.cursorboston.com/summer-cohort";
const ALC_URL = "https://ludwitt.com/alc";
const STAMP_FIELD = "cohort1FinalizeReminderEmailedAt";

interface Recipient {
  applicationId: string;
  userId: string;
  email: string;
  name: string;
  firstName: string;
  needsDiscord: boolean;
  needsGithub: boolean;
  needsSurvey: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row({
  done,
  label,
  todoCopy,
  doneCopy,
}: {
  done: boolean;
  label: string;
  todoCopy: string;
  doneCopy: string;
}): string {
  if (done) {
    return `<li><strong>✅ ${escapeHtml(label)}</strong> — ${escapeHtml(doneCopy)}</li>`;
  }
  return `<li><strong>⚠️ ${escapeHtml(label)}</strong> — ${escapeHtml(todoCopy)}</li>`;
}

function buildEmail(r: Recipient): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = "Cohort 1 starts Monday — finish your setup (2 minutes)";

  const items = [
    row({
      done: !r.needsDiscord,
      label: "Connect Discord",
      todoCopy:
        "Without Discord you can't see the cohort channel. One click on the cohort page handles it.",
      doneCopy: "Connected — you've been added to the cohort-1 channel.",
    }),
    row({
      done: !r.needsGithub,
      label: "Connect GitHub",
      todoCopy:
        "We use GitHub to count your weekly PRs against the cohort milestones.",
      doneCopy: "Connected — your PRs will count.",
    }),
    row({
      done: !r.needsSurvey,
      label: "Intake survey (~5 min)",
      todoCopy:
        "Tells us what tracks fit you. Surveys after Monday lose their priority.",
      doneCopy: "Submitted. Thanks!",
    }),
  ].join("");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Cohort 1 kicks off <strong>Monday, May 11</strong> — two days from now. You're admitted, but our records show you still have at least one open item from your setup. None of these take more than a couple minutes; please knock them out today or tomorrow so Monday isn't spent on logistics.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Your status</h3>
<ul>${items}</ul>

<h3 style="margin-top:24px;margin-bottom:8px;">One-click finalize</h3>
<p>Visit the cohort page — it has direct buttons for everything you need:</p>
<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the cohort page →
  </a>
</p>

<p style="font-size:14px;color:#6b7280;">If you're new to the local-machine setup (Node, Git, Cursor), there's also a 20-minute walkthrough at <a href="${ALC_URL}">ludwitt.com/alc</a> — worth it before Monday.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">If you're not joining anymore</h3>
<p>That's fine — just reply with "withdrawing" and we'll free up the spot for the waitlist. No hard feelings.</p>

<p>See you Monday.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you applied to Cohort 1 of the Cursor Boston summer cohort.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "there"},

Cohort 1 kicks off Monday, May 11 — two days from now. You're admitted, but our records show you still have at least one open item from your setup. None of these take more than a couple minutes; please knock them out today or tomorrow so Monday isn't spent on logistics.

YOUR STATUS

  ${r.needsDiscord ? "[ ]" : "[✓]"} Connect Discord — ${r.needsDiscord ? "Without Discord you can't see the cohort channel." : "Connected; you've been added to the cohort-1 channel."}
  ${r.needsGithub ? "[ ]" : "[✓]"} Connect GitHub — ${r.needsGithub ? "We use GitHub to count your weekly PRs." : "Connected; your PRs will count."}
  ${r.needsSurvey ? "[ ]" : "[✓]"} Intake survey (~5 min) — ${r.needsSurvey ? "Tells us what tracks fit you." : "Submitted. Thanks!"}

ONE-CLICK FINALIZE
  ${COHORT_URL}

If you're new to the local-machine setup (Node, Git, Cursor), there's also a walkthrough at ${ALC_URL}.

IF YOU'RE NOT JOINING ANYMORE
Just reply with "withdrawing" and we'll free up the spot.

See you Monday.

— Roger
roger@cursorboston.com

---
You're receiving this because you applied to Cohort 1 of the Cursor Boston summer cohort.
Don't want to hear from us? ${unsubUrl}
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

  console.log("Loading cohort-1 admits…");
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();

  // Pre-load intake-survey rows by email so we can flag survey status
  // without N round-trips. The collection is small (≲ 200 rows).
  const intakeSnap = await db.collection(SUMMER_COHORT_INTAKE_COLLECTION).get();
  const intakeEmailSet = new Set<string>();
  for (const doc of intakeSnap.docs) {
    const d = doc.data() as { email?: string };
    if (d.email) intakeEmailSet.add(d.email.toLowerCase().trim());
  }

  const recipients: Recipient[] = [];
  let skippedAlreadyEmailed = 0;
  let skippedNotAdmitted = 0;
  let skippedFinished = 0;
  let skippedNoUserId = 0;

  for (const appDoc of appsSnap.docs) {
    const d = appDoc.data() as {
      cohorts?: string[];
      status?: string;
      userId?: string;
      email?: string;
      name?: string;
      [STAMP_FIELD]?: unknown;
    };
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts : [];
    if (!cohorts.includes("cohort-1")) continue;
    if (d.status !== "admitted") {
      skippedNotAdmitted++;
      continue;
    }
    if (!force && d[STAMP_FIELD]) {
      skippedAlreadyEmailed++;
      continue;
    }
    if (!d.userId) {
      skippedNoUserId++;
      continue;
    }
    const userSnap = await db.collection("users").doc(d.userId).get();
    const u = userSnap.exists
      ? (userSnap.data() as {
          discord?: { id?: string; username?: string };
          github?: { login?: string };
        })
      : null;
    const needsDiscord = !u?.discord?.id;
    const needsGithub = !u?.github?.login;
    const needsSurvey = !intakeEmailSet.has(
      (d.email ?? "").toLowerCase().trim()
    );

    if (!needsDiscord && !needsGithub && !needsSurvey) {
      skippedFinished++;
      continue;
    }

    const name = d.name?.trim() || "";
    const firstName = name.split(" ")[0] || "";
    recipients.push({
      applicationId: appDoc.id,
      userId: d.userId,
      email: (d.email ?? "").trim(),
      name,
      firstName,
      needsDiscord,
      needsGithub,
      needsSurvey,
    });
  }

  console.log(`Eligible (have at least one open item): ${recipients.length}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — fully finished: ${skippedFinished}`);
  console.log(`Skipped — no userId on application: ${skippedNoUserId}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}): ${skippedAlreadyEmailed}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(
        `Status: discord=${!sample.needsDiscord}, github=${!sample.needsGithub}, survey=${!sample.needsSurvey}`
      );
      console.log("\n--- HTML preview (first 1500 chars) ---");
      console.log(html.slice(0, 1500));
      console.log("\n--- Text preview (first 1500 chars) ---");
      console.log(text.slice(0, 1500));
    }
    console.log(`\nWould send to ${recipients.length} contacts.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r);
    try {
      await sendEmail({ to: r.email, subject, html, text });
      // Stamp idempotency flag.
      await db
        .collection(SUMMER_COHORT_COLLECTION)
        .doc(r.applicationId)
        .update({ [STAMP_FIELD]: FieldValue.serverTimestamp() });
      sent++;
      if (sent % 25 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
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
