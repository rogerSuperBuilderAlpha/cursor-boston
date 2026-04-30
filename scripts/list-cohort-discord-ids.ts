#!/usr/bin/env node
/**
 * List Summer Cohort applicants and (where available) their connected
 * Discord identity, so an admin can grant the new "Cohorts/S261" role
 * in the cursor-boston Discord server.
 *
 * Usage:
 *   npx tsx scripts/list-cohort-discord-ids.ts                # all cohorts, all statuses
 *   npx tsx scripts/list-cohort-discord-ids.ts --cohort=cohort-1
 *   npx tsx scripts/list-cohort-discord-ids.ts --status=admitted
 *   npx tsx scripts/list-cohort-discord-ids.ts --cohort=cohort-1 --status=admitted
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import {
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORTS,
  isValidCohortId,
  type SummerCohortId,
} from "../lib/summer-cohort";

type Status = "pending" | "admitted" | "rejected" | "waitlist";
const ALLOWED_STATUSES: ReadonlySet<Status> = new Set([
  "pending",
  "admitted",
  "rejected",
  "waitlist",
]);

interface Row {
  name: string;
  email: string;
  uid: string;
  cohorts: SummerCohortId[];
  status: Status;
  discordId: string | null;
  discordUsername: string | null;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main() {
  const args = process.argv.slice(2);
  const cohortArg = args.find((a) => a.startsWith("--cohort="));
  const cohortFilter: SummerCohortId | null = cohortArg
    ? (cohortArg.split("=")[1] as SummerCohortId)
    : null;
  if (cohortFilter && !isValidCohortId(cohortFilter)) {
    console.error(
      `Invalid --cohort value. Pick one of: ${SUMMER_COHORTS.map((c) => c.id).join(", ")}`
    );
    process.exit(1);
  }

  const statusArg = args.find((a) => a.startsWith("--status="));
  const statusFilter: Status | null = statusArg
    ? (statusArg.split("=")[1] as Status)
    : null;
  if (statusFilter && !ALLOWED_STATUSES.has(statusFilter)) {
    console.error(
      `Invalid --status value. Pick one of: ${Array.from(ALLOWED_STATUSES).join(", ")}`
    );
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS)."
    );
    process.exit(1);
  }

  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .orderBy("createdAt", "asc")
    .get();

  const rows: Row[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const cohorts = Array.isArray(data.cohorts)
      ? (data.cohorts.filter(isValidCohortId) as SummerCohortId[])
      : [];
    if (cohorts.length === 0) continue;
    if (cohortFilter && !cohorts.includes(cohortFilter)) continue;

    const status = ((data.status as string) || "pending") as Status;
    if (statusFilter && status !== statusFilter) continue;

    const uid = (data.userId || doc.id || "").toString();
    let discordId: string | null = null;
    let discordUsername: string | null = null;
    if (uid) {
      const userSnap = await db.collection("users").doc(uid).get();
      const discord = userSnap.data()?.discord as
        | { id?: string; username?: string }
        | undefined;
      if (discord?.id) discordId = discord.id;
      if (discord?.username) discordUsername = discord.username;
    }

    rows.push({
      name: typeof data.name === "string" ? data.name : "",
      email: typeof data.email === "string" ? data.email : "",
      uid,
      cohorts,
      status,
      discordId,
      discordUsername,
    });
  }

  const connected = rows.filter((r) => r.discordId);
  const missing = rows.filter((r) => !r.discordId);

  const filterLabel = cohortFilter
    ? `${cohortFilter} (${
        SUMMER_COHORTS.find((c) => c.id === cohortFilter)?.label ?? cohortFilter
      })`
    : "all cohorts";

  console.log(`Cohort:    ${filterLabel}`);
  console.log(`Status:    ${statusFilter ?? "(any)"}`);
  console.log(`Total:     ${rows.length}`);
  console.log(`Connected: ${connected.length}`);
  console.log(`Missing:   ${missing.length}\n`);

  console.log("=== CONNECTED (ready to receive the role) ===");
  if (connected.length === 0) {
    console.log("  (none)");
  } else {
    console.log(
      `  ${pad("NAME", 26)}  ${pad("EMAIL", 36)}  ${pad("STATUS", 9)}  ${pad("DISCORD", 24)}  DISCORD_ID`
    );
    for (const r of connected) {
      console.log(
        `  ${pad(r.name || "(no name)", 26)}  ${pad(r.email, 36)}  ${pad(r.status, 9)}  ${pad("@" + (r.discordUsername || ""), 24)}  ${r.discordId}`
      );
    }
  }

  console.log("\n=== NOT CONNECTED (need to connect Discord on /summer-cohort) ===");
  if (missing.length === 0) {
    console.log("  (none)");
  } else {
    console.log(`  ${pad("NAME", 26)}  ${pad("EMAIL", 36)}  STATUS`);
    for (const r of missing) {
      console.log(`  ${pad(r.name || "(no name)", 26)}  ${pad(r.email, 36)}  ${r.status}`);
    }
  }

  if (connected.length > 0) {
    console.log("\n=== Discord IDs only (one per line, copy/paste friendly) ===");
    for (const r of connected) console.log(r.discordId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
