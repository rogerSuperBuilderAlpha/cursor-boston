#!/usr/bin/env node
/**
 * Hack-a-Sprint 2026 — AI evaluation of showcase submissions.
 *
 * Uses Claude to score each submission 1-10 against an Inkbox-specific rubric.
 *
 * Usage:
 *   npx tsx scripts/ai-evaluate-submissions.ts --dry-run
 *   npx tsx scripts/ai-evaluate-submissions.ts --apply
 *   npx tsx scripts/ai-evaluate-submissions.ts --dry-run --single alice
 *
 * Requires: ANTHROPIC_API_KEY, FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS,
 *           GITHUB_TOKEN (optional, for higher rate limits).
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { fetchShowcaseSubmissionsFromGitHub } from "../lib/hackathon-showcase";
import { hackASprint2026ScoreDocId } from "../lib/hackathon-asprint-2026-state";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";
import { getAdminDb } from "../lib/firebase-admin";

const RUBRIC = `You are an expert hackathon judge for the Cursor Boston Hack-a-Sprint 2026.

## Challenge
Participants had 2.5 hours to build an AI agent using the Inkbox SDK (https://inkbox.ai).
The Inkbox SDK provides: Identities (managed user identities), Email (send/receive), Phone (calls/SMS), and Vault (secure data storage).
Agents should solve a real productivity or workflow problem using at least one Inkbox capability.

## Evaluation Criteria (score holistically 1-10)

1. **Inkbox SDK Integration Depth** — Does the project meaningfully use Inkbox capabilities (email, phone, vault, identities)? Surface-level usage scores lower; deep, creative integration scores higher.

2. **Agent Autonomy & Usefulness** — Does the agent actually do something useful autonomously? Could you see yourself using this? Agents that passively display data score lower than those that take action.

3. **Code Quality & Completeness** — Based on the README and description: is the project well-structured, documented, and complete for a 2.5-hour sprint? Does it work end-to-end?

4. **Creativity & Originality** — Is the use case novel or interesting? Cookie-cutter TODO apps score low; unique, clever applications of Inkbox score high.

5. **Demo & Deployment** — Is the project deployed and accessible? Is there a Loom walkthrough? Projects with live demos and clear explanations score higher.

## Scoring Guide
- 1-2: Minimal effort, doesn't use Inkbox, incomplete
- 3-4: Basic Inkbox usage, partially working, generic idea
- 5-6: Decent integration, works end-to-end, reasonable idea
- 7-8: Strong Inkbox usage, creative idea, well-executed for a sprint
- 9-10: Exceptional — deep SDK integration, novel use case, polished, clearly useful

## Important Notes
- You CANNOT watch videos, so evaluate based on the project description, README, and code context.
- A missing or sparse README is a negative signal.
- Judge fairly for a 2.5-hour sprint — don't expect production polish.
- Be honest and differentiate. Not every project deserves a 7.

Respond with ONLY a JSON object (no markdown fencing):
{"score": <integer 1-10>, "reasoning": "<2-3 sentence justification>"}`;

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fetchRepoReadme(repoUrl: string): Promise<string | null> {
  try {
    const url = new URL(repoUrl);
    if (!url.hostname.includes("github.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
    const res = await fetch(apiUrl, {
      headers: { ...githubHeaders(), Accept: "application/vnd.github.raw+json" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 8000);
  } catch {
    return null;
  }
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  const singleIdx = argv.indexOf("--single");
  const single = singleIdx >= 0 ? argv[singleIdx + 1]?.trim().toLowerCase() ?? null : null;

  if ((dryRun && apply) || (!dryRun && !apply)) {
    console.error("Specify exactly one of: --dry-run | --apply");
    process.exit(1);
  }
  return { dryRun, apply, single };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { dryRun, apply, single } = parseArgs(process.argv.slice(2));

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required.");
    process.exit(1);
  }

  const db = apply ? getAdminDb() : null;
  if (apply && !db) {
    console.error("Firebase Admin not configured (needed for --apply).");
    process.exit(1);
  }

  const client = new Anthropic();

  console.log("Fetching submissions from GitHub…");
  let submissions = await fetchShowcaseSubmissionsFromGitHub();
  if (submissions.length === 0) {
    console.log("No submissions found.");
    return;
  }

  if (single) {
    submissions = submissions.filter((s) => s.submissionId === single);
    if (submissions.length === 0) {
      console.error(`No submission found for login: ${single}`);
      process.exit(1);
    }
  }

  console.log(`Evaluating ${submissions.length} submission(s)…\n`);

  const results: { login: string; score: number; reasoning: string }[] = [];

  for (const sub of submissions) {
    const { submissionId, githubLogin, payload } = sub;
    console.log(`--- ${githubLogin} ---`);

    let readme: string | null = null;
    try {
      readme = await fetchRepoReadme(payload.projectRepoUrl);
    } catch {
      console.log("  Could not fetch README.");
    }

    const context = [
      `## Submission: ${payload.title}`,
      `**Author:** ${githubLogin}`,
      `**Repo:** ${payload.projectRepoUrl}`,
      `**Deployed URL:** ${payload.deployedUrl}`,
      `**Loom Video:** ${payload.loomVideoUrl}`,
      payload.demoVideoUrl ? `**Demo Video:** ${payload.demoVideoUrl}` : null,
      `\n**Description:**\n${payload.description}`,
      readme ? `\n**README.md (truncated):**\n${readme}` : "\n**README.md:** Not available",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          { role: "user", content: `${RUBRIC}\n\n---\n\n${context}` },
        ],
      });

      const text =
        response.content[0]?.type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`  Failed to parse response for ${githubLogin}: ${text}`);
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        score?: number;
        reasoning?: string;
      };
      const score = Number(parsed.score);
      const reasoning = String(parsed.reasoning ?? "");

      if (!Number.isInteger(score) || score < 1 || score > 10) {
        console.error(`  Invalid score for ${githubLogin}: ${score}`);
        continue;
      }

      results.push({ login: githubLogin, score, reasoning });
      console.log(`  Score: ${score}/10`);
      console.log(`  Reasoning: ${reasoning}`);

      if (apply && db) {
        const ref = db
          .collection("hackathonShowcaseScores")
          .doc(hackASprint2026ScoreDocId(submissionId));
        await ref.set(
          {
            eventId: HACK_A_SPRINT_2026_EVENT_ID,
            submissionId,
            aiScore: score,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        console.log(`  Written to Firestore.`);
      }
    } catch (e) {
      console.error(`  Error evaluating ${githubLogin}:`, e instanceof Error ? e.message : e);
    }

    await sleep(1000);
  }

  console.log("\n=== Summary ===");
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  console.log(`${pad("Login", 25)} ${pad("Score", 6)} Reasoning`);
  console.log("-".repeat(80));
  for (const r of results) {
    console.log(`${pad(r.login, 25)} ${pad(String(r.score), 6)} ${r.reasoning.slice(0, 80)}`);
  }

  if (results.length > 0) {
    const avg = results.reduce((a, b) => a + b.score, 0) / results.length;
    console.log(`\nAverage score: ${avg.toFixed(2)} across ${results.length} submissions`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no scores written to Firestore.");
  } else {
    console.log(`\n--apply: ${results.length} score(s) written to Firestore.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
