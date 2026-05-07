#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Personalized "you're on the May 26 list — here are 3 things" email to every
 * attendee on the Sports Hack 2026 (May 26) list. Three sections, each one
 * flips between "do this" and "✓ already done" based on per-attendee state:
 *
 *   1. Claim your seat on the website  → flips ✓ if they have a
 *      hackathonEventSignups doc for sports-hack-2026 (i.e. completed website
 *      signup, not just Luma RSVP).
 *   2. Apply to Cohort 1               → flips ✓ if they appear in
 *      summerCohortApplications with cohorts including "cohort-1" and status
 *      in {pending, admitted}.
 *   3. Come play Generals              → flips between "come try it" and
 *      "thanks for playing — back for another turn?" based on whether they
 *      have a game_players/<userId> doc.
 *
 * Recipients = every dedup'd attendee in the unified May 26 list (mirrors
 * scripts/rank-may26-attendees.ts logic): website signups + luma-only,
 * skipping judges, declined, and eventContacts.unsubscribed.
 *
 * Usage:
 *   npx tsx scripts/send-may26-attendee-action-prompts.ts --dry-run
 *   npx tsx scripts/send-may26-attendee-action-prompts.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import {
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORT_IMMERSION,
  isValidCohortId,
} from "../lib/summer-cohort";
import {
  getDeclinedEmailsForEvent,
  getJudgeEmailsForEvent,
} from "../lib/hackathon-event-signup";

const EVENT_ID = SUMMER_COHORT_IMMERSION.eventId;

const COHORT_URL = "https://www.cursorboston.com/summer-cohort";
const MAY26_SIGNUP_URL =
  "https://www.cursorboston.com/hackathons/sports-hack-2026/signup";
const MAY26_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-sports-hack-2026";
const GENERALS_URL = "https://www.cursorboston.com/game";
const GENERALS_LEADERBOARD_URL = "https://www.cursorboston.com/game/leaderboard";
const GENERALS_DOCS_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/docs/generals/README.md";
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Attendee {
  email: string;
  displayName: string | null;
  confirmedOnSite: boolean;
  cohort1: boolean;
  playedGame: boolean;
}

