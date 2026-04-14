#!/usr/bin/env node
/**
 * Sync Hack-a-Sprint 2026 showcase winner ribbons to Firebase user profiles
 * (`hackASprint2026ShowcaseAwards`), using the same rules as the public gallery.
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS,
 * plus GitHub/API env used by fetchShowcaseSubmissionsFromGitHub.
 *
 * Usage:
 *   npx tsx scripts/sync-hack-a-sprint-showcase-awards-to-profiles.ts
 *   npx tsx scripts/sync-hack-a-sprint-showcase-awards-to-profiles.ts --apply
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { syncHackASprint2026ShowcaseAwardsToUserProfiles } from "../lib/hackathon-asprint-2026-award-profile-sync";

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getAdminDb();
  if (!db) {
    console.error(
      "No admin DB. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS."
    );
    process.exit(1);
  }

  const { written, missingUser, lines } =
    await syncHackASprint2026ShowcaseAwardsToUserProfiles(db, { dryRun: !apply });

  for (const line of lines) {
    console.log(line);
  }
  console.log(
    apply
      ? `Applied: ${written} profiles updated, ${missingUser} submissions with no linked user.`
      : `Dry run: would touch ${written} profiles; ${missingUser} unlinked. Re-run with --apply.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
