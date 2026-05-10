/**
 * One-shot: roll back the admin pre-grant on NPCs (so the gate in
 * runNpcWeeklyServer doesn't skip them), then run the NPC weekly behavior
 * for the current week. Net effect on NPC turns is identical to the cron
 * having run normally; they'll get +100 and then spend most of it.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { runNpcWeeklyServer } from "../lib/game/npc-weekly";
import { weekStartIsoForRollover } from "../lib/game/turns";

async function main() {
  const db = getAdminDb();
  if (!db) { console.error("no db"); process.exit(1); }
  const wkStart = weekStartIsoForRollover(new Date());
  const snap = await db.collection("game_players").get();
  let rolledBack = 0;
  for (const doc of snap.docs) {
    const d = doc.data() as {
      isNpc?: boolean;
      turnsRemaining?: number;
      lastWeeklyGrantWeekStart?: string;
    };
    if (d.isNpc !== true) continue;
    if (d.lastWeeklyGrantWeekStart !== wkStart) continue;
    await db.collection("game_players").doc(doc.id).update({
      turnsRemaining: Math.max(0, (d.turnsRemaining ?? 0) - 100),
      lastWeeklyGrantWeekStart: FieldValue.delete(),
      lastWeeklyGrantAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    rolledBack++;
  }
  console.log(`Rolled back admin pre-grant on ${rolledBack} NPCs.`);

  console.log("Running NPC weekly behavior...");
  const summary = await runNpcWeeklyServer({});
  console.log(JSON.stringify({
    weekStartIso: summary.weekStartIso,
    scanned: summary.scanned,
    granted: summary.granted,
    skippedAlreadyGranted: summary.skippedAlreadyGranted,
    totals: summary.totals,
  }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