function buildEmail(a: Attendee): { subject: string; html: string; text: string } {
  const first = escapeHtml(
    a.displayName?.split(" ")[0]?.trim() || "there"
  );
  const unsubUrl = buildUnsubscribeUrl(a.email);
  const subject = "You're on the May 26 list — three quick things";

  // Section 1 — claim seat on site
  const seatHtml = a.confirmedOnSite
    ? `<h3 style="margin-top:24px;margin-bottom:8px;">1. ✓ You&apos;re confirmed on the site for May 26</h3>
<p>You&apos;ve completed the website signup as well as Luma — nothing to do here. <a href="${MAY26_DETAIL_URL}">Event details</a> if you want a refresher.</p>`
    : `<h3 style="margin-top:24px;margin-bottom:8px;">1. Claim your seat on cursorboston.com</h3>
<p>You&apos;re on Luma, but the seat isn&apos;t locked in until you also complete the <strong>website signup</strong>. The site is what we use for the unified leaderboard, your check-in QR, and your spot inside the 80-person cap.</p>
<p><a href="${MAY26_SIGNUP_URL}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">Claim your seat →</a></p>`;

  // Section 2 — cohort 1
  const cohortHtml = a.cohort1
    ? `<h3 style="margin-top:24px;margin-bottom:8px;">2. ✓ You&apos;re in for Cohort 1</h3>
<p>You&apos;ve already applied to Cohort 1 — Cohort 1 has priority on the May 26 cap, so you&apos;re set there too. If you haven&apos;t finished the locality + presenting questions on your application, take 30 seconds at <a href="${COHORT_URL}">${COHORT_URL}</a>.</p>`
    : `<h3 style="margin-top:24px;margin-bottom:8px;">2. Apply to Cohort 1 — starts Mon, May 11</h3>
<p>Our first cohort is six weeks of structured shipping, weekly check-ins, mentor pairing, and the May 26 immersion day at Hult. If you want a reason to actually commit time to leveling up your AI-tooling skills with a group doing the same thing, this is it. Cohort 1 also gets priority on the 80-person cap for May 26.</p>
<p><a href="${COHORT_URL}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">Apply to Cohort 1 →</a></p>`;

  // Section 3 — generals
  const generalsHtml = a.playedGame
    ? `<h3 style="margin-top:24px;margin-bottom:8px;">3. Generals — thanks for playing. Come back for another turn.</h3>
<p>You&apos;ve already taken at least one turn in <strong>Generals</strong>, our turn-based strategy game built into the site. Nice. <a href="${GENERALS_URL}">Take another turn</a>, climb the <a href="${GENERALS_LEADERBOARD_URL}">leaderboard</a>, and bring a friend on May 26 — leaderboard standing carries into the day.</p>
<p>If you&apos;re into <strong>game development</strong> — especially Three.js / WebGL / graphical interfaces for gaming — Generals is wide open as a contribution surface. Lore, units, spells, artifacts, castes, buildings, balance, the map renderer, the 3D layer — every piece is documented with file paths and what testing we expect. <a href="${GENERALS_DOCS_URL}">Contribution guide</a>. If you ship a PR before May 26, you&apos;ll have something concrete to demo on the day.</p>`
    : `<h3 style="margin-top:24px;margin-bottom:8px;">3. Come play Generals — and on May 26, bring some game-dev energy</h3>
<p><strong>Generals</strong> is the turn-based strategy game we&apos;ve been growing inside the Cursor Boston site. Take a turn — recruit units, claim tiles, raid for artifacts. It&apos;s designed to be picked up in 2 minutes a day. <a href="${GENERALS_URL}">Play your first turn</a> · <a href="${GENERALS_LEADERBOARD_URL}">Leaderboard</a></p>
<p>If you&apos;re into <strong>game development</strong> — especially <strong>Three.js, WebGL, or graphical interfaces for gaming</strong> — May 26 is an unusually good chance to get some real experience. Generals is wide open as a contribution surface: lore, units, spells, artifacts, castes, buildings, balance, the map renderer, and the whole 3D / canvas layer. Every piece is documented with exact file paths and what testing we expect. Start at the <a href="${GENERALS_DOCS_URL}">contribution guide</a>; ship a PR before the 26th and you&apos;ll have something concrete to demo on the day.</p>`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>You&apos;re on the list for our <strong>${escapeHtml(SUMMER_COHORT_IMMERSION.title)}</strong> — Tuesday, May 26 at Hult International (Cambridge), kicking off Boston Tech Week. Three quick things, only the ones that aren&apos;t already done apply to you.</p>

${seatHtml}

${cohortHtml}

${generalsHtml}

<hr style="margin:32px 0;border:none;border-top:1px solid #e5e5e5;"/>

<p>Reply to this email if anything is unclear, you want to host or sponsor on the 26th, or you&apos;re looking for a way to get more involved with the community than attending — especially if you want to help build the game.</p>

<p>— Roger &amp; Cursor Boston<br/><small style="color:#666;">Repo: <a href="${REPO_URL}">${REPO_URL}</a></small></p>

<p style="font-size:12px;color:#888;margin-top:24px;">You&apos;re receiving this because you registered for the Cursor Boston May 26 immersion event. <a href="${escapeHtml(unsubUrl)}">Unsubscribe</a> at any time.</p>
</body></html>`;

  // Plain-text mirror
  const seatText = a.confirmedOnSite
    ? `1. CONFIRMED ON THE SITE
You've completed the website signup as well as Luma — nothing to do here.
Event details: ${MAY26_DETAIL_URL}`
    : `1. CLAIM YOUR SEAT ON CURSORBOSTON.COM
You're on Luma, but the seat isn't locked in until you also complete the website signup. The site is what we use for the unified leaderboard, your check-in QR, and your spot inside the 80-person cap.
→ ${MAY26_SIGNUP_URL}`;

  const cohortText = a.cohort1
    ? `2. ALREADY APPLIED TO COHORT 1
You've already applied to Cohort 1 — Cohort 1 has priority on the May 26 cap, so you're set there too. If you haven't finished the locality + presenting questions on your application, take 30 seconds: ${COHORT_URL}`
    : `2. APPLY TO COHORT 1 — STARTS MON, MAY 11
Six weeks of structured shipping, weekly check-ins, mentor pairing, and the May 26 immersion day at Hult. Cohort 1 also gets priority on the 80-person cap for May 26.
→ ${COHORT_URL}`;

  const generalsText = a.playedGame
    ? `3. GENERALS — THANKS FOR PLAYING. COME BACK FOR ANOTHER TURN.
You've already taken at least one turn in Generals. Nice. Take another turn: ${GENERALS_URL}
Leaderboard: ${GENERALS_LEADERBOARD_URL}

If you're into game development — especially Three.js / WebGL / graphical interfaces for gaming — Generals is wide open as a contribution surface. Lore, units, spells, artifacts, castes, buildings, balance, the map renderer, the 3D layer — every piece is documented with file paths and what testing we expect.
Contribution guide: ${GENERALS_DOCS_URL}
Ship a PR before May 26 and you'll have something concrete to demo on the day.`
    : `3. COME PLAY GENERALS — AND ON MAY 26, BRING SOME GAME-DEV ENERGY
Generals is the turn-based strategy game built into the Cursor Boston site. Take a turn — recruit units, claim tiles, raid for artifacts. Designed to be picked up in 2 minutes a day.
Play: ${GENERALS_URL}
Leaderboard: ${GENERALS_LEADERBOARD_URL}

If you're into game development — especially Three.js, WebGL, or graphical interfaces for gaming — May 26 is an unusually good chance to get real experience. Generals is wide open as a contribution surface: lore, units, spells, artifacts, castes, buildings, balance, the map renderer, and the whole 3D / canvas layer. Every piece is documented with exact file paths and what testing we expect.
Contribution guide: ${GENERALS_DOCS_URL}
Ship a PR before the 26th and you'll have something concrete to demo on the day.`;

  const text = `Hi ${a.displayName?.split(" ")[0]?.trim() || "there"},

You're on the list for our ${SUMMER_COHORT_IMMERSION.title} — Tuesday, May 26 at Hult International (Cambridge), kicking off Boston Tech Week. Three quick things, only the ones that aren't already done apply to you.

${seatText}

${cohortText}

${generalsText}

---

Reply to this email if anything is unclear, you want to host or sponsor on the 26th, or you're looking for a way to get more involved with the community than attending — especially if you want to help build the game.

— Roger & Cursor Boston
Repo: ${REPO_URL}

You're receiving this because you registered for the Cursor Boston May 26 immersion event.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const send = argv.includes("--send");
  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  return { dryRun, send };
}

async function main() {
  const { dryRun, send } = parseArgs(process.argv.slice(2));

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

  // 1. Cohort-1 (pending+admitted) emails.
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const cohort1Emails = new Set<string>();
  for (const doc of appsSnap.docs) {
    const d = doc.data();
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts.filter(isValidCohortId) : [];
    if (!cohorts.includes("cohort-1")) continue;
    const status = typeof d.status === "string" ? d.status : "pending";
    if (status !== "pending" && status !== "admitted") continue;
    const email = (d.email || "").toString().trim().toLowerCase();
    if (email) cohort1Emails.add(email);
  }
  console.log(`Cohort-1 (pending+admitted): ${cohort1Emails.size}`);

  // 2. Website signups for May 26 + their user docs.
  const signupSnap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", EVENT_ID)
    .get();
  const websiteUserIds = signupSnap.docs
    .map((d) => d.data().userId as string | undefined)
    .filter((u): u is string => Boolean(u));
  const userMap = new Map<string, FirebaseFirestore.DocumentData>();
  for (let i = 0; i < websiteUserIds.length; i += 10) {
    const chunk = websiteUserIds.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) if (s.exists) userMap.set(s.id, s.data() ?? {});
  }
  console.log(`Website signups (sports-hack-2026): ${signupSnap.size}`);

  // 3. Luma registrants (already synced in Firestore).
  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", EVENT_ID)
    .get();
  console.log(`Luma registrants (sports-hack-2026): ${lumaSnap.size}`);

  // 4. eventContacts → unsubscribed set.
  const ecSnap = await db.collection("eventContacts").get();
  const unsubscribedEmails = new Set<string>();
  for (const doc of ecSnap.docs) {
    if (doc.data().unsubscribed === true) {
      const e = (doc.data().email || doc.id).toString().trim().toLowerCase();
      if (e) unsubscribedEmails.add(e);
    }
  }
  console.log(`Unsubscribed emails (global): ${unsubscribedEmails.size}`);

  // 5. users by email — needed to map luma-only attendees to a userId for the
  //    game_players check.
  const usersByEmail = new Map<string, string>();
  const usersSnap = await db.collection("users").get();
  for (const doc of usersSnap.docs) {
    const e = doc.data().email;
    if (typeof e === "string") usersByEmail.set(e.trim().toLowerCase(), doc.id);
  }

  // 6. Per-event judge / declined filters.
  const judgeEmails = getJudgeEmailsForEvent(EVENT_ID);
  const declinedEmails = getDeclinedEmailsForEvent(EVENT_ID);

  // 7. Build attendees: website first, then luma-only (skip dupes by email or
  //    github login — same dedup as scripts/rank-may26-attendees.ts).
  const attendees: Attendee[] = [];
  const seenEmails = new Set<string>();
  const websiteGithubLogins = new Set<string>();
  const userIdsToCheckForGame = new Set<string>();

  for (const doc of signupSnap.docs) {
    const data = doc.data();
    const userId = data.userId as string | undefined;
    if (!userId) continue;
    const profile = userMap.get(userId) ?? {};
    const email =
      typeof profile.email === "string"
        ? profile.email.trim().toLowerCase()
        : null;
    if (!email) continue;
    if (judgeEmails.has(email) || declinedEmails.has(email)) continue;
    if (unsubscribedEmails.has(email)) continue;
    seenEmails.add(email);
    const ghLogin =
      profile.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login ?? null
        : null;
    if (ghLogin) websiteGithubLogins.add(ghLogin.toLowerCase());
    userIdsToCheckForGame.add(userId);
    attendees.push({
      email,
      displayName:
        typeof profile.displayName === "string" ? profile.displayName : null,
      confirmedOnSite: true,
      cohort1: cohort1Emails.has(email),
      playedGame: false, // filled in below
    });
  }

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string | undefined)?.trim().toLowerCase() ?? "";
    if (!email) continue;
    if (judgeEmails.has(email) || declinedEmails.has(email)) continue;
    if (unsubscribedEmails.has(email)) continue;
    if (seenEmails.has(email)) continue;
    const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
    if (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase())) continue;
    seenEmails.add(email);
    const luminaUserId = usersByEmail.get(email);
    if (luminaUserId) userIdsToCheckForGame.add(luminaUserId);
    attendees.push({
      email,
      displayName: typeof d.name === "string" ? d.name : null,
      confirmedOnSite: false,
      cohort1: cohort1Emails.has(email),
      playedGame: false,
    });
  }

  // 8. Game-played check: batch-get game_players docs for all candidate uids.
  const playedUserIds = new Set<string>();
  const userIdsArr = [...userIdsToCheckForGame];
  for (let i = 0; i < userIdsArr.length; i += 10) {
    const chunk = userIdsArr.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection("game_players").doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) if (s.exists) playedUserIds.add(s.id);
  }
  // Re-walk attendees to set playedGame.
  // Build email→userId map from the two channels:
  const emailToUserId = new Map<string, string>();
  for (const doc of signupSnap.docs) {
    const userId = doc.data().userId as string | undefined;
    if (!userId) continue;
    const profile = userMap.get(userId) ?? {};
    const email =
      typeof profile.email === "string"
        ? profile.email.trim().toLowerCase()
        : null;
    if (email) emailToUserId.set(email, userId);
  }
  for (const a of attendees) {
    const uid = emailToUserId.get(a.email) ?? usersByEmail.get(a.email);
    if (uid && playedUserIds.has(uid)) a.playedGame = true;
  }

  // 9. Counts.
  const totals = {
    total: attendees.length,
    confirmedOnSite: attendees.filter((a) => a.confirmedOnSite).length,
    cohort1: attendees.filter((a) => a.cohort1).length,
    played: attendees.filter((a) => a.playedGame).length,
  };
  console.log(
    `\nRecipients: ${totals.total}\n  ✓ confirmed on site: ${totals.confirmedOnSite}  (${totals.total - totals.confirmedOnSite} need to claim)\n  ✓ cohort 1:           ${totals.cohort1}  (${totals.total - totals.cohort1} should apply)\n  ✓ played generals:    ${totals.played}  (${totals.total - totals.played} haven't played)`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");

    // Print one sample of each variant we can find.
    const variants: Array<[string, (a: Attendee) => boolean]> = [
      ["confirmed=Y, cohort1=Y, played=Y", (a) => a.confirmedOnSite && a.cohort1 && a.playedGame],
      ["confirmed=Y, cohort1=Y, played=N", (a) => a.confirmedOnSite && a.cohort1 && !a.playedGame],
      ["confirmed=N, cohort1=Y, played=N", (a) => !a.confirmedOnSite && a.cohort1 && !a.playedGame],
      ["confirmed=N, cohort1=N, played=N", (a) => !a.confirmedOnSite && !a.cohort1 && !a.playedGame],
    ];
    for (const [label, pred] of variants) {
      const sample = attendees.find(pred);
      console.log("============================================================");
      console.log(`VARIANT — ${label}`);
      console.log("============================================================");
      if (!sample) {
        console.log("  (no attendee matches this combination)\n");
        continue;
      }
      const { subject, text } = buildEmail(sample);
      console.log(`To:      ${sample.email} (${sample.displayName || "?"})`);
      console.log(`Subject: ${subject}`);
      console.log(`\n${text}\n`);
    }

    console.log(`Would send to ${attendees.length} recipients.`);
    return;
  }

  // 10. Send.
  let sent = 0;
  let failed = 0;
  for (const a of attendees) {
    const { subject, html, text } = buildEmail(a);
    try {
      await sendEmail({ to: a.email, subject, html, text });
      sent++;
      if (sent % 25 === 0) {
        console.log(`  Progress: ${sent}/${attendees.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${a.email}`, e);
    }
    await sleep(450);
  }
  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
