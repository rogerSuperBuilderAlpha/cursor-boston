/**
 * Counts game_players by audience (real humans vs NPCs) and phase.
 * Usage: npx tsx scripts/count-game-players.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getAdminDb } from "../lib/firebase-admin";

async function main() {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }
  const snap = await db.collection("game_players").get();
  let total = 0;
  let npc = 0;
  let real = 0;
  const realByPhase: Record<string, number> = {};
  const realCasteSet: Record<string, number> = {};
  let realInPlay = 0;
  let realWithCaste = 0;
  let realWithTiles = 0;
  for (const doc of snap.docs) {
    total++;
    const d = doc.data() as { isNpc?: boolean; phase?: string; caste?: string | null; stats?: { tilesHeld?: number } };
    if (d.isNpc === true) {
      npc++;
      continue;
    }
    real++;
    const phase = d.phase ?? "<missing>";
    realByPhase[phase] = (realByPhase[phase] ?? 0) + 1;
    if (phase === "play") realInPlay++;
    if (d.caste != null) {
      realWithCaste++;
      const c = d.caste;
      realCasteSet[c] = (realCasteSet[c] ?? 0) + 1;
    }
    if ((d.stats?.tilesHeld ?? 0) > 0) realWithTiles++;
  }
  console.log(
    JSON.stringify(
      {
        total,
        npc,
        real,
        realInPlay,
        realWithCaste,
        realWithTiles,
        realByPhase,
        realCasteSet,
      },
      null,
      2
    )
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
