#!/usr/bin/env node
/**
 * Seed Cursor credit codes into Firestore for confirmed Hack-a-Sprint participants.
 *
 * Each code is stored keyed by rank (1-50), matching the frozenRank field
 * on hackathonEventSignups / hackathonLumaRegistrants docs.
 *
 * Collection: hackathonCreditCodes
 * Doc ID: hack-a-sprint-2026__{rank}
 *
 * Usage:
 *   npx tsx scripts/seed-credit-codes.ts --dry-run [--csv path/to/codes.csv]
 *   npx tsx scripts/seed-credit-codes.ts --write [--csv path/to/codes.csv]
 */
import { readFileSync } from "fs";
import { join } from "path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";

const EVENT_ID = HACK_A_SPRINT_2026_EVENT_ID;
const RANKING_PATH = join(__dirname, "data/hack-a-sprint-2026-ranking.json");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const write = process.argv.includes("--write");
  if (!dryRun && !write) {
    console.error("Specify --dry-run or --write");
    process.exit(1);
  }

  const csvIdx = process.argv.indexOf("--csv");
  const csvPath =
    csvIdx >= 0 && process.argv[csvIdx + 1]
      ? process.argv[csvIdx + 1]!
      : join(
          process.env.HOME || "",
          "cursor-boston/docs/cursor_credits_links_4_13/Cursor Boston April - Sheet1.csv"
        );

  let codesRaw: string;
  try {
    codesRaw = readFileSync(csvPath, "utf8");
  } catch {
    console.error(`Cannot read codes CSV: ${csvPath}`);
    process.exit(1);
  }

  const codes = codesRaw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("http"));
  console.log(`Loaded ${codes.length} credit codes from ${csvPath}`);

  const ranking = JSON.parse(readFileSync(RANKING_PATH, "utf8")).ranking as Array<{
    rank: number;
    status: string;
    email: string;
    name: string;
    githubLogin: string | null;
  }>;
  const confirmed = ranking.filter((r) => r.status === "confirmed");
  console.log(`Ranking has ${confirmed.length} confirmed participants.`);

  if (codes.length < confirmed.length) {
    console.error(
      `Not enough codes (${codes.length}) for confirmed participants (${confirmed.length}).`
    );
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase not configured.");
    process.exit(1);
  }

  const col = db.collection("hackathonCreditCodes");

  for (let i = 0; i < confirmed.length; i++) {
    const entry = confirmed[i]!;
    const code = codes[i]!;
    const docId = `${EVENT_ID}__${entry.rank}`;

    console.log(
      `  #${entry.rank} ${entry.name.padEnd(30)} ${entry.email.padEnd(40)} ${code.slice(0, 45)}…`
    );

    if (write) {
      await col.doc(docId).set({
        eventId: EVENT_ID,
        rank: entry.rank,
        creditUrl: code,
        assignedToEmail: entry.email,
        assignedToName: entry.name,
        assignedToGithub: entry.githubLogin,
        seededAt: new Date().toISOString(),
      });
    }
  }

  console.log(
    `\n${dryRun ? "--dry-run: no writes." : "Done."} ${confirmed.length} codes ${dryRun ? "would be" : ""} seeded.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
