/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getVoteWeekById,
} from "@/lib/summer-cohort-submissions";
import { getAdminDb } from "@/lib/firebase-admin";
import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { isValidCohortId, type SummerCohortId } from "@/lib/summer-cohort";
import { getOptionalVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { summerCohortContract } from "@/lib/api-schemas/summer-cohort";

interface ScoreFile {
  score: number;
  rationale: string;
  model?: string;
  scoredAt?: string;
  scorerVersion?: number;
}

function scoresDirFromSubmissionPath(submissionPath: string): string | null {
  // submissionPath looks like:
  //   content/summer-cohort/c1/w1-pm/submissions/<github-handle>.json
  // The scores directory is the sibling `scores/` next to `submissions/`.
  const submissionsIdx = submissionPath.lastIndexOf("/submissions/");
  if (submissionsIdx < 0) return null;
  return `${submissionPath.slice(0, submissionsIdx)}/scores`;
}

async function getGithubLoginForUid(
  db: FirebaseFirestore.Firestore,
  uid: string
): Promise<string | null> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as { github?: { login?: string } } | undefined;
  const login = data?.github?.login;
  return typeof login === "string" && login.trim().length > 0
    ? login.trim()
    : null;
}

/**
 * Return only the authenticated user's own AI-judge score for a vote-format
 * week. The route never accepts a handle query parameter — the handle is
 * resolved server-side from `users/{uid}.github.login`, so callers cannot
 * peek at someone else's score even if they know the other user's handle.
 *
 * Source of truth for scores is `<weekRoot>/scores/<handle>.json` on the
 * week's submission branch — the same branch that stores submissions, kept
 * close to the submission JSON they grade.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ weekId: string }> }
) {
  const { weekId } = await params;
  const parsedParams = summerCohortContract.myScoreByWeek.pathParams.safeParse({
    weekId,
  });
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Unknown weekId — vote-format weeks are week-1, week-2, week-3." },
      { status: 404 }
    );
  }
  const cohortIdParam = req.nextUrl.searchParams.get("cohortId");
  const cohortId: SummerCohortId = isValidCohortId(cohortIdParam)
    ? cohortIdParam
    : "cohort-1";

  const week = getVoteWeekById(parsedParams.data.weekId, cohortId);
  if (!week) {
    return NextResponse.json(
      { error: "Unknown weekId — vote-format weeks are week-1, week-2, week-3." },
      { status: 404 }
    );
  }

  let verified;
  try {
    verified = await getOptionalVerifiedUser(req);
  } catch (error) {
    logger.warn("my-score: token verification threw", {
      error: error instanceof Error ? error.message : String(error),
    });
    verified = null;
  }
  if (!verified) {
    return NextResponse.json(
      { error: "Sign in to see your judge feedback." },
      { status: 401 }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server misconfigured (no Firestore)." },
      { status: 500 }
    );
  }

  const handle = await getGithubLoginForUid(db, verified.uid);
  if (!handle) {
    return NextResponse.json(
      {
        error:
          "Link your GitHub account on your profile so we can match the score to you.",
      },
      { status: 404 }
    );
  }

  const scoresDir = scoresDirFromSubmissionPath(week.submissionPath);
  if (!scoresDir) {
    return NextResponse.json(
      { error: "Misconfigured week — no scores directory." },
      { status: 500 }
    );
  }

  const { owner, repo } = getGithubRepoPair();
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(
    week.submissionBranch
  )}/${scoresDir}/${encodeURIComponent(handle)}.json`;
  const token = process.env.GITHUB_TOKEN;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      // Match the submissions feed's revalidate window — scores update rarely
      // and the same content addresses cache nicely.
      next: { revalidate: 60 },
    });
  } catch (error) {
    logger.warn("my-score: raw fetch failed", {
      weekId,
      handle,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Couldn't load your score right now — try again in a minute." },
      { status: 500 }
    );
  }

  if (res.status === 404) {
    return NextResponse.json(
      {
        error:
          "No judge feedback yet for your submission — check back after we score this week.",
      },
      { status: 404 }
    );
  }
  if (!res.ok) {
    logger.warn("my-score: raw fetch non-OK", {
      weekId,
      handle,
      status: res.status,
    });
    return NextResponse.json(
      { error: "Couldn't load your score right now — try again in a minute." },
      { status: 500 }
    );
  }

  let parsed: ScoreFile;
  try {
    parsed = (await res.json()) as ScoreFile;
  } catch {
    return NextResponse.json(
      { error: "Score file is malformed — flag this to a maintainer." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      weekId,
      githubHandle: handle,
      score: parsed.score,
      rationale: parsed.rationale,
      model: parsed.model ?? null,
      scoredAt: parsed.scoredAt ?? null,
    },
    {
      headers: {
        // Per-user response — do not let any shared cache hold it.
        "Cache-Control": "private, no-store",
      },
    }
  );
}
