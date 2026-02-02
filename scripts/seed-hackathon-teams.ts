#!/usr/bin/env node
/**
 * Seed mock hackathon teams and pool for the current virtual month.
 * Deletes existing teams, pool entries, and submissions for this hackathon first
 * so re-running the script does not create duplicates.
 * Creates 2 teams: one full (3/3), one with 1 open spot (2/3).
 * Per our logic, a 1-person "team" would not exist—that person would be in the pool,
 * so we add one mock pool user with a profile instead of a solo team.
 *
 * Usage: npx tsx scripts/seed-hackathon-teams.ts
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getCurrentVirtualHackathonId, getMonthEndFromVirtualId } from "../lib/hackathons";
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

const MOCK_PROFILE_PREFIX = "mock-profile-";
const MOCK_MEMBER_PROFILES: Array<{ displayName: string; bio?: string; location?: string; company?: string; jobTitle?: string }> = [
  { displayName: "Alex Chen", bio: "Building with Cursor in Boston.", location: "Boston, MA", company: "TechCo", jobTitle: "Software Engineer" },
  { displayName: "Sam Rivera", bio: "Designer and developer.", location: "Cambridge, MA", company: "StartupXYZ", jobTitle: "Full Stack Dev" },
  { displayName: "Jordan Lee", bio: "Hackathon enthusiast.", location: "Boston, MA", company: "DevShop", jobTitle: "Engineer" },
  { displayName: "Morgan Taylor", bio: "AI and tooling.", location: "Somerville, MA", company: "AI Labs", jobTitle: "ML Engineer" },
  { displayName: "Casey Kim", bio: "Cursor community member.", location: "Boston, MA", company: "Cursor Boston", jobTitle: "Developer" },
  { displayName: "Riley Davis", bio: "Love building in the open.", location: "Cambridge, MA", company: "Open Source Co", jobTitle: "Engineer" },
  { displayName: "Jamie Park", bio: "Product and code.", location: "Boston, MA", company: "ProductCo", jobTitle: "Product Engineer" },
  { displayName: "Quinn Adams", bio: "Building the future with Cursor.", location: "Boston, MA", company: "FutureTech", jobTitle: "Software Dev" },
  { displayName: "Skyler Brown", bio: "Community and code.", location: "Cambridge, MA", company: "Community Co", jobTitle: "Developer" },
  { displayName: "Drew Wilson", bio: "Cursor Boston regular.", location: "Boston, MA", company: "Boston Dev", jobTitle: "Engineer" },
];

async function main() {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }

  const hackathonId = getCurrentVirtualHackathonId();
  console.log("Seeding mock teams and pool for hackathon:", hackathonId);

  const teamsRef = db.collection("hackathonTeams");
  const poolRef = db.collection("hackathonPool");
  const submissionsRef = db.collection("hackathonSubmissions");
  const invitesRef = db.collection("hackathonInvites");
  const joinRequestsRef = db.collection("hackathonJoinRequests");

  // --- Delete existing data for this hackathon so re-runs don't duplicate ---
  const existingTeams = await teamsRef.where("hackathonId", "==", hackathonId).get();
  const teamIds = existingTeams.docs.map((d) => d.id);

  const subSnap = await submissionsRef.where("hackathonId", "==", hackathonId).get();
  for (const d of subSnap.docs) {
    await d.ref.delete();
  }
  if (subSnap.size > 0) console.log("Deleted", subSnap.size, "submission(s)");

  for (const teamId of teamIds) {
    const invSnap = await invitesRef.where("teamId", "==", teamId).get();
    for (const d of invSnap.docs) await d.ref.delete();
    const reqSnap = await joinRequestsRef.where("teamId", "==", teamId).get();
    for (const d of reqSnap.docs) await d.ref.delete();
  }
  if (teamIds.length > 0) console.log("Deleted invites/requests for", teamIds.length, "team(s)");

  for (const d of existingTeams.docs) {
    await d.ref.delete();
  }
  if (existingTeams.size > 0) console.log("Deleted", existingTeams.size, "team(s)");

  const poolSnap = await poolRef.where("hackathonId", "==", hackathonId).get();
  for (const d of poolSnap.docs) {
    await d.ref.delete();
  }
  if (poolSnap.size > 0) console.log("Deleted", poolSnap.size, "pool entry(ies)");

  // --- Create fresh seed data ---
  const teams = [
    { name: "Full Stack Crew", memberIds: [MOCK_PREFIX + "1", MOCK_PREFIX + "2", MOCK_PREFIX + "3"], wins: 1 },
    { name: "Open Slot Squad", memberIds: [MOCK_PREFIX + "4", MOCK_PREFIX + "5"], wins: 1 },
  ];

  const cutoffAt = getMonthEndFromVirtualId(hackathonId);

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

    if ((team.wins ?? 0) > 0) {
      await submissionsRef.add({
        hackathonId,
        teamId: docRef.id,
        repoUrl: "https://github.com/mock/hackathon-project",
        registeredBy: team.memberIds[0],
        registeredAt: FieldValue.serverTimestamp(),
        submittedAt: FieldValue.serverTimestamp(),
        cutoffAt,
      });
      console.log("  -> added 1 successful submission (team has 1 win)");
    }
  }

  const usersRef = db.collection("users");
  const now = FieldValue.serverTimestamp();
  await usersRef.doc(MOCK_POOL_USER_ID).set(
    {
      displayName: MOCK_POOL_PROFILE.displayName,
      photoURL: MOCK_POOL_PROFILE.photoURL,
      discord: MOCK_POOL_PROFILE.discord,
      github: MOCK_POOL_PROFILE.github,
      visibility: MOCK_POOL_PROFILE.visibility,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  console.log("Created mock pool user:", MOCK_POOL_PROFILE.displayName, "id:", MOCK_POOL_USER_ID);

  const poolDocId = `${MOCK_POOL_USER_ID}_${hackathonId}`;
  await poolRef.doc(poolDocId).set({
    userId: MOCK_POOL_USER_ID,
    hackathonId,
    joinedAt: FieldValue.serverTimestamp(),
  });
  console.log("Added mock user to pool:", poolDocId);

  // --- Create 10 mock public member profiles (visible on /members) ---
  const visibility = {
    isPublic: true,
    showEmail: false,
    showBio: true,
    showLocation: true,
    showCompany: true,
    showJobTitle: true,
    showDiscord: false,
    showGithubBadge: false,
    showEventsAttended: true,
    showTalksGiven: true,
    showWebsite: false,
    showLinkedIn: false,
    showTwitter: false,
    showGithub: false,
    showSubstack: false,
    showMemberSince: true,
  };
  for (let i = 0; i < MOCK_MEMBER_PROFILES.length; i++) {
    const uid = MOCK_PROFILE_PREFIX + (i + 1);
    const p = MOCK_MEMBER_PROFILES[i];
    const ts = FieldValue.serverTimestamp();
    await usersRef.doc(uid).set(
      {
        displayName: p.displayName,
        photoURL: null,
        bio: p.bio ?? "",
        location: p.location ?? "",
        company: p.company ?? "",
        jobTitle: p.jobTitle ?? "",
        visibility,
        createdAt: ts,
        updatedAt: ts,
      },
      { merge: true }
    );
    console.log("Created mock profile:", p.displayName, "id:", uid);
  }

  console.log("Done. View teams at /hackathons/teams, pool at /hackathons/pool, members at /members");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
