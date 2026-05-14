#!/usr/bin/env node
/**
 * Re-pull with corrected field names: COMMUNITY_EVENTS, COMMUNITY_MESSAGES,
 * player.updatedAt, snapshot.generatedAt.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("missing");
  const credentials = JSON.parse(json);
  if (!getApps().length) {
    initializeApp({ credential: cert(credentials), projectId: credentials.project_id });
  }
  const db = getFirestore();
  const TEN_DAYS_AGO = Timestamp.fromDate(new Date(Date.now() - 10 * 86400 * 1000));

  const out: Record<string, unknown> = {};

  // Correct collection names
  const correctCollections = [
    "game_community_events",
    "game_community_messages",
    "game_world_meta",
    "game_artifacts",
    "communityMessages",
    "communityQuestions",
    "luma_registrants",
    "summer_cohort",
    "summerCohortApplications",
    "mentorshipProfiles",
    "mentorshipMatches",
  ];
  out.collectionCounts = {};
  for (const c of correctCollections) {
    try {
      const snap = await db.collection(c).count().get();
      (out.collectionCounts as Record<string, number | string>)[c] = snap.data().count;
      console.log(`  ${c}: ${snap.data().count}`);
    } catch (e: unknown) {
      (out.collectionCounts as Record<string, number | string>)[c] =
        `error: ${(e as Error).message.slice(0, 80)}`;
    }
  }

  // Recent
  const recent: Record<string, number | string> = {};
  const targets = [
    { coll: "game_community_events", field: "createdAt" },
    { coll: "game_community_messages", field: "createdAt" },
    { coll: "game_players", field: "updatedAt" },
    { coll: "game_attacks", field: "createdAt" },
    { coll: "game_tiles", field: "lastAttackedAt" },
    { coll: "communityMessages", field: "createdAt" },
    { coll: "communityQuestions", field: "createdAt" },
  ];
  for (const t of targets) {
    try {
      const q = await db.collection(t.coll).where(t.field, ">=", TEN_DAYS_AGO).count().get();
      recent[`${t.coll}.${t.field}`] = q.data().count;
      console.log(`  recent ${t.coll}.${t.field}: ${q.data().count}`);
    } catch (e: unknown) {
      recent[`${t.coll}.${t.field}`] = `error: ${(e as Error).message.slice(0, 100)}`;
    }
  }
  out.recentActivity = recent;

  // Snapshot specifics
  try {
    const snaps = await db.collection("game_world_snapshots").get();
    out.snapshots = snaps.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        generatedAt: (data.generatedAt as Timestamp | undefined)?.toDate?.()?.toISOString() ?? null,
        tileCount: Array.isArray(data.tiles) ? data.tiles.length : null,
        ownerCount: Array.isArray(data.owners) ? data.owners.length : null,
        sizeBytesEstimate: JSON.stringify(data).length,
        keys: Object.keys(data).slice(0, 20),
      };
    });
    console.log(`snapshots: ${snaps.size}`);
  } catch (e: unknown) {
    out.snapshots = `error: ${(e as Error).message.slice(0, 200)}`;
  }

  // Active players (any updatedAt in last 10d)
  try {
    const q = await db
      .collection("game_players")
      .where("updatedAt", ">=", TEN_DAYS_AGO)
      .count()
      .get();
    out.activePlayers10d = q.data().count;
    console.log(`activePlayers10d: ${q.data().count}`);
  } catch (e: unknown) {
    out.activePlayers10d = `error: ${(e as Error).message.slice(0, 100)}`;
  }

  // Players who actually spent turns (turnsSpentTotal > 0)
  try {
    const q = await db
      .collection("game_players")
      .where("turnsSpentTotal", ">", 0)
      .count()
      .get();
    out.playersWhoSpentATurn = q.data().count;
    console.log(`playersWhoSpentATurn: ${q.data().count}`);
  } catch (e: unknown) {
    out.playersWhoSpentATurn = `error: ${(e as Error).message.slice(0, 100)}`;
  }

  // Caste distribution
  try {
    const players = await db.collection("game_players").get();
    const byCaste: Record<string, number> = {};
    let totalTurnsSpent = 0;
    let zeroTurns = 0;
    for (const p of players.docs) {
      const d = p.data();
      const c = d.caste ?? "(none)";
      byCaste[c] = (byCaste[c] || 0) + 1;
      totalTurnsSpent += d.turnsSpentTotal ?? 0;
      if (!d.turnsSpentTotal) zeroTurns++;
    }
    out.playerStats = { totalPlayers: players.size, byCaste, totalTurnsSpent, zeroTurns };
    console.log(`playerStats:`, out.playerStats);
  } catch (e: unknown) {
    out.playerStats = `error: ${(e as Error).message.slice(0, 100)}`;
  }

  const outPath = path.join(process.cwd(), "scripts/data/analysis-2026-05-12/usage-fixed.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
