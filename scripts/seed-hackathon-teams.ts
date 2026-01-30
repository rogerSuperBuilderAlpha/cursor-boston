#!/usr/bin/env node
/**
 * Seed mock hackathon teams for the current virtual month.
 * Creates 3 teams: one full (3/3), one with 1 open spot (2/3), one with 2 open spots (1/3).
 * Uses placeholder member IDs so any user can "Request to join" the teams with open slots.
 *
 * Usage: npx tsx scripts/seed-hackathon-teams.ts
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getCurrentVirtualHackathonId } from "../lib/hackathons";
import { getAdminDb } from "../lib/firebase-admin";

const MOCK_PREFIX = "mock-member-";

async function main() {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }

  const hackathonId = getCurrentVirtualHackathonId();
  console.log("Seeding mock teams for hackathon:", hackathonId);

  const teamsRef = db.collection("hackathonTeams");

  const teams = [
    { name: "Full Stack Crew", memberIds: [MOCK_PREFIX + "1", MOCK_PREFIX + "2", MOCK_PREFIX + "3"] },
    { name: "Open Slot Squad", memberIds: [MOCK_PREFIX + "4", MOCK_PREFIX + "5"] },
    { name: "Solo Starter", memberIds: [MOCK_PREFIX + "6"] },
  ];

  for (const team of teams) {
    const docRef = await teamsRef.add({
      hackathonId,
      memberIds: team.memberIds,
      name: team.name,
      createdBy: team.memberIds[0],
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log("Created team:", team.name, "id:", docRef.id, "members:", team.memberIds.length + "/3");
  }

  console.log("Done. View teams at /hackathons/teams");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
