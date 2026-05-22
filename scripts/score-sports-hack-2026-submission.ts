#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Boston Tech Week Sports Hack 2026 (May 26) — LLM scorer for hackathon
 * submissions.
 *
 * Reads a `sports-hack-2026-submissions/<handle>/` folder, calls Claude with
 * the hackathon rubric (sports + AI + Cursor brief), and writes (or extends)
 * `score.json` in the same folder. The score file is what the public event
 * page at `/events/cursor-boston-sports-hack-2026` renders on each card.
 *
 * The score layout differs from the pydata version: we keep both `ai` and
 * `judges` blocks in the same file so a single submission can carry both
 * tracks. This script only writes the `ai` block — judge scores land via a
 * separate admin path post-event.
 *
 * Usage:
 *   npx tsx scripts/score-sports-hack-2026-submission.ts --handle <gh-handle>
 *   npx tsx scripts/score-sports-hack-2026-submission.ts --all
 *   npx tsx scripts/score-sports-hack-2026-submission.ts --handle alice --force   # re-score
 *   npx tsx scripts/score-sports-hack-2026-submission.ts --all --skip-existing
 *
 * Requires: ANTHROPIC_API_KEY
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {
  SPORTS_HACK_2026_SUBMISSIONS_DIR,
} from "../lib/sports-hack-2026-submissions";

const MODEL = "claude-opus-4-7";
const SCORE_FILENAME = "score.json";
const META_FILENAME = "meta.json";

const RUBRIC = `You are the AI "black box" judge for the Boston Tech Week Sports Hack (May 26, 2026 at Hult International, Cambridge).

## Challenge
Attendees had a 2-hour build sprint to use Cursor as their AI co-pilot and ship a sports-tech project. They submit a short explainer video, a public GitHub repo, and ideally a live deployed URL.

## What you're judging
You get the submission's \`meta.json\` — title, description, video URL, repo URL, deployed URL, optional tags. You do NOT get to watch the video or browse the repo; you score based on what the team chose to communicate in their meta and on the inherent strength of the proposed project.

## Evaluation Criteria — score holistically 1-10

1. **Idea fit & sports relevance** — Is this clearly a sports-tech project? Loose interpretations are OK (training, fan engagement, analytics, broadcasting, equipment, betting markets, recovery, youth/community sports) but the project must be recognizably sports.
2. **Specificity & clarity** — Is the description a single, sharp pitch ("X for Y user, doing Z") or a vague gesture? Sharp scores higher.
3. **Cursor / AI leverage signal** — Does the description / repo name / project shape suggest the team actually leaned into AI co-piloting? Bonus for surprising or non-trivial AI use; nothing if the AI angle is missing.
4. **Completeness signal** — Did they fill in video + repo + deployed URL? Missing pieces lower the score (especially missing deployed URL, since the brief includes shipping live). All three present + plausible scores higher.
5. **Polish & ambition** — Does the title + description read like someone who took the brief seriously? Does the scope match what's achievable in 2 hours without being trivial?

## Scoring guide
- 1-2: Empty / off-topic / not recognizably sports / no video + no repo
- 3-4: Minimal effort, vague pitch, generic idea, missing required URLs
- 5-6: Solid attempt, clear idea, most URLs present, decent specificity
- 7-8: Sharp pitch, all URLs present, evident AI leverage, ambitious but in-scope
- 9-10: Exceptional — surprising / contrarian / genuinely useful sports application, clearly shipped, strong AI-leverage signal

## Important notes
- Judge fairly for a 2-hour event. Don't expect production polish.
- An empty or broken meta.json is an automatic 1.
- Be honest and differentiate. Not every submission deserves a 7.
- If the project isn't recognizably sports-related, cap the score at 4.

Respond with ONLY a JSON object (no markdown fencing, no prose around it):
{"score": <integer 1-10>, "rationale": "<2-4 sentence justification calling out the specific idea, the strongest signal you saw, and the main weakness>"}`;

interface AiScoreBlock {
  score: number;
  rationale: string;
  model: string;
  scoredAt: string;
  scorerVersion: number;
}

interface ScoreFile {
  ai?: AiScoreBlock;
  judges?: unknown;
}

const SCORER_VERSION = 1;

