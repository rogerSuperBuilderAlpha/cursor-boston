#!/usr/bin/env node
/**
 * Pull user counts, recent signups, and game-collection sizes from Firestore.
 * One-shot — writes JSON to scripts/data/analysis-2026-05-12/.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("missing FIREBASE_SERVICE_ACCOUNT_JSON");
  const credentials = JSON.parse(json);
  if (!getApps().length) {
    initializeApp({ credential: cert(credentials), projectId: credentials.project_id });
  }
  const db = getFirestore();
  const auth = getAuth();

  const out: Record<string, unknown> = {};

  // ---- Auth users: total + last 10d ----
  const TEN_DAYS_AGO_MS = Date.now() - 10 * 86400 * 1000;
  let totalUsers = 0;
  let newUsers10d = 0;
  let activeUsers10d = 0;
  let nextPageToken: string | undefined;
  const newUsersByDay: Record<string, number> = {};
  const activeUsersByDay: Record<string, number> = {};
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const u of page.users) {
      totalUsers++;
      const created = u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : 0;
      const lastSignIn = u.metadata.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : 0;
      if (created >= TEN_DAYS_AGO_MS) {
        newUsers10d++;
        const day = new Date(created).toISOString().slice(0, 10);
        newUsersByDay[day] = (newUsersByDay[day] || 0) + 1;
      }
      if (lastSignIn >= TEN_DAYS_AGO_MS) {
        activeUsers10d++;
        const day = new Date(lastSignIn).toISOString().slice(0, 10);
        activeUsersByDay[day] = (activeUsersByDay[day] || 0) + 1;
      }
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  out.auth = { totalUsers, newUsers10d, activeUsers10d, newUsersByDay, activeUsersByDay };
  console.log(`auth: total=${totalUsers} new10d=${newUsers10d} active10d=${activeUsers10d}`);

  // ---- Game collection sizes ----
  const collections = [
    "game_players",
    "game_tiles",
    "game_world_snapshots",
    "game_attacks",
    "game_intel_effects",
    "game_recruits",
    "game_far_expeditions",
    "game_chat_messages",
    "game_community_feed",
    "summer_cohort_applications",
    "cohort_1_members",
    "mentorship_requests",
    "users",
  ];
  const collSizes: Record<string, number | string> = {};
  for (const c of collections) {
    try {
      const snap = await db.collection(c).count().get();
      collSizes[c] = snap.data().count;
      console.log(`  ${c}: ${snap.data().count}`);
    } catch (e: unknown) {
      collSizes[c] = `error: ${(e as Error).message.slice(0, 80)}`;
    }
  }
  out.collectionCounts = collSizes;

  // ---- Recent game activity (created/updated in last 10d) ----
  const cutoff = Timestamp.fromDate(new Date(TEN_DAYS_AGO_MS));
  const recent: Record<string, number | string> = {};
  const recentTargets: Array<{ coll: string; field: string }> = [
    { coll: "game_attacks", field: "createdAt" },
    { coll: "game_recruits", field: "createdAt" },
    { coll: "game_far_expeditions", field: "createdAt" },
    { coll: "game_chat_messages", field: "createdAt" },
    { coll: "game_community_feed", field: "createdAt" },
    { coll: "game_players", field: "lastTurnAt" },
    { coll: "game_players", field: "createdAt" },
    { coll: "summer_cohort_applications", field: "createdAt" },
  ];
  for (const t of recentTargets) {
    try {
      const q = await db.collection(t.coll).where(t.field, ">=", cutoff).count().get();
      recent[`${t.coll}.${t.field}`] = q.data().count;
      console.log(`  recent ${t.coll}.${t.field}: ${q.data().count}`);
    } catch (e: unknown) {
      recent[`${t.coll}.${t.field}`] = `error: ${(e as Error).message.slice(0, 80)}`;
    }
  }
  out.recentActivity = recent;

  // ---- World snapshot specifics: count + most recent ----
  try {
    const snaps = await db
      .collection("game_world_snapshots")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    out.recentSnapshots = snaps.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        createdAt: (data.createdAt as Timestamp | undefined)?.toDate().toISOString(),
        tileCount: Array.isArray(data.tiles) ? data.tiles.length : data.tileCount ?? "n/a",
        version: data.version ?? null,
        sizeBytesEstimate: JSON.stringify(data).length,
      };
    });
    console.log(`recentSnapshots: ${snaps.size}`);
  } catch (e: unknown) {
    out.recentSnapshots = { error: (e as Error).message.slice(0, 200) };
  }

  // ---- Active game players (with lastTurnAt in last 10d) ----
  try {
    const q = await db
      .collection("game_players")
      .where("lastTurnAt", ">=", cutoff)
      .get();
    out.activeGamePlayers10d = q.size;
    console.log(`activeGamePlayers10d: ${q.size}`);
  } catch (e: unknown) {
    out.activeGamePlayers10d = `error: ${(e as Error).message.slice(0, 80)}`;
  }

  const outPath = path.join(process.cwd(), "scripts/data/analysis-2026-05-12/usage.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
