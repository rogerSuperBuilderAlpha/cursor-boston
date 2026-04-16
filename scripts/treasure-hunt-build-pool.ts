#!/usr/bin/env node
/**
 * Build the treasure-hunt prize pool.
 *
 * Selects hack-a-sprint-2026 credit codes that were:
 *   - never emailed to their original assignee (no hackASprint2026CreditEmailSentAt
 *     on the assignee's users doc)
 *   - still "active" on Cursor's referral API
 *
 * Writes survivors to the `treasureHuntPrizes` collection, keyed by referral code.
 *
 * Usage:
 *   npx tsx scripts/treasure-hunt-build-pool.ts --dry-run
 *   npx tsx scripts/treasure-hunt-build-pool.ts --write
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match && !process.env[match[1]]) {
      const value = match[2].replace(/^["']|["']$/g, "").trim();
      process.env[match[1]] = value;
    }
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";

const REFERRAL_REGEX = /https?:\/\/cursor\.com\/referral\?code=([A-Z0-9]+)/i;
const CHECK_ENDPOINT = "https://cursor.com/api/dashboard/check-referral-code";
const CHECK_DELAY_MS = 500;

type ReferralStatus = "active" | "redeemed" | "unknown";

async function checkReferral(code: string, retries = 3): Promise<ReferralStatus> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, CHECK_DELAY_MS * attempt));
      const res = await fetch(CHECK_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "*/*",
          "content-type": "application/json",
          origin: "https://cursor.com",
          referer: `https://cursor.com/referral?code=${code}`,
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({ referralCode: code }),
      });
      if (res.status === 200) {
        const json = (await res.json()) as Record<string, unknown>;
        if (json && typeof json === "object" && "isValid" in json) {
          const v = json as { isValid: boolean; userIsEligible?: boolean };
          return v.isValid && v.userIsEligible ? "active" : "redeemed";
        }
        if (json && Object.keys(json).length === 0) return "redeemed";
        const title = (json as { metadata?: { title?: string } })?.metadata?.title?.toLowerCase() ?? "";
        if (title.includes("already been used") || title.includes("expired")) return "redeemed";
        return "unknown";
      }
      if (res.status === 500 && attempt < retries - 1) continue;
      return "unknown";
    } catch {
      if (attempt < retries - 1) continue;
      return "unknown";
    }
  }
  return "unknown";
}

async function findUserByEmail(db: FirebaseFirestore.Firestore, email: string) {
  const lower = email.trim().toLowerCase();
  const snap = await db.collection("users").where("email", "==", lower).limit(1).get();
  if (!snap.empty) return snap.docs[0]!;
  const snap2 = await db.collection("users").where("email", "==", email).limit(1).get();
  return snap2.empty ? null : snap2.docs[0]!;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const write = process.argv.includes("--write");
  if (!dryRun && !write) {
    console.error("Specify --dry-run or --write");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const codesSnap = await db
    .collection("hackathonCreditCodes")
    .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
    .get();

  console.log(`Found ${codesSnap.size} code docs for ${HACK_A_SPRINT_2026_EVENT_ID}.`);

  type Candidate = {
    code: string;
    creditUrl: string;
    assignedToEmail: string;
    assignedToName?: string;
    role?: string;
    assigneeUid?: string;
    emailSent: boolean;
  };

  const candidates: Candidate[] = [];
  for (const doc of codesSnap.docs) {
    const d = doc.data();
    const url = typeof d.creditUrl === "string" ? d.creditUrl : "";
    if (!url || url.includes("PLACEHOLDER")) continue;
    const match = url.match(REFERRAL_REGEX);
    if (!match) continue;
    const code = match[1]!.toUpperCase();
    const email = typeof d.assignedToEmail === "string" ? d.assignedToEmail : "";
    if (!email) {
      candidates.push({
        code,
        creditUrl: url,
        assignedToEmail: "",
        emailSent: false,
      });
      continue;
    }
    const userDoc = await findUserByEmail(db, email);
    const emailSent = Boolean(userDoc?.data()?.hackASprint2026CreditEmailSentAt);
    candidates.push({
      code,
      creditUrl: url,
      assignedToEmail: email,
      assignedToName: typeof d.assignedToName === "string" ? d.assignedToName : undefined,
      role: typeof d.role === "string" ? d.role : undefined,
      assigneeUid: userDoc?.id,
      emailSent,
    });
  }

  const neverEmailed = candidates.filter((c) => !c.emailSent);
  console.log(
    `${candidates.length} real codes, ${candidates.length - neverEmailed.length} already emailed, ${neverEmailed.length} never emailed.`
  );

  console.log(`\nVerifying ${neverEmailed.length} never-emailed codes against Cursor's referral API...`);
  const verified: Array<Candidate & { status: ReferralStatus }> = [];
  for (let i = 0; i < neverEmailed.length; i++) {
    const c = neverEmailed[i]!;
    const status = await checkReferral(c.code);
    console.log(`  [${i + 1}/${neverEmailed.length}] ${c.code} → ${status}`);
    verified.push({ ...c, status });
    if (i < neverEmailed.length - 1) await new Promise((r) => setTimeout(r, CHECK_DELAY_MS));
  }

  const pool = verified.filter((v) => v.status === "active");
  const skippedRedeemed = verified.filter((v) => v.status === "redeemed");
  const skippedUnknown = verified.filter((v) => v.status === "unknown");

  console.log(
    `\nPool: ${pool.length} active | ${skippedRedeemed.length} already redeemed | ${skippedUnknown.length} unknown (skipped)`
  );

  if (dryRun) {
    console.log("\n--dry-run: no Firestore writes. Pool would contain:");
    for (const p of pool) {
      console.log(`  ${p.code}  (originally → ${p.assignedToEmail || "<unassigned>"})`);
    }
    return;
  }

  const batch = db.batch();
  const col = db.collection("treasureHuntPrizes");
  for (const p of pool) {
    batch.set(col.doc(p.code), {
      code: p.code,
      creditUrl: p.creditUrl,
      originalAssignee: {
        email: p.assignedToEmail || null,
        name: p.assignedToName || null,
        uid: p.assigneeUid || null,
        role: p.role || null,
      },
      status: "available",
      claimedByUid: null,
      claimedByEmail: null,
      claimedPath: null,
      claimedAt: null,
      emailSentAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`\nWrote ${pool.length} prize docs to treasureHuntPrizes.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
