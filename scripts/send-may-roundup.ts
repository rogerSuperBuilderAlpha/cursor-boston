#!/usr/bin/env node
/**
 * General May roundup email to the whole list (Firestore `eventContacts`).
 *
 * Three sections:
 *   1. May 11 — Summer Cohort 1 kickoff. PERSONALIZED per recipient with
 *      their current application status and whether their CB profile has
 *      GitHub linked. Recipients without a CB account see a "sign up first"
 *      prompt instead.
 *   2. May 13 — PyData Data Science Hack at Moderna.
 *   3. May 26 — AIC × Hult International, Boston Tech Week kickoff.
 *
 * Usage:
 *   npx tsx scripts/send-may-roundup.ts --dry-run
 *   npx tsx scripts/send-may-roundup.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

// PyData
const PYDATA_LUMA_URL = "https://luma.com/ggjlxdnk";
const PYDATA_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-pydata-2026";

// Hult / May 26
const HULT_LUMA_URL = "https://luma.com/t5vseeed";
const HULT_WEBSITE_SIGNUP_URL =
  "https://www.cursorboston.com/hackathons/sports-hack-2026/signup";
const HULT_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-sports-hack-2026";

// Cohort
const COHORT_APPLY_URL = "https://www.cursorboston.com/summer-cohort";
const SIGNUP_URL = "https://www.cursorboston.com/login";
const COMMUNITY_REPO_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Per-recipient personalization
// ---------------------------------------------------------------------------

type CohortStatus =
  | { kind: "no-cb-account" }
  | { kind: "cb-no-app"; githubLogin: string | null }
  | { kind: "applied-c1-pending"; githubLogin: string | null }
  | { kind: "applied-c1-admitted"; githubLogin: string | null }
  | { kind: "applied-c1-rejected"; githubLogin: string | null }
  | { kind: "applied-c1-waitlist"; githubLogin: string | null }
  | {
      kind: "applied-c2-only";
      status: "pending" | "admitted" | "rejected" | "waitlist";
      githubLogin: string | null;
    };

async function resolveCohortStatus(
  db: Firestore,
  email: string
): Promise<CohortStatus> {
  const lower = email.trim().toLowerCase();
  const userSnap = await db
    .collection("users")
    .where("email", "==", lower)
    .limit(1)
    .get();
  if (userSnap.empty) {
    // Some users have mixed-case emails stored — try the original too.
    if (lower !== email) {
      const fb = await db.collection("users").where("email", "==", email).limit(1).get();
      if (!fb.empty) return resolveForUid(db, fb.docs[0].id, fb.docs[0].data());
    }
    return { kind: "no-cb-account" };
  }
  return resolveForUid(db, userSnap.docs[0].id, userSnap.docs[0].data());
}

async function resolveForUid(
  db: Firestore,
  uid: string,
  userData: Record<string, unknown>
): Promise<CohortStatus> {
  const githubLogin =
    userData.github && typeof userData.github === "object" &&
    typeof (userData.github as { login?: string }).login === "string"
      ? ((userData.github as { login: string }).login)
      : null;

  const appSnap = await db.collection("summerCohortApplications").doc(uid).get();
  if (!appSnap.exists) {
    return { kind: "cb-no-app", githubLogin };
  }
  const a = appSnap.data() ?? {};
  const cohorts: string[] = Array.isArray(a.cohorts) ? a.cohorts : [];
  const status = typeof a.status === "string" ? a.status : "pending";
  const inC1 = cohorts.includes("cohort-1");
  const inC2 = cohorts.includes("cohort-2");

  if (inC1) {
    if (status === "admitted") return { kind: "applied-c1-admitted", githubLogin };
    if (status === "rejected") return { kind: "applied-c1-rejected", githubLogin };
    if (status === "waitlist") return { kind: "applied-c1-waitlist", githubLogin };
    return { kind: "applied-c1-pending", githubLogin };
  }
  if (inC2) {
    return {
      kind: "applied-c2-only",
      status: status === "admitted" || status === "rejected" || status === "waitlist" ? status : "pending",
      githubLogin,
    };
  }
  return { kind: "cb-no-app", githubLogin };
}

function statusLines(status: CohortStatus): { html: string; text: string } {
  // Status pill color choices map to the kind. Simple inline styles keep it
  // email-client-safe.
  const renderHtml = (label: string, body: string, color: string) => `
<div style="margin:12px 0;padding:12px 14px;border-left:4px solid ${color};background:#f8fafc;border-radius:0 6px 6px 0;">
  <div style="font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.04em;font-size:12px;">${escapeHtml(label)}</div>
  <div style="margin-top:4px;font-size:14px;color:#111;">${body}</div>
</div>`;
  const renderText = (label: string, body: string) =>
    `\n  [${label}] ${body}\n`;

  const githubLine = (login: string | null) =>
    login
      ? `GitHub: connected as @${escapeHtml(login)}.`
      : `GitHub: <strong>not connected.</strong> <a href="${COHORT_APPLY_URL}">Connect on the cohort page</a> so merged PRs auto-count toward your spot.`;
  const githubLineText = (login: string | null) =>
    login
      ? `GitHub: connected as @${login}.`
      : `GitHub: NOT connected. Connect on the cohort page (${COHORT_APPLY_URL}) so merged PRs auto-count toward your spot.`;

  switch (status.kind) {
    case "no-cb-account":
      return {
        html: renderHtml(
          "Your status",
          `<strong>You don&apos;t have a Cursor Boston account yet.</strong> Sign up at <a href="${SIGNUP_URL}">cursorboston.com</a>, link your GitHub, and apply to Cohort 1 — kickoff is Mon May 11.`,
          "#6b7280"
        ),
        text: renderText(
          "Your status",
          `You don't have a Cursor Boston account yet. Sign up at ${SIGNUP_URL}, link GitHub, and apply at ${COHORT_APPLY_URL} — kickoff is Mon May 11.`
        ),
      };
    case "cb-no-app":
      return {
        html: renderHtml(
          "Your status",
          `<strong>You haven&apos;t applied to the cohort yet.</strong> Apply at <a href="${COHORT_APPLY_URL}">cursorboston.com/summer-cohort</a> before kickoff Mon May 11.<br/>${githubLine(status.githubLogin)}`,
          "#d97706"
        ),
        text: renderText(
          "Your status",
          `You haven't applied to the cohort yet. Apply at ${COHORT_APPLY_URL} before kickoff Mon May 11.\n  ${githubLineText(status.githubLogin)}`
        ),
      };
    case "applied-c1-pending":
      return {
        html: renderHtml(
          "Your status",
          `<strong>Cohort 1 application: pending.</strong> Merge any PR to the <a href="${COMMUNITY_REPO_URL}">community repo</a> before May 9 to auto-admit.<br/>${githubLine(status.githubLogin)}`,
          "#d97706"
        ),
        text: renderText(
          "Your status",
          `Cohort 1 application: PENDING. Merge any PR to the community repo (${COMMUNITY_REPO_URL}) before May 9 to auto-admit.\n  ${githubLineText(status.githubLogin)}`
        ),
      };
    case "applied-c1-admitted":
      return {
        html: renderHtml(
          "Your status",
          `<strong>You&apos;re in Cohort 1.</strong> Kickoff Mon May 11 at 6:00 PM ET on Zoom — link goes out by email earlier that day.<br/>${githubLine(status.githubLogin)}`,
          "#10b981"
        ),
        text: renderText(
          "Your status",
          `You're in Cohort 1. Kickoff Mon May 11 at 6:00 PM ET on Zoom — link goes out by email earlier that day.\n  ${githubLineText(status.githubLogin)}`
        ),
      };
    case "applied-c1-waitlist":
      return {
        html: renderHtml(
          "Your status",
          `<strong>Cohort 1 application: waitlist.</strong> Merge a PR to the <a href="${COMMUNITY_REPO_URL}">community repo</a> to move up. Cohort 2 (June 29) is also still open.<br/>${githubLine(status.githubLogin)}`,
          "#d97706"
        ),
        text: renderText(
          "Your status",
          `Cohort 1 application: WAITLIST. Merge a PR to the community repo (${COMMUNITY_REPO_URL}) to move up. Cohort 2 (June 29) is also still open.\n  ${githubLineText(status.githubLogin)}`
        ),
      };
    case "applied-c1-rejected":
      return {
        html: renderHtml(
          "Your status",
          `Cohort 1 application not selected this round. Cohort 2 starts June 29 — happy to consider you again. The May 26 event is still open to you.<br/>${githubLine(status.githubLogin)}`,
          "#6b7280"
        ),
        text: renderText(
          "Your status",
          `Cohort 1 application not selected this round. Cohort 2 starts June 29 — happy to consider you again. The May 26 event is still open to you.\n  ${githubLineText(status.githubLogin)}`
        ),
      };
    case "applied-c2-only": {
      const s = status.status;
      const stext =
        s === "admitted"
          ? "You're in Cohort 2 (kicks off June 29)."
          : s === "waitlist"
          ? "You're on the Cohort 2 waitlist (June 29)."
          : s === "rejected"
          ? "Cohort 2 application not selected this round."
          : "Cohort 2 application is pending (kicks off June 29).";
      return {
        html: renderHtml(
          "Your status",
          `<strong>${escapeHtml(stext)}</strong> Cohort 1 kicks off Mon May 11 — if you want to be considered for Cohort 1 instead, reply to this email.<br/>${githubLine(status.githubLogin)}`,
          "#3b82f6"
        ),
        text: renderText(
          "Your status",
          `${stext} Cohort 1 kicks off Mon May 11 — if you want to be considered for Cohort 1 instead, reply to this email.\n  ${githubLineText(status.githubLogin)}`
        ),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Email body
// ---------------------------------------------------------------------------

interface ContactData {
  email: string;
  name: string;
  firstName: string;
  status: CohortStatus;
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
  const status = statusLines(contact.status);

  const subject =
    "Cursor Boston this month — May 11 cohort kickoff + May 13 PyData + May 26 Tech Week";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${firstHtml},</p>

<p>Three things on the Cursor Boston calendar this month. The first one is personal to you — your cohort status is at the top of section 1 below.</p>

<h2 style="margin-top:28px;margin-bottom:6px;">1. Summer Cohort 1 — kickoff Mon May 11</h2>
<p style="margin-top:0;color:#555;">Monday <strong>May 11, 6:00 PM ET</strong> · Zoom (link goes out by email)</p>

<p>Six weeks of building with Cursor alongside other Boston devs, founders, and students. Each week ends with a live demo and a cohort vote. Winners maintain the platforms they shipped through demo day. PR contributions to the community repo can <strong>auto-admit</strong> pending applicants right up to May 9.</p>

${status.html}

<p><a href="${COHORT_APPLY_URL}" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Cohort dashboard →</a></p>

<hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;"/>

<h2 style="margin-top:28px;margin-bottom:6px;">2. Cursor Boston × PyData Data Science Hack — Wed May 13</h2>
<p style="margin-top:0;color:#555;">Wednesday <strong>May 13, 6:30 PM – 9:30 PM ET</strong> · Moderna HQ, Cambridge (325 Binney St)</p>

<p>Evening hackathon co-hosted with PyData Boston. Short talk from <strong>Eric Ma</strong>, then a focused build session on data-science workflows in Cursor. Pizza, community, and Cursor credits for the first 50 attendees.</p>

<p><strong>Moderna security:</strong> Luma sign-up closes <strong>48 hours before the event</strong>. After Luma approval you&apos;ll get an email from <code>no-reply@envoy.com</code> — complete the Envoy NDA sign-in before arriving for your QR code. No QR, no entry.</p>

<p><a href="${PYDATA_LUMA_URL}" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">RSVP on Luma →</a></p>

<p style="font-size:14px;color:#555;">Detail: <a href="${PYDATA_DETAIL_URL}">${PYDATA_DETAIL_URL}</a></p>

<hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;"/>

<h2 style="margin-top:28px;margin-bottom:6px;">3. Cursor Boston × Hult — Boston Tech Week kickoff — Tue May 26</h2>
<p style="margin-top:0;color:#555;">Tuesday <strong>May 26, 10:00 AM – 4:00 PM ET</strong> · Hult International, Cambridge</p>

<p>A full day kicking off Boston Tech Week with AIC and Hult. Coffee &amp; networking, a guest lecture from <strong>Antonio Mele (London School of Economics)</strong>, lunch, a 2-hour hackathon sprint, AI scoring, top-10 live presentations. Co-run with BeatM, Red Bull, NFX, and MIT Sports Lab.</p>

<p><strong>$50 Cursor credits + Red Bull merch for selected participants. $1,200 prize pool.</strong> The room only fits 80 — selection is by website ranking, prioritizing PR contributors.</p>

<p><strong>Two steps to reserve a seat — both required:</strong></p>

<p><strong>1. RSVP on Luma</strong> (door entry &amp; approvals)<br/>
→ <a href="${HULT_LUMA_URL}">${HULT_LUMA_URL}</a></p>

<p><strong>2. Register on the website</strong> (locks you into the 80-seat ranking)<br/>
→ <a href="${HULT_WEBSITE_SIGNUP_URL}">${HULT_WEBSITE_SIGNUP_URL}</a></p>

<p>Then merge PRs to the <a href="${COMMUNITY_REPO_URL}">community repo</a> to climb the leaderboard.</p>

<p style="font-size:14px;color:#555;">Detail: <a href="${HULT_DETAIL_URL}">${HULT_DETAIL_URL}</a></p>

<hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;"/>

<p><strong>One more thing — hiring managers, this is for you.</strong> If you have open roles at your company (engineers, founding eng, internships, anything), take 2 minutes to fill out our hiring-partner survey at <a href="https://www.cursorboston.com/partners">cursorboston.com/partners</a>. We&apos;re actively matching cohort builders to partner roles, and the survey captures what &quot;senior&quot; means at <em>your</em> company so we route candidates accordingly.</p>

<p>See you in May.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a> · <a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you registered for a Cursor Boston event on Luma.<br/>
Don&apos;t want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Three things on the Cursor Boston calendar this month. The first one is personal to you — your cohort status is at the top of section 1 below.


1. SUMMER COHORT 1 — KICKOFF MON MAY 11
Monday May 11, 6:00 PM ET · Zoom (link goes out by email)

Six weeks of building with Cursor alongside other Boston devs, founders, and students. Each week ends with a live demo and a cohort vote. Winners maintain the platforms they shipped through demo day. PR contributions to the community repo can auto-admit pending applicants right up to May 9.
${status.text}
Cohort dashboard: ${COHORT_APPLY_URL}


---


2. CURSOR BOSTON × PYDATA DATA SCIENCE HACK — WED MAY 13
Wednesday May 13, 6:30 PM – 9:30 PM ET · Moderna HQ, Cambridge (325 Binney St)

Evening hackathon co-hosted with PyData Boston. Short talk from Eric Ma, then a focused build session on data-science workflows in Cursor. Pizza, community, and Cursor credits for the first 50 attendees.

Moderna security: Luma sign-up closes 48 hours before the event. After Luma approval you'll get an email from no-reply@envoy.com — complete the Envoy NDA sign-in before arriving for your QR code. No QR, no entry.

RSVP on Luma: ${PYDATA_LUMA_URL}
Detail: ${PYDATA_DETAIL_URL}


---


3. CURSOR BOSTON × HULT — BOSTON TECH WEEK KICKOFF — TUE MAY 26
Tuesday May 26, 10:00 AM – 4:00 PM ET · Hult International, Cambridge

A full day kicking off Boston Tech Week with AIC and Hult. Coffee & networking, a guest lecture from Antonio Mele (London School of Economics), lunch, a 2-hour hackathon sprint, AI scoring, top-10 live presentations. Co-run with BeatM, Red Bull, NFX, and MIT Sports Lab.

$50 Cursor credits + Red Bull merch for selected participants. $1,200 prize pool. The room only fits 80 — selection is by website ranking, prioritizing PR contributors.

TWO STEPS — both required:

1. RSVP on Luma (door entry & approvals)
   → ${HULT_LUMA_URL}

2. Register on the website (locks you into the 80-seat ranking)
   → ${HULT_WEBSITE_SIGNUP_URL}

Then merge PRs to the community repo to climb the leaderboard.
   → ${COMMUNITY_REPO_URL}

Detail: ${HULT_DETAIL_URL}


---

ONE MORE THING — HIRING MANAGERS, THIS IS FOR YOU
If you have open roles at your company (engineers, founding eng, internships, anything), take 2 minutes to fill out our hiring-partner survey at https://www.cursorboston.com/partners. We're actively matching cohort builders to partner roles, and the survey captures what "senior" means at YOUR company so we route candidates accordingly.

See you in May.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

---
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
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  // Mirror Mailgun bounces + complaints onto eventContacts.unsubscribed
  // before we read the list. No-ops if MAILGUN_PRIVATE_API_KEY is unset.
  await syncMailgunSuppressions(db);

  console.log("Loading contacts from eventContacts…");
  const snap = await db.collection("eventContacts").get();
  console.log(`Total contacts: ${snap.size}`);

  // Resolve cohort + GitHub status per contact.
  const contacts: ContactData[] = [];
  let skippedUnsub = 0;
  let i = 0;
  for (const doc of snap.docs) {
    i++;
    const data = doc.data();
    if (data.unsubscribed === true) {
      skippedUnsub++;
      continue;
    }
    const email = (data.email as string) || doc.id;
    const status = await resolveCohortStatus(db, email);
    contacts.push({
      email,
      name: (data.name as string) || "",
      firstName: (data.firstName as string) || "",
      status,
    });
    if (i % 50 === 0) {
      console.log(`  resolved ${i}/${snap.size}`);
    }
  }

  console.log(
    `Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsub}`
  );

  // Status breakdown
  const tally: Record<string, number> = {};
  for (const c of contacts) tally[c.status.kind] = (tally[c.status.kind] ?? 0) + 1;
  console.log("\nStatus breakdown:");
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`);
  }

  if (dryRun) {
    const sample = contacts.find((c) => c.status.kind === "applied-c1-admitted") ?? contacts[0];
    if (sample) {
      const { subject, text } = buildEmail(sample);
      console.log(`\n--- sample email to ${sample.email} (kind=${sample.status.kind}) ---`);
      console.log(`Subject: ${subject}\n`);
      console.log(text);
    }

    // Write rendered HTML previews — one file per status kind — so the
    // email can be opened in a browser to see what each segment receives.
    const writeHtml = args.includes("--write-html");
    if (writeHtml) {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      const { join } = await import("node:path");
      const dir = join(process.cwd(), "scripts", "data", "may-roundup-previews");
      mkdirSync(dir, { recursive: true });
      const seen = new Set<string>();
      for (const c of contacts) {
        if (seen.has(c.status.kind)) continue;
        seen.add(c.status.kind);
        const { html, subject } = buildEmail(c);
        const file = join(dir, `${c.status.kind}.html`);
        const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject} — ${c.status.kind}</title></head><body style="margin:0;padding:24px;background:#f3f4f6;">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
<div style="font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:16px;">
PREVIEW — kind: <code>${c.status.kind}</code> | recipient: <code>${escapeHtml(c.email)}</code> | subject: <code>${escapeHtml(subject)}</code>
</div>
${html}
</div>
</body></html>`;
        writeFileSync(file, wrapped);
        console.log(`  wrote ${file}`);
      }
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

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
