import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getAdminDb } from "../lib/firebase-admin";
import { weekStartIsoForRollover } from "../lib/game/turns";

async function main() {
  const db = getAdminDb();
  if (!db) { console.error("Firebase Admin not configured."); process.exit(1); }
  const snap = await db.collection("game_players").get();
  const now = new Date();
  const currentWeekIso = weekStartIsoForRollover(now);
  const rows: Array<Record<string, unknown>> = [];
  let realTotal = 0;
  let grantedThisWeek = 0;
  let notGrantedThisWeek = 0;
  let neverGranted = 0;
  let stillStarting = 0;
  for (const doc of snap.docs) {
    const d = doc.data() as {
      isNpc?: boolean; displayName?: string; phase?: string;
      turnsRemaining?: number; turnsSpentTotal?: number;
      lastWeeklyGrantWeekStart?: string;
    };
    if (d.isNpc === true) continue;
    realTotal++;
    const granted = d.lastWeeklyGrantWeekStart === currentWeekIso;
    if (granted) grantedThisWeek++;
    else notGrantedThisWeek++;
    if (!d.lastWeeklyGrantWeekStart) neverGranted++;
    if ((d.turnsSpentTotal ?? 0) === 0 && (d.turnsRemaining ?? 0) === 300) stillStarting++;
    rows.push({
      name: d.displayName || "(unnamed)",
      phase: d.phase,
      remaining: d.turnsRemaining,
      spent: d.turnsSpentTotal,
      lastGrantWeek: d.lastWeeklyGrantWeekStart ?? null,
      grantedCurrentWeek: granted,
    });
  }
  rows.sort((a, b) => Number(b.remaining ?? 0) - Number(a.remaining ?? 0));
  console.log(JSON.stringify({
    currentWeekIso,
    realTotal,
    grantedThisWeek,
    notGrantedThisWeek,
    neverGranted,
    stillAtStartingBucket: stillStarting,
    rows,
  }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
