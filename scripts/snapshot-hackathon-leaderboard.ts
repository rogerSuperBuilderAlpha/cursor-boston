#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-shot: recompute the leaderboard snapshot for an event and persist it to
 * `hackathonLeaderboardSnapshots/{eventId}`. The signup API GET reads this doc
 * directly; mutations (POST/PATCH/DELETE) refresh it inline. Use this script
 * to seed the doc for a new event or to force a refresh after manual Firestore
 * edits (e.g., after seed-luma-registrants or freeze-confirmed-top50 ran but
 * the snapshot is stale).
 *
 * Usage:
 *   npx tsx scripts/snapshot-hackathon-leaderboard.ts --event-id=sports-hack-2026
 *   npx tsx scripts/snapshot-hackathon-leaderboard.ts --event-id=sports-hack-2026 --dry-run
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON, GITHUB_TOKEN (for PR-count fan-out).
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import {
  buildLeaderboardPayload,
  refreshSnapshot,
} from "../lib/hackathon-leaderboard-snapshot";
import { isHackathonEventSignupId } from "../lib/hackathon-event-signup";
import { fetchMergedPrCountByAuthorForRepoUncached } from "../lib/github-merged-pr-count";

function getFlag(name: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.slice(`--${name}=`.length).trim();
}

async function main(): Promise<void> {
  const eventId = getFlag("event-id");
  const dryRun = process.argv.includes("--dry-run");
  if (!eventId) {
    console.error("Pass --event-id=<id>. Example: --event-id=sports-hack-2026");
    process.exit(1);
  }
  if (!isHackathonEventSignupId(eventId)) {
    console.error(`Unknown event id: ${eventId}`);
    process.exit(1);
  }

  // Pre-fetch the bulk merged-PR map directly (the cached lib variant uses
  // next/cache `unstable_cache`, which throws when called outside the Next.js
  // request lifecycle). Pass it down so the snapshot computation reuses it
  // instead of hitting the cached path.
  const bulkEntries = await fetchMergedPrCountByAuthorForRepoUncached();
  const preloadedBulkPrCounts = bulkEntries ? new Map(bulkEntries) : null;

  if (dryRun) {
    const payload = await buildLeaderboardPayload(eventId, { preloadedBulkPrCounts });
    console.log(
      `[dry-run] would persist snapshot for ${eventId}: ${payload.entries.length} entries, ` +
        `websiteSignupCount=${payload.websiteSignupCount}, creditTopN=${payload.creditTopN}`
    );
    return;
  }

  const snapshot = await refreshSnapshot(eventId, { preloadedBulkPrCounts });
  console.log(
    `Persisted snapshot for ${eventId}: ${snapshot.entries.length} entries, ` +
      `websiteSignupCount=${snapshot.websiteSignupCount}, creditTopN=${snapshot.creditTopN}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
