#!/usr/bin/env node
/**
 * Send the "you're admitted!" email to every applicant whose application
 * is currently `status: "admitted"` and who hasn't been emailed yet
 * (no `admittanceEmailedAt` timestamp).
 *
 * Tracks `admittanceEmailedAt` so this script can be safely re-run after
 * adding more admits later — already-emailed people will be skipped.
 *
 * Usage:
 *   npx tsx scripts/send-cohort-admittance.ts --dry-run
 *   npx tsx scripts/send-cohort-admittance.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnv, escapeHtml, parseSendArgs } from "./_lib/script-utils";
loadEnv();

import { FieldValue } from "firebase-admin/firestore";
import { runEmailCampaign, type EmailContent } from "./_lib/campaign-runner";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import {
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORTS,
  isValidCohortId,
  type SummerCohortId,
} from "../lib/summer-cohort";

interface Admit {
  uid: string;
  name: string;
  email: string;
  cohorts: SummerCohortId[];
  hasDiscord: boolean;
}

const PAGE_URL = "https://cursorboston.com/summer-cohort";

function buildEmail(admit: Admit): EmailContent {
  const first = escapeHtml(admit.name?.split(" ")[0]?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(admit.email);
  const cohortLabels = admit.cohorts
    .map(
      (id) =>
        SUMMER_COHORTS.find((c) => c.id === id)?.label ?? id
    )
    .join(" and ");

  const inCohort1 = admit.cohorts.includes("cohort-1");
  const inCohort2 = admit.cohorts.includes("cohort-2");

  const subject = "You're in — Cursor Boston Summer Cohort";

  const discordBlock = admit.hasDiscord
    ? `<p>You've already connected Discord on the application page — we'll add you to the cohort channel before kickoff.</p>`
    : `<p style="margin-top:12px;padding:12px 16px;border-left:4px solid #f59e0b;background:#fffbeb;color:#78350f;">
  <strong>One thing left for you:</strong> head to <a href="${PAGE_URL}">${PAGE_URL}</a>
  and click <strong>Connect</strong> on Discord so we can add you to the cohort channel.
</p>`;

  const discordTextBlock = admit.hasDiscord
    ? `You've already connected Discord — we'll add you to the cohort channel before kickoff.`
    : `>>> ONE THING LEFT FOR YOU: Head to ${PAGE_URL} and click "Connect" on Discord so we can add you to the cohort channel.`;

  const kickoffLines: string[] = [];
  if (inCohort1) {
    kickoffLines.push(
      "<li><strong>Mon, May 11</strong> — Cohort 1 kickoff Zoom (link sent separately)</li>"
    );
  }
  if (inCohort1) {
    kickoffLines.push(
      "<li><strong>Tue, May 26</strong> — Hult / Cursor Boston in-person immersion event (Cohort 1 priority on the 80-person cap)</li>"
    );
  }
  if (inCohort2) {
    kickoffLines.push(
      "<li><strong>Mon, Jun 29</strong> — Cohort 2 kickoff Zoom (link sent separately)</li>"
    );
  }

  const kickoffText: string[] = [];
  if (inCohort1) {
    kickoffText.push(
      "  • Mon, May 11  — Cohort 1 kickoff Zoom (link sent separately)"
    );
    kickoffText.push(
      "  • Tue, May 26  — Hult / Cursor Boston in-person immersion event (Cohort 1 priority on the 80-person cap)"
    );
  }
  if (inCohort2) {
    kickoffText.push(
      "  • Mon, Jun 29  — Cohort 2 kickoff Zoom (link sent separately)"
    );
  }

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Great news — <strong>you're in the Cursor Boston Summer Cohort</strong>. You're admitted to <strong>${escapeHtml(cohortLabels || "the cohort")}</strong>.</p>

${discordBlock}

<p style="margin-top:20px;"><strong>What's next:</strong></p>
<ul style="margin:8px 0;padding-left:20px;">${kickoffLines.join("")}</ul>

<p style="margin-top:16px;">The full week-by-week program is on your application page so you can plan ahead:</p>

<p style="margin-top:12px;">
  <a href="${PAGE_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Open my application →</a>
</p>

<p style="margin-top:16px;">If you can no longer commit, please hit the <strong>Withdraw</strong> button on the page so we can free up your spot. You can re-apply if your situation changes.</p>

<p>Reply to this email with any questions.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you applied to the Cursor Boston Summer Cohort and were admitted.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${admit.name?.split(" ")[0]?.trim() || "there"},

Great news — YOU'RE IN THE CURSOR BOSTON SUMMER COHORT. You're admitted to ${cohortLabels || "the cohort"}.

${discordTextBlock}

WHAT'S NEXT
${kickoffText.join("\n")}

The full week-by-week program is on your application page so you can plan ahead:
${PAGE_URL}

If you can no longer commit, please hit the "Withdraw" button on the page so we can free up your spot. You can re-apply if your situation changes.

Reply to this email with any questions.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you applied to the Cursor Boston Summer Cohort and were admitted.
Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}

async function main() {
  const args = parseSendArgs();

  // Optional: restrict to a specific admit cohort by the `admittedVia` tag
  // (e.g. --admitted-via=bulk-cohort2-jun11) so a bulk send can target exactly
  // one admission batch and skip unrelated stragglers / test docs.
  const viaArg = process.argv
    .slice(2)
    .find((a) => a.startsWith("--admitted-via="));
  const admittedViaFilter = viaArg
    ? viaArg.slice("--admitted-via=".length).trim()
    : null;
  if (admittedViaFilter) {
    console.log(`Filtering to admittedVia === "${admittedViaFilter}"`);
  }

  await runEmailCampaign<Admit>({
    args,
    name: "Summer cohort admittance",
    getEmail: (a) => a.email,
    buildEmail,
    loadRecipients: async ({ db }) => {
      const snap = await db
        .collection(SUMMER_COHORT_COLLECTION)
        .where("status", "==", "admitted")
        .get();
      console.log(`Admitted applicants: ${snap.size}`);

      const queue: Admit[] = [];
      let alreadyEmailed = 0;
      let skippedVia = 0;
      for (const doc of snap.docs) {
        const data = doc.data();
        if (admittedViaFilter && data.admittedVia !== admittedViaFilter) {
          skippedVia++;
          continue;
        }
        if (!args.force && data.admittanceEmailedAt) {
          alreadyEmailed++;
          continue;
        }
        const email = (data.email || "").toString().trim();
        if (!email || !email.includes("@")) continue;
        if (args.onlyEmail && email.toLowerCase() !== args.onlyEmail) continue;
        const cohorts = (Array.isArray(data.cohorts) ? data.cohorts : []).filter(
          isValidCohortId
        ) as SummerCohortId[];
        if (cohorts.length === 0) continue;

        let hasDiscord = false;
        const uid = (data.userId || doc.id).toString();
        if (uid) {
          const userSnap = await db.collection("users").doc(uid).get();
          hasDiscord = Boolean(userSnap.data()?.discord?.id);
        }

        queue.push({
          uid,
          name: typeof data.name === "string" ? data.name : "",
          email,
          cohorts,
          hasDiscord,
        });
      }

      console.log(
        `To email now: ${queue.length} | Already emailed: ${alreadyEmailed}` +
          (admittedViaFilter ? ` | Skipped (other admittedVia): ${skippedVia}` : "")
      );
      return queue;
    },
    onSent: (a, { db }) =>
      db
        .collection(SUMMER_COHORT_COLLECTION)
        .doc(a.uid)
        .set({ admittanceEmailedAt: FieldValue.serverTimestamp() }, { merge: true }),
    progressEvery: 10,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
