#!/usr/bin/env node
/**
 * Throwaway: list every NPC's current turnsRemaining, sorted descending.
 * Answers "have they all spent their turns?" without inferring from logs.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import type { GamePlayer } from "../lib/game/types";

async function main(): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("no db");
  const snap = await db
    .collection("game_players")
    .where("isNpc", "==", true)
    .get();

  const rows = snap.docs.map((d) => {
    const p = d.data() as GamePlayer;
    return {
      name: p.displayName ?? d.id.slice(0, 6),
      caste: p.caste ?? "—",
      turns: p.turnsRemaining ?? 0,
      tiles: p.stats?.tilesHeld ?? 0,
      unitsAlive: p.stats?.unitsAlive ?? 0,
    };
  });
  rows.sort((a, b) => b.turns - a.turns);

  const total = rows.reduce((s, r) => s + r.turns, 0);
  const buckets = {
    over100: rows.filter((r) => r.turns > 100).length,
    "50-100": rows.filter((r) => r.turns >= 50 && r.turns <= 100).length,
    "10-49": rows.filter((r) => r.turns >= 10 && r.turns < 50).length,
    under10: rows.filter((r) => r.turns < 10).length,
  };

  console.log(`=== NPC turnsRemaining (${rows.length} NPCs) ===`);
  for (const r of rows) {
    console.log(
      `  ${String(r.turns).padStart(4)}t  ${r.name.padEnd(28)} caste=${r.caste.padEnd(6)} tiles=${String(r.tiles).padStart(4)} units=${String(r.unitsAlive).padStart(4)}`
    );
  }
  console.log(`\nTotal turns banked across NPCs: ${total}`);
  console.log(
    `Buckets — >100: ${buckets.over100}, 50–100: ${buckets["50-100"]}, 10–49: ${buckets["10-49"]}, <10: ${buckets.under10}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