function parseArgs(argv: string[]) {
  const handleIdx = argv.indexOf("--handle");
  const handle =
    handleIdx >= 0 ? argv[handleIdx + 1]?.trim().toLowerCase() ?? null : null;
  const all = argv.includes("--all");
  const force = argv.includes("--force");
  const skipExisting = argv.includes("--skip-existing");

  if (!handle && !all) {
    console.error("Specify --handle <gh-handle> or --all");
    process.exit(1);
  }
  if (handle && all) {
    console.error("Specify only one of --handle or --all");
    process.exit(1);
  }
  return { handle, all, force, skipExisting };
}

interface ScoreResult {
  score: number;
  rationale: string;
}

async function scoreSubmission(
  client: Anthropic,
  handle: string,
  folderPath: string
): Promise<ScoreResult> {
  const metaPath = path.join(folderPath, META_FILENAME);
  if (!fs.existsSync(metaPath)) {
    throw new Error(`${handle}: missing ${META_FILENAME}`);
  }
  const meta = fs.readFileSync(metaPath, "utf8");

  const context = [
    `## Submission: ${handle}`,
    `\n### meta.json\n${meta}`,
  ].join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: `${RUBRIC}\n\n---\n\n${context}` }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not parse model response: ${text}`);
  const parsed = JSON.parse(jsonMatch[0]) as {
    score?: unknown;
    rationale?: unknown;
  };
  const score = Number(parsed.score);
  const rationale = String(parsed.rationale ?? "").trim();
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    throw new Error(`Invalid score: ${String(parsed.score)}`);
  }
  if (!rationale) throw new Error("Empty rationale");
  return { score, rationale };
}

function readScoreFile(folderPath: string): ScoreFile {
  const scorePath = path.join(folderPath, SCORE_FILENAME);
  if (!fs.existsSync(scorePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(scorePath, "utf8")) as ScoreFile;
  } catch {
    return {};
  }
}

function writeScoreFile(folderPath: string, result: ScoreResult): string {
  // Preserve any existing `judges` block so this script can be re-run without
  // clobbering human-judge scores written through a separate path.
  const existing = readScoreFile(folderPath);
  const out: ScoreFile = {
    ...existing,
    ai: {
      score: result.score,
      rationale: result.rationale,
      model: MODEL,
      scoredAt: new Date().toISOString(),
      scorerVersion: SCORER_VERSION,
    },
  };
  const scorePath = path.join(folderPath, SCORE_FILENAME);
  fs.writeFileSync(scorePath, JSON.stringify(out, null, 2) + "\n");
  return scorePath;
}

function hasExistingAiScore(folderPath: string): boolean {
  const existing = readScoreFile(folderPath);
  return Boolean(existing.ai);
}

function listHandles(rootDir: string): string[] {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const handles: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    handles.push(entry.name);
  }
  handles.sort();
  return handles;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required.");
    process.exit(1);
  }

  const rootDir = path.join(process.cwd(), SPORTS_HACK_2026_SUBMISSIONS_DIR);
  if (!fs.existsSync(rootDir)) {
    console.error(`Directory not found: ${rootDir}`);
    process.exit(1);
  }

  const handles = args.all ? listHandles(rootDir) : [args.handle!];
  if (handles.length === 0) {
    console.log("No submissions to score.");
    return;
  }

  const client = new Anthropic();

  for (const handle of handles) {
    const folderPath = path.join(rootDir, handle);
    if (!fs.existsSync(folderPath)) {
      console.error(`${handle}: folder not found, skipping`);
      continue;
    }

    if (hasExistingAiScore(folderPath) && !args.force) {
      if (args.skipExisting || args.all) {
        console.log(
          `${handle}: ai score already exists, skipping (use --force to re-score)`
        );
        continue;
      }
      console.error(
        `${handle}: ai score already exists. Use --force to overwrite.`
      );
      process.exit(1);
    }

    console.log(`Scoring ${handle}…`);
    try {
      const result = await scoreSubmission(client, handle, folderPath);
      const scorePath = writeScoreFile(folderPath, result);
      console.log(`  ${result.score}/10 — ${result.rationale}`);
      console.log(`  wrote ${path.relative(process.cwd(), scorePath)}`);
    } catch (e) {
      console.error(
        `  failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
