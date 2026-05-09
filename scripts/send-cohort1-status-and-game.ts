#!/usr/bin/env node
/**
 * Cohort 1 — pre-kickoff personalized checklist + /game promo.
 *
 * For each admitted cohort-1 applicant, send an email that lays out
 * (per-recipient) what they still owe before Mon May 11:
 *   - Discord connected?       (users/{uid}.discord.id)
 *   - GitHub connected?        (users/{uid}.github.login)
 *   - Intake survey submitted? (summerCohortIntakeSurveys collection by email)
 *   - Local setup walkthrough  (always shown — there's no completion field)
 * And promote /game with a "PR your ideas" CTA.
 *
 * Idempotent via `cohort1StatusCheckEmailedAt` on the application doc —
 * re-runs skip anyone already stamped. Use --force to re-send.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-status-and-game.ts --dry-run
 *   npx tsx scripts/send-cohort1-status-and-game.ts --send
 *   npx tsx scripts/send-cohort1-status-and-game.ts --send --force
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
import { SUMMER_COHORT_COLLECTION, isValidCohortId } from "../lib/summer-cohort";
import { SUMMER_COHORT_INTAKE_COLLECTION } from "../lib/summer-cohort-intake";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const GAME_URL = "https://cursorboston.com/game";
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const ALC_URL = "https://ludwitt.com/alc";

interface Recipient {
  applicationId: string;
  email: string;
  name: string;
  discordUsername: string | null;
  githubLogin: string | null;
  surveyDone: boolean;
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
  doneCopy,
  todoCopy,
  ctaUrl,
  ctaLabel,
}: {
  done: boolean;
  label: string;
  doneCopy: string;
  todoCopy: string;
  ctaUrl: string;
  ctaLabel: string;
}): string {
  if (done) {
    return `<li style="margin:6px 0;padding:10px 14px;border-left:4px solid #10b981;background:#ecfdf5;border-radius:6px;">
  <strong>✅ ${escapeHtml(label)}</strong> — ${escapeHtml(doneCopy)}
</li>`;
  }
  return `<li style="margin:6px 0;padding:10px 14px;border-left:4px solid #f59e0b;background:#fffbeb;border-radius:6px;">
  <strong>⚠️ ${escapeHtml(label)}</strong> — ${escapeHtml(todoCopy)}
  &nbsp;<a href="${ctaUrl}" style="color:#92400e;font-weight:600;">${escapeHtml(ctaLabel)} →</a>
</li>`;
}

function rowText({
  done,
  label,
  doneCopy,
  todoCopy,
  ctaUrl,
  ctaLabel,
}: {
  done: boolean;
  label: string;
  doneCopy: string;
  todoCopy: string;
  ctaUrl: string;
  ctaLabel: string;
}): string {
  if (done) return `  [✓] ${label} — ${doneCopy}`;
  return `  [ ] ${label} — ${todoCopy}\n      ${ctaLabel}: ${ctaUrl}`;
}

function buildEmail(r: Recipient): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(r.name?.split(" ")[0]?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const discordDone = r.discordUsername !== null;
  const githubDone = r.githubLogin !== null;
  const allReady = discordDone && githubDone && r.surveyDone;

  const subject = "Cohort 1 — Monday checklist + try /game";

  const checklistHtml = [
    row({
      done: discordDone,
      label: "Discord",
      doneCopy: `connected as @${r.discordUsername ?? ""}`,
      todoCopy: "not connected — we can't add you to the cohort channel without this",
      ctaUrl: COHORT_URL,
      ctaLabel: "Connect Discord",
    }),
    row({
      done: githubDone,
      label: "GitHub",
      doneCopy: `connected as @${r.githubLogin ?? ""}`,
      todoCopy: "not connected — your PRs need this to count",
      ctaUrl: COHORT_URL,
      ctaLabel: "Connect GitHub",
    }),
    row({
      done: r.surveyDone,
      label: "Intake survey",
      doneCopy: "submitted — thank you",
      todoCopy: "~5 min, helps us tailor the program to who's in the room",
      ctaUrl: COHORT_URL,
      ctaLabel: "Take the survey",
    }),
  ].join("");

  const checklistText = [
    rowText({
      done: discordDone,
      label: "Discord",
      doneCopy: `connected as @${r.discordUsername ?? ""}`,
      todoCopy: "not connected — we can't add you to the cohort channel without this",
      ctaUrl: COHORT_URL,
      ctaLabel: "Connect Discord",
    }),
    rowText({
      done: githubDone,
      label: "GitHub",
      doneCopy: `connected as @${r.githubLogin ?? ""}`,
      todoCopy: "not connected — your PRs need this to count",
      ctaUrl: COHORT_URL,
      ctaLabel: "Connect GitHub",
    }),
    rowText({
      done: r.surveyDone,
      label: "Intake survey",
      doneCopy: "submitted — thank you",
      todoCopy: "~5 min, helps us tailor the program to who's in the room",
      ctaUrl: COHORT_URL,
      ctaLabel: "Take the survey",
    }),
  ].join("\n");

  const lead = allReady
    ? `<p>Hi ${first},</p>
<p><strong>You're all set for Monday.</strong> Cohort 1 kicks off <strong>Mon, May 11</strong> — see below for one last laptop check, plus something fun to play with this weekend.</p>`
    : `<p>Hi ${first},</p>
<p>Cohort 1 kicks off <strong>Mon, May 11</strong>. Quick personalized check on what you still owe so you can show up Monday focused on the work, not the setup:</p>`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
${lead}

<ul style="list-style:none;padding:0;margin:16px 0;">${checklistHtml}</ul>

<p style="margin:18px 0 6px 0;"><strong>💻 On your laptop, before Monday:</strong></p>
<p style="margin:0 0 10px 0;">Install <strong>Node</strong> (LTS), <strong>Git</strong>, and <strong>Cursor</strong> (or Claude Code if you already have a flow). Full walkthrough — every step, every gotcha — is here:</p>
<p style="margin:0 0 18px 0;">
  <a href="${ALC_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Open the setup walkthrough →</a>
</p>

<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;"/>

<p style="margin:0 0 8px 0;"><strong>🎮 While you wait — try /game</strong></p>
<p style="margin:0 0 12px 0;">We built a small persistent web game right inside this same repo: recruit, run threats, cast spells, climb the leaderboard. Play it for 10 minutes — and if you have ideas for new spells, threat types, balance tweaks, or UI improvements, <strong>open a PR</strong>. The PR fast-lane that admitted most of you is still active, and contributions to <code>/game</code> are exactly the kind of work we want to see this summer.</p>
<p style="margin:0 0 6px 0;">
  <a href="${GAME_URL}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:6px;">Open /game →</a>
  <a href="${REPO_URL}" style="display:inline-block;background:#fff;color:#7c3aed;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #7c3aed;">Open the repo →</a>
</p>
<p style="margin:8px 0 0 0;font-size:13px;color:#555;">Game logic lives under <code>lib/game/</code>; UI under <code>app/game/</code>. Pick something small for your first PR — a new spell ships in an afternoon.</p>

<p style="margin-top:24px;">Reply with anything — questions, install snags, ideas you want to sanity-check before building.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you're an admitted Cohort 1 participant.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const leadText = allReady
    ? `Hi ${r.name?.split(" ")[0]?.trim() || "there"},

YOU'RE ALL SET FOR MONDAY. Cohort 1 kicks off Mon, May 11 — see below for one last laptop check, plus something fun to play with this weekend.`
    : `Hi ${r.name?.split(" ")[0]?.trim() || "there"},

Cohort 1 kicks off Mon, May 11. Quick personalized check on what you still owe so you can show up Monday focused on the work, not the setup:`;

  const text = `${leadText}

YOUR CHECKLIST
${checklistText}

ON YOUR LAPTOP, BEFORE MONDAY
Install Node (LTS), Git, and Cursor (or Claude Code if you already have a flow). Full walkthrough — every step, every gotcha:
  ${ALC_URL}

----

WHILE YOU WAIT — TRY /game
We built a small persistent web game right inside this same repo: recruit, run threats, cast spells, climb the leaderboard. Play it for 10 minutes — and if you have ideas for new spells, threat types, balance tweaks, or UI improvements, OPEN A PR. The PR fast-lane that admitted most of you is still active, and contributions to /game are exactly the kind of work we want to see this summer.

  Play: ${GAME_URL}
  Repo: ${REPO_URL}

Game logic lives under lib/game/; UI under app/game/. Pick something small for your first PR — a new spell ships in an afternoon.

Reply with anything — questions, install snags, ideas you want to sanity-check before building.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you're an admitted Cohort 1 participant.
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
  const force = args.includes("--force");

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

  console.log(`Loading existing intake submissions from ${SUMMER_COHORT_INTAKE_COLLECTION}…`);
  const intakeSnap = await db.collection(SUMMER_COHORT_INTAKE_COLLECTION).get();
  const intakeEmails = new Set<string>();
  for (const doc of intakeSnap.docs) {
    const email = (doc.data().email || "").toString().trim().toLowerCase();
    if (email) intakeEmails.add(email);
  }
  console.log(`Existing intake submissions: ${intakeEmails.size}`);

  console.log(`Loading cohort-1 admits from ${SUMMER_COHORT_COLLECTION}…`);
  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .where("cohorts", "array-contains", "cohort-1")
    .where("status", "==", "admitted")
    .get();

  const recipients: Recipient[] = [];
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;
  let withDiscord = 0;
  let withGithub = 0;
  let withSurvey = 0;

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
    if (!cohorts.includes("cohort-1")) continue;
    if (!force && data.cohort1StatusCheckEmailedAt) {
      skippedAlreadyEmailed++;
      continue;
    }

    const uid = (data.userId || doc.id).toString();
    let discordUsername: string | null = null;
    let githubLogin: string | null = null;
    if (uid) {
      const userSnap = await db.collection("users").doc(uid).get();
      const ud = userSnap.data();
      const d = ud?.discord;
      const g = ud?.github;
      if (d?.id && typeof d.username === "string") discordUsername = d.username;
      if (g?.login && typeof g.login === "string") githubLogin = g.login;
    }
    const surveyDone = intakeEmails.has(email.toLowerCase());

    if (discordUsername) withDiscord++;
    if (githubLogin) withGithub++;
    if (surveyDone) withSurvey++;

    recipients.push({
      applicationId: doc.id,
      email,
      name: typeof data.name === "string" ? data.name : "",
      discordUsername,
      githubLogin,
      surveyDone,
    });
  }

  console.log(
    `Eligible to email: ${recipients.length} | already emailed: ${skippedAlreadyEmailed} | no email: ${skippedNoEmail}`
  );
  console.log(
    `  state breakdown — Discord: ${withDiscord}/${recipients.length}, GitHub: ${withGithub}/${recipients.length}, Survey: ${withSurvey}/${recipients.length}`
  );

  if (recipients.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const allMissing = recipients.find(
      (r) => !r.discordUsername && !r.githubLogin && !r.surveyDone
    );
    const allDone = recipients.find(
      (r) => r.discordUsername && r.githubLogin && r.surveyDone
    );
    const samples = [
      { label: "ALL MISSING", recipient: allMissing },
      { label: "ALL DONE", recipient: allDone },
      { label: "FIRST", recipient: recipients[0] },
    ].filter((s, i, arr) => {
      if (!s.recipient) return false;
      // dedupe by recipient identity
      return arr.findIndex((x) => x.recipient?.applicationId === s.recipient!.applicationId) === i;
    });

    for (const s of samples) {
      const r = s.recipient!;
      const { subject, html } = buildEmail(r);
      console.log("============================================================");
      console.log(`SAMPLE — ${s.label}`);
      console.log("============================================================");
      console.log(`To:      ${r.email} (${r.name || "(no name)"})`);
      console.log(`Discord: ${r.discordUsername ?? "(not connected)"}`);
      console.log(`GitHub:  ${r.githubLogin ?? "(not connected)"}`);
      console.log(`Survey:  ${r.surveyDone ? "submitted" : "not submitted"}`);
      console.log(`Subject: ${subject}`);
      console.log(`\n---- HTML preview (first 2400 chars) ----\n${html.slice(0, 2400)}\n…\n`);
    }
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r);
    try {
      await sendEmail({ to: r.email, subject, html, text });
      await db.collection(SUMMER_COHORT_COLLECTION).doc(r.applicationId).set(
        { cohort1StatusCheckEmailedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      sent++;
      if (sent % 10 === 0) {
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
