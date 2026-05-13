#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * PyData × Cursor Boston (May 13, 2026) — LLM scorer for hackathon submissions.
 *
 * Reads a `pydata-2026-submissions/<handle>/` folder, calls Claude with the
 * hackathon rubric, and writes `score.json` into the same folder. The score
 * file is what the event page renders on each card and what the maintainers
 * use to rank "Best Submission" entries.
 *
 * Usage:
 *   npx tsx scripts/score-pydata-submission.ts --handle <gh-handle>
 *   npx tsx scripts/score-pydata-submission.ts --all
 *   npx tsx scripts/score-pydata-submission.ts --handle alice --force   # re-score
 *   npx tsx scripts/score-pydata-submission.ts --all --skip-existing
 *
 * Requires: ANTHROPIC_API_KEY
 *
 * The merge checklist for maintainers lives in CLAUDE.md
 * ("PyData submission merge checklist") — score.json must be committed onto
 * the submission branch before the PR is merged.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {
  PYDATA_SUBMISSIONS_DIR,
} from "../lib/pydata-submissions";

const MODEL = "claude-opus-4-7";
const SCORE_FILENAME = "score.json";
const NOTEBOOK_FILENAME = "submission.ipynb";
const META_FILENAME = "meta.json";
const MAX_NOTEBOOK_CHARS = 30_000;

const COMPETITION_DATASETS = [
  "FLIP2: Expanding Protein Fitness Landscape Benchmarks",
  "ProteinGym",
  "1000 Genomes Project",
  "GTEx Datasets",
  "ERA5 Reanalysis (Copernicus)",
  "NOAA Climate Data Online Datasets",
  "LeRobot Datasets (Hugging Face)",
  "UCI Wall-Following Robot Navigation",
  "UCI Bank Marketing",
  "Kaggle Marketing Campaign Datasets",
  "UCI Online Retail",
  "Retailrocket E-commerce Dataset (Kaggle)",
  "Analyze Boston (City of Boston Open Data)",
  "MBTA Open Data",
];

const RUBRIC = `You are the AI "black box" judge for the Cursor Boston × PyData hackathon (May 13, 2026 at Moderna HQ).

## Challenge
Attendees had one evening to use Cursor and Marimo to build a notebook that uncovers **one compelling insight** from one of the competition datasets below. The brief: "One notebook. One insight. Make it interesting."

## Competition datasets (at least one must be used)
${COMPETITION_DATASETS.map((d) => `- ${d}`).join("\n")}

External / non-competition datasets disqualify the submission for "Best Submission".

## Evaluation Criteria — score holistically 1-10

1. **Insight clarity & sharpness** — Is there a single, clearly articulated finding? Diffuse "here is some EDA" notebooks score lower; a sharp, specific insight stated up front scores higher.
2. **Dataset eligibility & engagement** — Uses ≥1 competition dataset. Surface-level "read CSV, plot histogram" scores lower; thoughtful, dataset-aware analysis scores higher. If no competition dataset is used, score must be ≤3.
3. **Evidence & rigor** — Does the analysis actually support the claimed insight? Sensible methodology, no obvious leakage / sampling errors, reproducible code.
4. **Narrative & data storytelling** — Setup → exploration → finding → significance. Reader can follow the argument. Marimo's reactive surface used purposefully (not just as a Jupyter substitute).
5. **Interest / "make it interesting"** — Is the insight surprising, contrarian, actionable, or genuinely useful? Generic charts of well-known trends score lower; novel framings score higher.

## Scoring guide
- 1-2: Empty / broken / off-topic / no competition dataset used
- 3-4: Minimal analysis, generic finding, weak evidence
- 5-6: Solid exploratory work, reasonable finding, but unremarkable
- 7-8: Clear sharp insight, well-supported, good narrative
- 9-10: Exceptional — surprising or actionable insight, rigorous evidence, polished storytelling

## Important notes
- Judge fairly for a single-evening event. Don't expect production polish.
- A missing or broken notebook is an automatic 1.
- Be honest and differentiate. Not every submission deserves a 7.
- The "insight" must be in the notebook itself, not just in the meta description.

Respond with ONLY a JSON object (no markdown fencing, no prose around it):
{"score": <integer 1-10>, "rationale": "<2-4 sentence justification calling out the specific insight, the dataset, and the main strength/weakness>"}`;

interface ScoreFile {
  score: number;
  rationale: string;
  model: string;
  scoredAt: string;
  scorerVersion: number;
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

interface NotebookCell {
  cell_type?: string;
  source?: string | string[];
}

function cellSourceToString(source: NotebookCell["source"]): string {
  if (typeof source === "string") return source;
  if (Array.isArray(source)) return source.join("");
  return "";
}

function extractNotebookText(notebookPath: string): string {
  const raw = fs.readFileSync(notebookPath, "utf8");
  let parsed: { cells?: NotebookCell[] };
  try {
    parsed = JSON.parse(raw) as { cells?: NotebookCell[] };
  } catch {
    return raw.slice(0, MAX_NOTEBOOK_CHARS);
  }

  const cells = Array.isArray(parsed.cells) ? parsed.cells : [];
  const parts: string[] = [];
  for (const cell of cells) {
    const text = cellSourceToString(cell.source).trim();
    if (!text) continue;
    const kind = cell.cell_type === "markdown" ? "MD" : "CODE";
    parts.push(`--- ${kind} ---\n${text}`);
  }
  const joined = parts.join("\n\n");
  if (joined.length <= MAX_NOTEBOOK_CHARS) return joined;
  const head = Math.floor(MAX_NOTEBOOK_CHARS * 0.7);
  const tail = MAX_NOTEBOOK_CHARS - head - 50;
  return (
    joined.slice(0, head) +
    "\n\n…[truncated middle]…\n\n" +
    joined.slice(joined.length - tail)
  );
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
  const notebookPath = path.join(folderPath, NOTEBOOK_FILENAME);
  const metaPath = path.join(folderPath, META_FILENAME);

  if (!fs.existsSync(notebookPath)) {
    throw new Error(`${handle}: missing ${NOTEBOOK_FILENAME}`);
  }

  const meta = fs.existsSync(metaPath)
    ? fs.readFileSync(metaPath, "utf8")
    : "(missing meta.json)";
  const notebook = extractNotebookText(notebookPath);

  const context = [
    `## Submission: ${handle}`,
    `\n### meta.json\n${meta}`,
    `\n### submission.ipynb (cells extracted)\n${notebook}`,
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

function writeScoreFile(folderPath: string, result: ScoreResult): string {
  const out: ScoreFile = {
    score: result.score,
    rationale: result.rationale,
    model: MODEL,
    scoredAt: new Date().toISOString(),
    scorerVersion: SCORER_VERSION,
  };
  const scorePath = path.join(folderPath, SCORE_FILENAME);
  fs.writeFileSync(scorePath, JSON.stringify(out, null, 2) + "\n");
  return scorePath;
}

function hasExistingScore(folderPath: string): boolean {
  return fs.existsSync(path.join(folderPath, SCORE_FILENAME));
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

  const rootDir = path.join(process.cwd(), PYDATA_SUBMISSIONS_DIR);
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

    if (hasExistingScore(folderPath) && !args.force) {
      if (args.skipExisting || args.all) {
        console.log(`${handle}: score.json already exists, skipping (use --force to re-score)`);
        continue;
      }
      console.error(
        `${handle}: score.json already exists. Use --force to overwrite.`
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
