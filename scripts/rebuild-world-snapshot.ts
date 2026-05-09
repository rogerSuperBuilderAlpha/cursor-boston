#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Force-rebuilds `game_world_snapshots/latest` once. Bypasses the cron
 * route's CRON_SECRET check by calling the server function directly via
 * Firebase Admin (service-account auth). Useful for:
 *
 *   - Recovering when the cron has been failing (e.g., missing
 *     CRON_SECRET in the Vercel env) and the snapshot has gone stale.
 *   - Smoke-testing snapshot shape changes after a backend deploy
 *     without waiting for the next 5-min cron tick.
 *
 * Usage:
 *   npx tsx scripts/rebuild-world-snapshot.ts
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { rebuildWorldSnapshotServer } from "../lib/game/world-snapshot";

async function main() {
  console.log("Forcing world-snapshot rebuild…");
  const result = await rebuildWorldSnapshotServer(new Date(), { force: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
