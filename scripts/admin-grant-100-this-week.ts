/**
 * One-shot: directly grant +100 turns to every real player for the current
 * week, bypassing the broken cron. Sets lastWeeklyGrantWeekStart so the
 * cron treats this week as already-granted (no double-grant if it later
 * fires).
 *
 * Idempotent: re-running for the same week is a no-op for already-granted
 * players.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { weekStartIsoForRollover } from "../lib/game/turns";

async function main() {
  const db = getAdminDb();
  if (!db) { console.error("no db"); process.exit(1); }
  const now = new Date();
  const wkStart = weekStartIsoForRollover(now);
  const snap = await db.collection("game_players").get();
  const results: Array<{ name: string; before: number; after: number }> = [];
  let skippedAlreadyGranted = 0;
  let grantedNpc = 0;
  for (const doc of snap.docs) {
    const d = doc.data() as {
      isNpc?: boolean;
      displayName?: string;
      turnsRemaining?: number;
      lastWeeklyGrantWeekStart?: string;
    };
    if (d.lastWeeklyGrantWeekStart === wkStart) { skippedAlreadyGranted++; continue; }
    if (d.isNpc === true) grantedNpc++;
    const before = d.turnsRemaining ?? 0;
    const after = before + 100;
    await db.collection("game_players").doc(doc.id).update({
      turnsRemaining: after,
      lastWeeklyGrantWeekStart: wkStart,
      lastWeeklyGrantAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    results.push({ name: d.displayName || "(unnamed)", before, after });
  }
  console.log(JSON.stringify({
    wkStart,
    granted: results.length,
    grantedNpc,
    skippedAlreadyGranted,
  }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
