#!/usr/bin/env node
/**
 * Hack-a-Sprint 2026 — distribute Cursor credit links to winners + top-50.
 *
 * Usage:
 *   # Export ranked list only (no emails)
 *   npx tsx scripts/distribute-cursor-credits.ts --dry-run
 *
 *   # Preview emails with credit links (no send)
 *   npx tsx scripts/distribute-cursor-credits.ts --dry-run --credits credits.json
 *
 *   # Send credit emails
 *   npx tsx scripts/distribute-cursor-credits.ts --send --credits credits.json
 *
 * credits.json format: flat array of URLs, assigned by rank order:
 *   ["https://cursor.com/redeem/abc", "https://cursor.com/redeem/def", ...]
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON; for --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { readFileSync } from "fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { fetchShowcaseSubmissionsFromGitHub } from "../lib/hackathon-showcase";
import { computeHackASprint2026RawScore } from "../lib/hackathon-asprint-2026-scores";
import { hackASprint2026ScoreDocId } from "../lib/hackathon-asprint-2026-state";
import { CURSOR_CREDIT_TOP_N } from "../lib/hackathon-event-signup";
import { sendEmail } from "../lib/mailgun";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com";
const PRIZE_AMOUNT_TOP6 = "$200";
const CREDIT_AMOUNT = "$50";
const PRIZE_POOL_SPOTS = 6;

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const send = argv.includes("--send");
  const creditsIdx = argv.indexOf("--credits");
  const creditsPath = creditsIdx >= 0 ? argv[creditsIdx + 1] ?? null : null;

  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  return { dryRun, send, creditsPath };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell(bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.5;color:#111;max-width:640px;">
${bodyHtml}
<p style="margin-top:24px;font-size:13px;color:#555;">Questions? Reply or write roger@cursorboston.com</p>
</body></html>`;
}

type RankedEntry = {
  rank: number;
  submissionId: string;
  githubLogin: string;
  title: string;
  rawScore: number | null;
  peerVoteCount: number;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  creditUrl: string | null;
  isPrizeWinner: boolean;
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { dryRun, send, creditsPath } = parseArgs(process.argv.slice(2));

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

  // Load credit links (optional)
  let creditUrls: string[] = [];
  if (creditsPath) {
    try {
      const raw = readFileSync(creditsPath, "utf8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== "string")) {
        console.error("Credits file must be a JSON array of URL strings.");
        process.exit(1);
      }
      creditUrls = parsed as string[];
      console.log(`Loaded ${creditUrls.length} credit link(s) from ${creditsPath}`);
    } catch (e) {
      console.error(`Cannot read credits file: ${creditsPath}`, e);
      process.exit(1);
    }
  }

  // Fetch submissions and scores
  console.log("Fetching submissions…");
  const submissions = await fetchShowcaseSubmissionsFromGitHub();
  if (submissions.length === 0) {
    console.log("No submissions found.");
    return;
  }

  const refs = submissions.map((s) =>
    db
      .collection("hackathonShowcaseScores")
      .doc(hackASprint2026ScoreDocId(s.submissionId))
  );
  const snaps = await db.getAll(...refs);
  const scoreBySid = new Map<string, DocumentData>();
  snaps.forEach((snap, i) => {
    if (snap.exists) {
      scoreBySid.set(submissions[i]!.submissionId, snap.data() ?? {});
    }
  });

  // Build ranked list
  const scored = submissions.map((s) => {
    const data = scoreBySid.get(s.submissionId);
    const aiScore =
      typeof data?.aiScore === "number" && data.aiScore >= 1 && data.aiScore <= 10
        ? data.aiScore
        : null;
    const judgeScores =
      data?.judgeScores && typeof data.judgeScores === "object"
        ? (data.judgeScores as Record<string, number>)
        : undefined;
    const peerVoteCount =
      typeof data?.peerVoteCount === "number" ? data.peerVoteCount : 0;
    const rawScore = computeHackASprint2026RawScore(aiScore, judgeScores);
    return { ...s, rawScore, peerVoteCount };
  });

  scored.sort((a, b) => {
    const ra = a.rawScore ?? -1;
    const rb = b.rawScore ?? -1;
    if (rb !== ra) return rb - ra;
    return (b.peerVoteCount ?? 0) - (a.peerVoteCount ?? 0);
  });

  // Resolve user IDs and emails from event signups + users collection
  console.log("Resolving user emails…");
  // Fetch all users in one batch for mapping github login → userId → email
  const userByGithubLogin = new Map<string, { uid: string; email: string | null; displayName: string | null }>();
  const userSnap = await db.collection("users").get();
  for (const doc of userSnap.docs) {
    const d = doc.data();
    const gh = d.github && typeof d.github === "object" ? (d.github as { login?: string }).login : undefined;
    if (typeof gh === "string" && gh.trim()) {
      userByGithubLogin.set(gh.trim().toLowerCase(), {
        uid: doc.id,
        email: typeof d.email === "string" ? d.email : null,
        displayName: typeof d.displayName === "string" ? d.displayName : null,
      });
    }
  }

  const entries: RankedEntry[] = scored.map((s, i) => {
    const rank = i + 1;
    const user = userByGithubLogin.get(s.submissionId);
    const creditUrl = rank <= creditUrls.length ? creditUrls[rank - 1]! : null;
    return {
      rank,
      submissionId: s.submissionId,
      githubLogin: s.githubLogin,
      title: s.payload.title,
      rawScore: s.rawScore,
      peerVoteCount: s.peerVoteCount,
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      displayName: user?.displayName ?? null,
      creditUrl,
      isPrizeWinner: rank <= PRIZE_POOL_SPOTS,
    };
  });

  // Print ranked table
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  console.log(`\n${pad("Rank", 6)} ${pad("Login", 25)} ${pad("Score", 7)} ${pad("Peer", 6)} ${pad("Email", 35)} Prize`);
  console.log("-".repeat(100));
  for (const e of entries) {
    console.log(
      `${pad(`#${e.rank}`, 6)} ${pad(e.githubLogin, 25)} ${pad(e.rawScore != null ? String(e.rawScore) : "—", 7)} ${pad(String(e.peerVoteCount), 6)} ${pad(e.email ?? "—", 35)} ${e.isPrizeWinner ? PRIZE_AMOUNT_TOP6 : e.rank <= CURSOR_CREDIT_TOP_N ? CREDIT_AMOUNT : "—"}`
    );
  }

  if (!creditsPath) {
    console.log(`\nRanked list exported. Use --credits <file.json> to pair with credit links.`);
    return;
  }

  if (creditUrls.length < entries.length) {
    console.warn(
      `\n[warn] Only ${creditUrls.length} credit link(s) for ${entries.length} submission(s). Some won't get links.`
    );
  }

  // Build and send emails
  const toSend = entries.filter((e) => e.email && e.creditUrl);
  const noEmail = entries.filter((e) => !e.email && e.creditUrl);

  if (noEmail.length > 0) {
    console.warn(`\n[warn] ${noEmail.length} ranked submission(s) have no email:`);
    for (const e of noEmail) {
      console.warn(`  #${e.rank} @${e.githubLogin} — no matching user email`);
    }
  }

  console.log(`\nWill send ${toSend.length} email(s).`);

  if (dryRun) {
    const sample = toSend[0];
    if (sample) {
      const { html } = buildCreditEmail(sample);
      console.log("\nSample email HTML:\n---\n" + html.slice(0, 600) + "\n---");
    }
    console.log("\n--dry-run: no emails sent.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const entry of toSend) {
    const { subject, html, text } = buildCreditEmail(entry);
    try {
      await sendEmail({ to: entry.email!, subject, html, text });
      sent++;
      console.log(`Sent: ${entry.email} (#${entry.rank} @${entry.githubLogin})`);
    } catch (e) {
      failed++;
      console.error(`Failed: ${entry.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

function buildCreditEmail(entry: RankedEntry): { subject: string; html: string; text: string } {
  const name = escapeHtml(entry.displayName || entry.githubLogin);
  const creditLink = escapeHtml(entry.creditUrl!);
  const resultsUrl = `${SITE_ORIGIN.replace(/\/$/, "")}/hackathons/hack-a-sprint-2026`;

  let subject: string;
  let body: string;

  if (entry.isPrizeWinner) {
    subject = `Hack-a-Sprint: Congratulations #${entry.rank} — ${PRIZE_AMOUNT_TOP6} prize + ${CREDIT_AMOUNT} Cursor credit`;
    body = `<p>Hi ${name},</p>
<p>Congratulations! You placed <strong>#${entry.rank}</strong> at the Cursor Boston Hack-a-Sprint with a score of <strong>${entry.rawScore ?? "—"}</strong> and <strong>${entry.peerVoteCount}</strong> peer vote${entry.peerVoteCount === 1 ? "" : "s"} for <strong>${escapeHtml(entry.title)}</strong>.</p>
<p>You've won <strong>${PRIZE_AMOUNT_TOP6}</strong> from the prize pool, plus <strong>${CREDIT_AMOUNT} in Cursor credits</strong>.</p>
<p><strong>Redeem your Cursor credit here:</strong><br/>
<a href="${creditLink}" style="display:inline-block;margin:8px 0;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${creditLink}</a></p>
<p>Full results: <a href="${escapeHtml(resultsUrl)}">${escapeHtml(resultsUrl)}</a></p>
<p>Thanks for building with us!</p>`;
  } else {
    subject = `Hack-a-Sprint: Your ${CREDIT_AMOUNT} Cursor credit — thanks for building!`;
    body = `<p>Hi ${name},</p>
<p>Thanks for participating in the Cursor Boston Hack-a-Sprint! You placed <strong>#${entry.rank}</strong> with <strong>${escapeHtml(entry.title)}</strong>.</p>
<p>As a selected participant, here's your <strong>${CREDIT_AMOUNT} Cursor credit</strong>:</p>
<p><a href="${creditLink}" style="display:inline-block;margin:8px 0;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${creditLink}</a></p>
<p>Full results: <a href="${escapeHtml(resultsUrl)}">${escapeHtml(resultsUrl)}</a></p>
<p>Thanks for building with us!</p>`;
  }

  const html = emailShell(body);
  const text = entry.isPrizeWinner
    ? `Congrats #${entry.rank}! ${PRIZE_AMOUNT_TOP6} prize + ${CREDIT_AMOUNT} Cursor credit: ${entry.creditUrl}\nResults: ${resultsUrl}`
    : `Thanks for building! #${entry.rank}. ${CREDIT_AMOUNT} Cursor credit: ${entry.creditUrl}\nResults: ${resultsUrl}`;

  return { subject, html, text };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
