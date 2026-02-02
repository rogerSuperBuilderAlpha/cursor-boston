/**
 * One-off script to inspect the users collection and see how many have
 * public profiles. Run with: npm run check-members-db
 * Loads .env.local from project root if present (for FIREBASE_SERVICE_ACCOUNT_JSON).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env.local from project root so Firebase Admin can find credentials
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match && !process.env[match[1]]) {
      const value = match[2].replace(/^["']|["']$/g, "").trim();
      process.env[match[1]] = value;
    }
  }
}

import { getAdminDb } from "../lib/firebase-admin";

async function main() {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }

  const usersRef = db.collection("users");
  const allSnap = await usersRef.get();
  let publicSnap;
  try {
    publicSnap = await usersRef
      .where("visibility.isPublic", "==", true)
      .orderBy("createdAt", "desc")
      .get();
  } catch (e) {
    console.error("Public-profile query failed (missing index?):", e);
  }

  console.log("\n--- Users collection ---");
  console.log("Total user documents:", allSnap.size);

  let withVisibility = 0;
  let publicCount = 0;
  const samples: { uid: string; displayName?: string; isPublic?: boolean }[] = [];

  allSnap.docs.forEach((d) => {
    const data = d.data();
    const vis = data?.visibility;
    if (vis && typeof vis === "object") {
      withVisibility++;
      if (vis.isPublic === true) publicCount++;
    }
    if (samples.length < 10) {
      samples.push({
        uid: d.id,
        displayName: data?.displayName ?? data?.email,
        isPublic: vis?.isPublic === true,
      });
    }
  });

  console.log("Docs with a 'visibility' object:", withVisibility);
  console.log("Docs with visibility.isPublic === true:", publicCount);
  if (publicSnap) {
    console.log("Query (visibility.isPublic == true) returned:", publicSnap.size, "doc(s)");
  }
  console.log("\nSample of first 10 users (uid, displayName/email, isPublic):");
  samples.forEach((s) => console.log(" ", s.uid, "|", s.displayName ?? "(no name)", "| isPublic:", s.isPublic));
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
