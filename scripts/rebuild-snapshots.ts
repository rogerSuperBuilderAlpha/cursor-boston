#!/usr/bin/env node
/**
 * Rebuild Firestore snapshots for analytics and public members (read-heavy scans).
 * Run locally or in CI with service account env configured:
 *
 *   npx tsx scripts/rebuild-snapshots.ts
 *   npx tsx scripts/rebuild-snapshots.ts --only=analytics
 *   npx tsx scripts/rebuild-snapshots.ts --only=members
 *
 * Or hit production (requires CRON_SECRET):
 *   curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://your-domain/api/internal/snapshots/rebuild"
 */

import { loadEnvConfig } from "@next/env";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  computeAnalyticsSummary,
  ANALYTICS_SNAPSHOT_CACHE_TTL_MS,
} from "@/lib/analytics-snapshot-compute";
import {
  computePublicMembersSnapshot,
  MEMBERS_SNAPSHOT_CACHE_TTL_MS,
} from "@/lib/members-public-snapshot";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg?.split("=")[1]?.toLowerCase();
  const runAnalytics = !only || only === "analytics" || only === "all";
  const runMembers = !only || only === "members" || only === "all";

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin is not configured (getAdminDb returned null).");
    process.exit(1);
  }

  if (runAnalytics) {
    console.log("Computing analytics summary…");
    const summary = await computeAnalyticsSummary(db);
    const expiresAt = new Date(Date.now() + ANALYTICS_SNAPSHOT_CACHE_TTL_MS);
    await db.collection("analytics_snapshots").doc("latest").set({
      summary,
      expiresAt,
      updatedAt: new Date(),
    });
    console.log("Wrote analytics_snapshots/latest", { totalMembers: summary.totalMembers, generatedAt: summary.generatedAt });
  }

  if (runMembers) {
    console.log("Computing public members snapshot…");
    const members = await computePublicMembersSnapshot(db);
    const expiresAt = new Date(Date.now() + MEMBERS_SNAPSHOT_CACHE_TTL_MS);
    await db.collection("members_snapshots").doc("latest").set({
      members,
      expiresAt,
      updatedAt: new Date(),
    });
    console.log("Wrote members_snapshots/latest", { count: members.length });
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
