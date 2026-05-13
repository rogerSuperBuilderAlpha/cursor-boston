#!/usr/bin/env node
/**
 * Cohort 2 — "get ready while you wait" email.
 *
 * One broadcast to every cohort-2 applicant with an open status
 * (pending / admitted / waitlist) telling them:
 *   1. When kickoff is (Mon Jun 29 → Fri Aug 7)
 *   2. To get their dev env installed now via ludwitt.com/alc
 *   3. To start contributing to OSS while they wait — cursor-boston
 *      itself first, the /game subsystem as the highest-leverage target
 *
 * Recipients who are *also* in cohort 1 get a different lead paragraph
 * that frames C2 as the next round in an ongoing community ("welcome
 * back, also welcome in C3, C4, C5, C6, etc. — cohorts compound").
 *
 * Idempotent via `cohort2PrepEmailedAt` on the application doc. Re-runs
 * skip already-stamped recipients unless --force is passed.
 *
 * Usage:
 *   npx tsx scripts/send-cohort2-prep-email.ts --dry-run
 *   npx tsx scripts/send-cohort2-prep-email.ts --send
 *   npx tsx scripts/send-cohort2-prep-email.ts --send --force
 *   npx tsx scripts/send-cohort2-prep-email.ts --send --only-email=foo@bar.com
 *   npx tsx scripts/send-cohort2-prep-email.ts --preview-to=foo@bar.com
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

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const GAME_URL = "https://cursorboston.com/game";
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const FIRST_CONTRIBUTION_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/main/docs/FIRST_CONTRIBUTION.md";
const CONTRIBUTING_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/main/.github/CONTRIBUTING.md";
const ALC_URL = "https://ludwitt.com/alc";

interface Recipient {
  applicationId: string;
  email: string;
  name: string;
  inCohort1Too: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstNameOf(name: string): string {
  return name?.split(" ")[0]?.trim() || "there";
}

function buildEmail(r: Recipient): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(firstNameOf(r.name));
  const firstPlain = firstNameOf(r.name);
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject =
    "Cohort 2 — get your laptop ready + build with us while you wait";

  const leadHtml = r.inCohort1Too
    ? `<p>Hi ${first},</p>
<p>You're already with us in <strong>Cohort 1</strong> — thank you. You're also in for <strong>Cohort 2</strong> (Mon, Jun 29 → Fri, Aug 7), and you're welcome in every cohort after that — C3, C4, C5, C6, and on.</p>
<p>The whole point of doing this in cohorts is that the community compounds. The people you build with in C1 are the people you keep building with in C2 and beyond. Cohorts aren't exclusive — they're a recurring excuse to ship together. Same email below, but read it through the lens that you've already done a round of this and can hit the ground running.</p>`
    : `<p>Hi ${first},</p>
<p><strong>Cohort 2 kicks off Mon, Jun 29</strong> and wraps Fri, Aug 7 — about six and a half weeks from today. This email's about what to do between now and then so Day 1 is work, not still installing Node.</p>`;

  const leadText = r.inCohort1Too
    ? `Hi ${firstPlain},

You're already with us in COHORT 1 — thank you. You're also in for COHORT 2 (Mon, Jun 29 → Fri, Aug 7), and you're welcome in every cohort after that — C3, C4, C5, C6, and on.

The whole point of doing this in cohorts is that the community compounds. The people you build with in C1 are the people you keep building with in C2 and beyond. Cohorts aren't exclusive — they're a recurring excuse to ship together. Same email below, but read it through the lens that you've already done a round of this and can hit the ground running.`
    : `Hi ${firstPlain},

COHORT 2 KICKS OFF MON, JUN 29 and wraps Fri, Aug 7 — about six and a half weeks from today. This email's about what to do between now and then so Day 1 is work, not still installing Node.`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
${leadHtml}

<h3 style="margin:24px 0 4px;">📅 What's coming</h3>
<p style="margin:0 0 12px;">Kickoff Monday <strong>Jun 29</strong>. Weekly demos through the run. Graduation Friday <strong>Aug 7</strong>. Full timeline and what each week looks like is on the cohort page:</p>
<p style="margin:0 0 18px;">
  <a href="${COHORT_URL}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Open the cohort page →</a>
</p>

<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;"/>

<h3 style="margin:0 0 6px;">💻 Get your laptop ready — now, not on Day 1</h3>
<p style="margin:0 0 10px;">Install <strong>Node</strong> (LTS), <strong>Git</strong>, and <strong>Cursor</strong> (or Claude Code if you already have a flow). The full walkthrough — every step, every gotcha, every "wait, why did that fail" — is here:</p>
<p style="margin:0 0 18px;">
  <a href="${ALC_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Open the setup walkthrough →</a>
</p>
<p style="margin:0 0 18px;font-size:13px;color:#555;">Doing this in the next week means Day 1 is about building, not about fighting your shell.</p>

<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;"/>

<h3 style="margin:0 0 6px;">🛠️ While you wait — start building</h3>
<p style="margin:0 0 10px;">The single best thing you can do between now and Jun 29 is contribute to an open source project. Not a tutorial. A real repo with real PRs and real reviews. That's how you learn how a contemporary codebase actually works: how repos are organized, how builds get wired up, how CI gates a PR, how a maintainer reads your diff. None of that gets taught in a course. All of it gets taught by shipping one PR.</p>
<p style="margin:0 0 10px;">Two concrete targets, from easy entry to highest-leverage:</p>

<p style="margin:14px 0 6px;"><strong>1. Contribute to cursor-boston itself.</strong></p>
<p style="margin:0 0 6px;">This site, this repo. We tag issues by size (XS / S / M / L) and keep a running list of "good first issue" tickets. The first-contribution walkthrough is here:</p>
<p style="margin:0 0 14px;">
  <a href="${FIRST_CONTRIBUTION_URL}" style="color:#2563eb;font-weight:600;">First contribution guide →</a>
  &nbsp;·&nbsp;
  <a href="${CONTRIBUTING_URL}" style="color:#2563eb;font-weight:600;">Full contributing guide →</a>
</p>

<p style="margin:14px 0 6px;"><strong>2. Contribute to <code>/game</code> — the most fun way in.</strong></p>
<p style="margin:0 0 10px;">We built a small persistent web game right inside the repo. It's the highest-leverage place to start because the contribution loop is instant: change a file, reload, see the thing you shipped. Three ways in:</p>
<ul style="margin:6px 0 14px;padding-left:20px;line-height:1.6;">
  <li><strong>New mechanics</strong> — a new spell, unit, building, artifact, or upgrade. Each lives in its own tiny file under <code>lib/game/content/{spells,units,artifacts,upgrades,buildings}/</code>. A new spell ships in an afternoon.</li>
  <li><strong>Graphic design</strong> — if you'd rather draw than code, the game has slots for icons, NPC portraits, and board art. Show up with an asset and a PR.</li>
  <li><strong>Balance / playtest</strong> — play it, find what's broken or boring, PR the fix.</li>
</ul>
<p style="margin:0 0 14px;">Games are the best on-ramp because you see the result of every line you change, immediately. That's the fastest way to build the mental model of how software ships — and it's fun, which means you'll do it for longer than you would a tutorial.</p>
<p style="margin:0 0 6px;">
  <a href="${GAME_URL}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:6px;">Open /game →</a>
  <a href="${REPO_URL}" style="display:inline-block;background:#fff;color:#7c3aed;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #7c3aed;">Open the repo →</a>
</p>
<p style="margin:8px 0 0;font-size:13px;color:#555;">Game logic under <code>lib/game/</code>; UI under <code>app/game/</code>. Pick something small for your first PR.</p>

<p style="margin-top:24px;">Reply with anything — questions, install snags, ideas you want to sanity-check before building. The fastest way to find out if your idea is worth a PR is to ask.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you applied to Cohort 2.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `${leadText}

WHAT'S COMING
Kickoff Monday Jun 29. Weekly demos through the run. Graduation Friday Aug 7. Full timeline:
  ${COHORT_URL}

----

GET YOUR LAPTOP READY — NOW, NOT ON DAY 1
Install Node (LTS), Git, and Cursor (or Claude Code if you already have a flow). Full walkthrough — every step, every gotcha:
  ${ALC_URL}

Doing this in the next week means Day 1 is about building, not about fighting your shell.

----

WHILE YOU WAIT — START BUILDING
The single best thing you can do between now and Jun 29 is contribute to an open source project. Not a tutorial. A real repo with real PRs and real reviews. That's how you learn how a contemporary codebase actually works: how repos are organized, how builds get wired up, how CI gates a PR, how a maintainer reads your diff. None of that gets taught in a course. All of it gets taught by shipping one PR.

Two concrete targets, from easy entry to highest-leverage:

1. CONTRIBUTE TO CURSOR-BOSTON ITSELF
   This site, this repo. We tag issues by size (XS / S / M / L) and keep a running list of "good first issue" tickets.
     First contribution guide: ${FIRST_CONTRIBUTION_URL}
     Full contributing guide:  ${CONTRIBUTING_URL}

2. CONTRIBUTE TO /game — THE MOST FUN WAY IN
   We built a small persistent web game right inside the repo. It's the highest-leverage place to start because the contribution loop is instant: change a file, reload, see the thing you shipped. Three ways in:
     - New mechanics. A new spell, unit, building, artifact, or upgrade. Each lives in its own tiny file under lib/game/content/{spells,units,artifacts,upgrades,buildings}/. A new spell ships in an afternoon.
     - Graphic design. If you'd rather draw than code, the game has slots for icons, NPC portraits, and board art. Show up with an asset and a PR.
     - Balance / playtest. Play it, find what's broken or boring, PR the fix.

   Games are the best on-ramp because you see the result of every line you change, immediately. That's the fastest way to build the mental model of how software ships — and it's fun, which means you'll do it for longer than you would a tutorial.

     Play: ${GAME_URL}
     Repo: ${REPO_URL}

   Game logic under lib/game/; UI under app/game/. Pick something small for your first PR.

Reply with anything — questions, install snags, ideas you want to sanity-check before building. The fastest way to find out if your idea is worth a PR is to ask.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you applied to Cohort 2.
Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseFlag(args: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const send = args.includes("--send");
  const force = args.includes("--force");
  const onlyEmail = parseFlag(args, "only-email");
  const previewTo = parseFlag(args, "preview-to");

  // --preview-to is its own mode: render the email with a synthetic
  // recipient and send to the named inbox. Doesn't touch Firestore.
  if (previewTo) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --preview-to, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
    const samples: Array<{ label: string; recipient: Recipient }> = [
      {
        label: "C2-only",
        recipient: {
          applicationId: "preview-c2",
          email: previewTo,
          name: "Preview Recipient",
          inCohort1Too: false,
        },
      },
      {
        label: "C1+C2 overlap",
        recipient: {
          applicationId: "preview-c1c2",
          email: previewTo,
          name: "Preview Recipient",
          inCohort1Too: true,
        },
      },
    ];
    for (const s of samples) {
      const { subject, html, text } = buildEmail(s.recipient);
      console.log(`Sending preview "${s.label}" to ${previewTo}…`);
      await sendEmail({
        to: previewTo,
        subject: `[${s.label}] ${subject}`,
        html,
        text,
      });
      await sleep(450);
    }
    console.log("Done.");
    return;
  }

  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send (or use --preview-to=EMAIL)");
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

  console.log(`Loading cohort-2 applicants (pending/admitted/waitlist) from ${SUMMER_COHORT_COLLECTION}…`);
  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .where("cohorts", "array-contains", "cohort-2")
    .where("status", "in", ["pending", "admitted", "waitlist"])
    .get();

  const recipients: Recipient[] = [];
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;
  let inCohort1TooCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const email = (data.email || "").toString().trim();
    if (!email || !email.includes("@")) {
      skippedNoEmail++;
      continue;
    }
    if (onlyEmail && email.toLowerCase() !== onlyEmail.toLowerCase()) {
      continue;
    }
    const cohorts = Array.isArray(data.cohorts)
      ? data.cohorts.filter(isValidCohortId)
      : [];
    if (!cohorts.includes("cohort-2")) continue;
    if (!force && data.cohort2PrepEmailedAt) {
      skippedAlreadyEmailed++;
      continue;
    }

    const inCohort1Too = cohorts.includes("cohort-1");
    if (inCohort1Too) inCohort1TooCount++;

    recipients.push({
      applicationId: doc.id,
      email,
      name: typeof data.name === "string" ? data.name : "",
      inCohort1Too,
    });
  }

  console.log(
    `Eligible to email: ${recipients.length} | already emailed: ${skippedAlreadyEmailed} | no email: ${skippedNoEmail}`
  );
  console.log(
    `  overlap breakdown — also in cohort 1: ${inCohort1TooCount} / cohort-2-only: ${recipients.length - inCohort1TooCount}`
  );

  if (recipients.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const c2Only = recipients.find((r) => !r.inCohort1Too);
    const overlap = recipients.find((r) => r.inCohort1Too);
    const samples = [
      { label: "C2-ONLY", recipient: c2Only },
      { label: "C1+C2 OVERLAP", recipient: overlap },
      { label: "FIRST", recipient: recipients[0] },
    ].filter((s, i, arr) => {
      if (!s.recipient) return false;
      return (
        arr.findIndex((x) => x.recipient?.applicationId === s.recipient!.applicationId) === i
      );
    });

    for (const s of samples) {
      const r = s.recipient!;
      const { subject, html } = buildEmail(r);
      console.log("============================================================");
      console.log(`SAMPLE — ${s.label}`);
      console.log("============================================================");
      console.log(`To:       ${r.email} (${r.name || "(no name)"})`);
      console.log(`Overlap:  ${r.inCohort1Too ? "ALSO in cohort 1" : "cohort 2 only"}`);
      console.log(`Subject:  ${subject}`);
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
        { cohort2PrepEmailedAt: FieldValue.serverTimestamp() },
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
