#!/usr/bin/env node
/**
 * Apply pre-authored AI scores + reasoning to Firestore without calling Anthropic.
 * Scores are committed in-repo (e.g. scripts/data/hack-a-sprint-2026-ai-scores.json)
 * so evaluation can be done in Cursor chat and applied with Firebase Admin.
 *
 * Usage:
 *   npx tsx scripts/apply-ai-scores-from-json.ts --dry-run
 *   npx tsx scripts/apply-ai-scores-from-json.ts --apply
 *   npx tsx scripts/apply-ai-scores-from-json.ts --apply --file path/to/scores.json
 *   npx tsx scripts/apply-ai-scores-from-json.ts --apply --accept-all
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { fetchShowcaseSubmissionsFromGitHub } from "../lib/hackathon-showcase";
import { hackASprint2026ScoreDocId } from "../lib/hackathon-asprint-2026-state";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";
import { getAdminDb } from "../lib/firebase-admin";

const DEFAULT_FILE = "scripts/data/hack-a-sprint-2026-ai-scores.json";

type EvaluationFile = {
  evaluations?: Array<{
    submissionId?: string;
    aiScore?: number;
    aiReasoning?: string;
  }>;
};

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  const acceptAll = argv.includes("--accept-all");
  const fileIdx = argv.indexOf("--file");
  const file =
    fileIdx >= 0 ? argv[fileIdx + 1]?.trim() ?? DEFAULT_FILE : DEFAULT_FILE;

  if ((dryRun && apply) || (!dryRun && !apply)) {
    console.error("Specify exactly one of: --dry-run | --apply");
    process.exit(1);
  }
  return { dryRun, apply, file, acceptAll };
}

function loadEvaluations(path: string): EvaluationFile {
  const abs = resolve(process.cwd(), path);
  const raw = readFileSync(abs, "utf8");
  return JSON.parse(raw) as EvaluationFile;
}

async function main() {
  const { dryRun, apply, file, acceptAll } = parseArgs(process.argv.slice(2));

  const payload = loadEvaluations(file);
  const list = payload.evaluations ?? [];
  if (list.length === 0) {
    console.error("No evaluations in file.");
    process.exit(1);
  }

  console.log(`Loading submissions from GitHub (for id validation)…`);
  const live = await fetchShowcaseSubmissionsFromGitHub();
  const allowed = new Set(live.map((s) => s.submissionId.toLowerCase()));

  const db = apply ? getAdminDb() : null;
  if (apply && !db) {
    console.error("Firebase Admin not configured (needed for --apply).");
    process.exit(1);
  }

  let written = 0;
  let skipped = 0;

  for (const row of list) {
    const submissionId = String(row.submissionId ?? "")
      .trim()
      .toLowerCase();
    const aiScore = Number(row.aiScore);
    const aiReasoning = String(row.aiReasoning ?? "").trim();

    if (!submissionId) {
      console.error("  Skip: missing submissionId");
      skipped++;
      continue;
    }
    if (!Number.isInteger(aiScore) || aiScore < 1 || aiScore > 10) {
      console.error(`  Skip ${submissionId}: invalid aiScore`);
      skipped++;
      continue;
    }
    if (!acceptAll && !allowed.has(submissionId)) {
      console.warn(
        `  Skip ${submissionId}: not in current GitHub showcase list (add --accept-all to apply anyway).`
      );
      skipped++;
      continue;
    }
    const reasoningStored =
      aiReasoning.length > 8000 ? `${aiReasoning.slice(0, 7997)}…` : aiReasoning;

    console.log(`--- ${submissionId} ---`);
    console.log(`  Score: ${aiScore}/10`);
    console.log(`  Reasoning: ${reasoningStored.slice(0, 200)}${reasoningStored.length > 200 ? "…" : ""}`);

    if (apply && db) {
      const ref = db
        .collection("hackathonShowcaseScores")
        .doc(hackASprint2026ScoreDocId(submissionId));
      await ref.set(
        {
          eventId: HACK_A_SPRINT_2026_EVENT_ID,
          submissionId,
          aiScore,
          ...(reasoningStored ? { aiReasoning: reasoningStored } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      written++;
      console.log(`  Written to Firestore.`);
    }
  }

  if (dryRun) {
    console.log(
      `\n--dry-run: ${list.length - skipped} row(s) would be applied; ${skipped} skipped. No Firestore writes.`
    );
  } else {
    console.log(`\n--apply: ${written} document(s) merged in Firestore.`);
    if (skipped) console.log(`Skipped: ${skipped}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
