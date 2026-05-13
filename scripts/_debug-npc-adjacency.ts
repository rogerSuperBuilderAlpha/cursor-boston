#!/usr/bin/env node
/**
 * Throwaway diagnostic: for every NPC tile, count neighbor ownership
 * buckets (self / other NPC / human / unowned / missing). Tells us
 * whether NPCs are geographically able to attack anyone at all.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import type { GamePlayer, GameTile } from "../lib/game/types";

async function main(): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("no db");

  const playersSnap = await db.collection("game_players").get();
  const isNpc = new Map<string, boolean>();
  const displayByUid = new Map<string, string>();
  for (const d of playersSnap.docs) {
    const p = d.data() as GamePlayer & { isNpc?: boolean };
    isNpc.set(d.id, p.isNpc === true);
    displayByUid.set(d.id, p.displayName ?? d.id.slice(0, 6));
  }

  const tilesSnap = await db.collection("game_tiles").get();
  const tilesById = new Map<string, GameTile>();
  for (const d of tilesSnap.docs) tilesById.set(d.id, d.data() as GameTile);

  let npcTileCount = 0;
  let npcMilitaryTileCount = 0;
  let neighborsSelf = 0;
  let neighborsOtherNpc = 0;
  let neighborsHuman = 0;
  let neighborsUnowned = 0;
  let neighborsMissing = 0;

  // Per-NPC: count military tiles with at least one other-NPC neighbor.
  const perNpc = new Map<
    string,
    { militaryTiles: number; militaryBorderingOtherNpc: number; sampleBorder?: string }
  >();

  for (const t of tilesById.values()) {
    if (!t.ownerId || !isNpc.get(t.ownerId)) continue;
    npcTileCount += 1;
    if (t.type !== "military") continue;
    npcMilitaryTileCount += 1;

    const stats = perNpc.get(t.ownerId) ?? {
      militaryTiles: 0,
      militaryBorderingOtherNpc: 0,
    };
    stats.militaryTiles += 1;

    let bordersOtherNpc = false;
    for (const nid of t.neighborTileIds ?? []) {
      const n = tilesById.get(nid);
      if (!n) {
        neighborsMissing += 1;
        continue;
      }
      if (!n.ownerId) {
        neighborsUnowned += 1;
        continue;
      }
      if (n.ownerId === t.ownerId) {
        neighborsSelf += 1;
        continue;
      }
      if (isNpc.get(n.ownerId)) {
        neighborsOtherNpc += 1;
        bordersOtherNpc = true;
        if (!stats.sampleBorder) {
          stats.sampleBorder = `${t.tileId}→${n.tileId} (${displayByUid.get(n.ownerId)})`;
        }
      } else {
        neighborsHuman += 1;
      }
    }
    if (bordersOtherNpc) stats.militaryBorderingOtherNpc += 1;
    perNpc.set(t.ownerId, stats);
  }

  console.log("=== NPC adjacency diagnostic ===");
  console.log(`NPC tiles total: ${npcTileCount}, military: ${npcMilitaryTileCount}`);
  console.log("Neighbor ownership buckets across all NPC-military tiles:");
  console.log(`  same owner (self): ${neighborsSelf}`);
  console.log(`  other NPC:         ${neighborsOtherNpc}`);
  console.log(`  human:             ${neighborsHuman}`);
  console.log(`  unowned:           ${neighborsUnowned}`);
  console.log(`  missing tile:      ${neighborsMissing}`);
  console.log();
  console.log("Per-NPC summary (any military tile bordering another NPC?):");
  let npcsWithBorders = 0;
  for (const [uid, s] of [...perNpc.entries()].sort()) {
    const flag = s.militaryBorderingOtherNpc > 0 ? "YES" : "no ";
    if (s.militaryBorderingOtherNpc > 0) npcsWithBorders += 1;
    console.log(
      `  [${flag}] ${(displayByUid.get(uid) ?? uid).padEnd(28)} ` +
        `mil=${s.militaryTiles} borderingOtherNpc=${s.militaryBorderingOtherNpc}` +
        (s.sampleBorder ? `  e.g. ${s.sampleBorder}` : "")
    );
  }
  console.log(`\nTotal NPCs with at least one NPC-vs-NPC military border: ${npcsWithBorders}/${perNpc.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
