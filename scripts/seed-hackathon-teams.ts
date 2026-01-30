#!/usr/bin/env node
/**
 * Seed mock hackathon teams and pool for the current virtual month.
 * Creates 2 teams: one full (3/3), one with 1 open spot (2/3).
 * Per our logic, a 1-person "team" would not exist—that person would be in the pool,
 * so we add one mock pool user with a profile instead of a solo team.
 *
 * Usage: npx tsx scripts/seed-hackathon-teams.ts
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getCurrentVirtualHackathonId } from "../lib/hackathons";
import { getAdminDb } from "../lib/firebase-admin";

const MOCK_PREFIX = "mock-member-";
const MOCK_POOL_USER_ID = "mock-pool-user-1";

const MOCK_POOL_PROFILE = {
  displayName: "Jordan Lee",
  photoURL: null as string | null,
  discord: { username: "jordan_lee" },
  github: { login: "jordanlee-dev" },
  visibility: { isPublic: true },
};

async function main() {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }

  const hackathonId = getCurrentVirtualHackathonId();
  console.log("Seeding mock teams and pool for hackathon:", hackathonId);

  const teamsRef = db.collection("hackathonTeams");
  const existingTeams = await teamsRef.where("hackathonId", "==", hackathonId).get();
  for (const d of existingTeams.docs) {
    const memberIds = (d.data().memberIds || []) as string[];
    if (memberIds.length === 1) {
      await d.ref.delete();
      console.log("Removed 1-person team (per our logic they belong in the pool):", d.id);
    }
  }

  const teams = [
    { name: "Full Stack Crew", memberIds: [MOCK_PREFIX + "1", MOCK_PREFIX + "2", MOCK_PREFIX + "3"], wins: 1 },
    { name: "Open Slot Squad", memberIds: [MOCK_PREFIX + "4", MOCK_PREFIX + "5"], wins: 1 },
  ];

  for (const team of teams) {
    const docRef = await teamsRef.add({
      hackathonId,
      memberIds: team.memberIds,
      name: team.name,
      createdBy: team.memberIds[0],
      createdAt: FieldValue.serverTimestamp(),
      wins: team.wins ?? 0,
    });
    console.log("Created team:", team.name, "id:", docRef.id, "members:", team.memberIds.length + "/3", "wins:", team.wins ?? 0);
  }

  const usersRef = db.collection("users");
  await usersRef.doc(MOCK_POOL_USER_ID).set(
    {
      displayName: MOCK_POOL_PROFILE.displayName,
      photoURL: MOCK_POOL_PROFILE.photoURL,
      discord: MOCK_POOL_PROFILE.discord,
      github: MOCK_POOL_PROFILE.github,
      visibility: MOCK_POOL_PROFILE.visibility,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log("Created mock pool user:", MOCK_POOL_PROFILE.displayName, "id:", MOCK_POOL_USER_ID);

  const poolRef = db.collection("hackathonPool");
  const poolDocId = `${MOCK_POOL_USER_ID}_${hackathonId}`;
  await poolRef.doc(poolDocId).set({
    userId: MOCK_POOL_USER_ID,
    hackathonId,
    joinedAt: FieldValue.serverTimestamp(),
  });
  console.log("Added mock user to pool:", poolDocId);

  console.log("Done. View teams at /hackathons/teams and pool at /hackathons/pool");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
