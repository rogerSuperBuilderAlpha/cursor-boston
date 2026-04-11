#!/usr/bin/env node
/**
 * Sync Firestore confirmedAt from the stored ranking JSON.
 *
 * Sets confirmedAt on confirmed entries, clears it on everyone else.
 * Matches ranking entries to Firestore docs by email → GitHub login.
 *
 * Usage:
 *   npx tsx scripts/sync-ranking-to-firestore.ts --dry-run
 *   npx tsx scripts/sync-ranking-to-firestore.ts --write
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";

const RANKING_PATH = resolve(__dirname, "data/hack-a-sprint-2026-ranking.json");
const EVENT_ID = HACK_A_SPRINT_2026_EVENT_ID;

type RankingEntry = {
  rank: number;
  status: "confirmed" | "waitlisted";
  email: string;
  name: string;
  githubLogin: string | null;
  prsThruApr9: number;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const write = process.argv.includes("--write");
  if (!dryRun && !write) {
    console.error("Specify --dry-run or --write");
    process.exit(1);
  }

  const ranking: RankingEntry[] = JSON.parse(
    readFileSync(RANKING_PATH, "utf8")
  ).ranking;
  console.log(`Loaded ${ranking.length} entries from ranking JSON.`);

  type ConfirmedInfo = { rank: number; prsThruApr9: number };
  const confirmedByEmail = new Map<string, ConfirmedInfo>();
  const confirmedByGithub = new Map<string, ConfirmedInfo>();
  for (const r of ranking) {
    if (r.status !== "confirmed") continue;
    const info = { rank: r.rank, prsThruApr9: r.prsThruApr9 };
    confirmedByEmail.set(r.email, info);
    if (r.githubLogin) confirmedByGithub.set(r.githubLogin.toLowerCase(), info);
  }
  console.log(`Confirmed: ${confirmedByEmail.size} emails, ${confirmedByGithub.size} GitHub logins.`);

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase not configured.");
    process.exit(1);
  }

  // --- Website signups (hackathonEventSignups) ---
  const signupSnap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", EVENT_ID)
    .get();
  console.log(`\nWebsite signups: ${signupSnap.docs.length}`);

  const userIds = signupSnap.docs.map((d) => d.data().userId as string).filter(Boolean);
  const userMap = new Map<string, { email?: string; githubLogin?: string }>();
  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (!s.exists) continue;
      const d = s.data()!;
      const gh =
        d.github && typeof d.github === "object"
          ? (d.github as { login?: string }).login
          : undefined;
      userMap.set(s.id, {
        email: typeof d.email === "string" ? d.email.toLowerCase() : undefined,
        githubLogin: typeof gh === "string" ? gh.toLowerCase() : undefined,
      });
    }
  }

  let setCount = 0;
  let clearCount = 0;
  let unchangedCount = 0;

  for (const doc of signupSnap.docs) {
    const data = doc.data();
    const uid = data.userId as string;
    const user = userMap.get(uid);
    const isCurrentlyConfirmed = !!data.confirmedAt;

    const info =
      (user?.email && confirmedByEmail.get(user.email)) ||
      (user?.githubLogin && confirmedByGithub.get(user.githubLogin)) ||
      null;
    const shouldBeConfirmed = info != null;

    if (shouldBeConfirmed) {
      const needsUpdate =
        !isCurrentlyConfirmed ||
        data.frozenRank !== info.rank ||
        data.frozenPrCount !== info.prsThruApr9;
      if (needsUpdate) {
        console.log(`  SET confirmed #${info.rank}: ${user?.email || uid} (${user?.githubLogin || "?"})`);
        if (write) {
          await db.collection("hackathonEventSignups").doc(doc.id).update({
            confirmedAt: isCurrentlyConfirmed ? data.confirmedAt : FieldValue.serverTimestamp(),
            frozenRank: info.rank,
            frozenPrCount: info.prsThruApr9,
          });
        }
        setCount++;
      } else {
        unchangedCount++;
      }
    } else if (isCurrentlyConfirmed || data.frozenRank != null) {
      console.log(`  CLEAR confirmed: ${user?.email || uid} (${user?.githubLogin || "?"})`);
      if (write) {
        await db.collection("hackathonEventSignups").doc(doc.id).update({
          confirmedAt: FieldValue.delete(),
          frozenRank: FieldValue.delete(),
          frozenPrCount: FieldValue.delete(),
        });
      }
      clearCount++;
    } else {
      unchangedCount++;
    }
  }

  // --- Luma registrants (hackathonLumaRegistrants) ---
  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", EVENT_ID)
    .get();
  console.log(`\nLuma registrants: ${lumaSnap.docs.length}`);

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string || "").toLowerCase();
    const gh = typeof d.githubLogin === "string" ? d.githubLogin.toLowerCase() : null;
    const isCurrentlyConfirmed = !!d.confirmedAt;

    const info =
      confirmedByEmail.get(email) || (gh && confirmedByGithub.get(gh)) || null;
    const shouldBeConfirmed = info != null;

    if (shouldBeConfirmed) {
      const needsUpdate =
        !isCurrentlyConfirmed ||
        d.frozenRank !== info.rank ||
        d.frozenPrCount !== info.prsThruApr9;
      if (needsUpdate) {
        console.log(`  SET confirmed #${info.rank}: ${email} (${gh || "?"})`);
        if (write) {
          await db.collection("hackathonLumaRegistrants").doc(doc.id).update({
            confirmedAt: isCurrentlyConfirmed ? d.confirmedAt : FieldValue.serverTimestamp(),
            frozenRank: info.rank,
            frozenPrCount: info.prsThruApr9,
          });
        }
        setCount++;
      } else {
        unchangedCount++;
      }
    } else if (isCurrentlyConfirmed || d.frozenRank != null) {
      console.log(`  CLEAR confirmed: ${email} (${gh || "?"})`);
      if (write) {
        await db.collection("hackathonLumaRegistrants").doc(doc.id).update({
          confirmedAt: FieldValue.delete(),
          frozenRank: FieldValue.delete(),
          frozenPrCount: FieldValue.delete(),
        });
      }
      clearCount++;
    } else {
      unchangedCount++;
    }
  }

  console.log(`\nSummary: ${setCount} set, ${clearCount} cleared, ${unchangedCount} unchanged.`);
  if (dryRun) console.log("--dry-run: no writes. Use --write to apply.");
  else console.log("Done. Firestore updated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
