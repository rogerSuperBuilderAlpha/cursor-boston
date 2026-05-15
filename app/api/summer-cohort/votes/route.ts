/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { type NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  SUMMER_COHORT_VOTES_COLLECTION,
  isValidCohortId,
  type SummerCohortId,
} from "@/lib/summer-cohort";
import { summerCohortContract } from "@/lib/api-schemas/summer-cohort";

const VALID_WEEK_IDS = new Set(["week-1", "week-2", "week-3"]);

/**
 * Simple, deterministic doc ID so a (cohortId, weekId, submitterHandle,
 * voterUid) quad resolves to exactly one Firestore document. Toggling =
 * create-if-absent / delete-if-present.
 *
 * Cohort 1 keeps the original schema (no cohort prefix in the doc ID, no
 * cohortId field) for back-compat with the votes that already exist. New
 * cohorts (cohort-2+) use the prefixed format AND write a `cohortId` field
 * so reads can scope to a single cohort.
 */
function voteDocId(
  cohortId: SummerCohortId,
  weekId: string,
  submitterHandle: string,
  voterUid: string
): string {
  const base = `${weekId}__${submitterHandle.toLowerCase()}__${voterUid}`;
  return cohortId === "cohort-1" ? base : `${cohortId}__${base}`;
}

/**
 * Whether a vote doc matches the cohort the caller asked about. Cohort 1 docs
 * are the legacy schema with no `cohortId` field, so treat missing-field as
 * cohort-1 for back-compat.
 */
function voteDocMatchesCohort(
  data: Record<string, unknown>,
  cohortId: SummerCohortId
): boolean {
  const docCohort =
    typeof data.cohortId === "string" ? data.cohortId : "cohort-1";
  return docCohort === cohortId;
}

function readCohortIdFromQuery(value: string | null): SummerCohortId {
  return isValidCohortId(value) ? value : "cohort-1";
}

function isValidHandle(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  // GitHub handles are alphanumeric + hyphens; allow underscores for safety
  // since our test fixtures and JSON files use lowercase ascii.
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

function isValidWeekId(value: unknown): value is string {
  return typeof value === "string" && VALID_WEEK_IDS.has(value);
}

/**
 * GET /api/summer-cohort/votes?weekId=week-1
 *
 * Auth optional. Returns aggregate vote counts per submitterHandle for the
 * given week. If the requester is signed in, also returns their own list of
 * voted handles for that week.
 */
export async function GET(request: NextRequest) {
  const parsedQuery = summerCohortContract.votesGet.query.safeParse({
    weekId: request.nextUrl.searchParams.get("weekId") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "weekId must be one of week-1, week-2, week-3" },
      { status: 400 }
    );
  }
  const weekId = parsedQuery.data.weekId;
  if (!isValidWeekId(weekId)) {
    return NextResponse.json(
      { error: "weekId must be one of week-1, week-2, week-3" },
      { status: 400 }
    );
  }
  const cohortId = readCohortIdFromQuery(
    request.nextUrl.searchParams.get("cohortId")
  );

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const user = await getVerifiedUser(request).catch(() => null);

  const snap = await db
    .collection(SUMMER_COHORT_VOTES_COLLECTION)
    .where("weekId", "==", weekId)
    .get();

  const counts: Record<string, number> = {};
  const myVotes: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!voteDocMatchesCohort(data, cohortId)) continue;
    const handle =
      typeof data.submitterHandle === "string"
        ? data.submitterHandle.toLowerCase()
        : null;
    if (!handle) continue;
    counts[handle] = (counts[handle] ?? 0) + 1;
    if (user && data.voterUid === user.uid) {
      myVotes.push(handle);
    }
  }

  return NextResponse.json(
    {
      weekId,
      cohortId,
      counts,
      myVotes: user ? myVotes : [],
      authenticated: Boolean(user),
    },
    {
      headers: {
        // Counts are dynamic but a few seconds of cache absorbs hot bursts.
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    }
  );
}

/**
 * POST /api/summer-cohort/votes
 * Body: { weekId, submitterHandle }
 *
 * Toggles the requester's vote for the submission. Returns the new state.
 * Auth required.
 */
export async function POST(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = summerCohortContract.votesPost.body.safeParse(body);
  if (!parsedBody.success) {
    const issue = parsedBody.error.issues[0];
    if (issue?.path?.[0] === "submitterHandle") {
      return NextResponse.json(
        { error: "submitterHandle must be a valid GitHub handle" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "weekId must be one of week-1, week-2, week-3" },
      { status: 400 }
    );
  }
  const weekId = parsedBody.data.weekId;
  const submitterHandle = parsedBody.data.submitterHandle;
  // cohortId is optional in the body for back-compat; missing → cohort-1.
  const rawCohort =
    typeof (parsedBody.data as { cohortId?: unknown }).cohortId === "string"
      ? ((parsedBody.data as { cohortId?: string }).cohortId as string)
      : null;
  const cohortId: SummerCohortId = isValidCohortId(rawCohort)
    ? rawCohort
    : "cohort-1";

  if (!isValidWeekId(weekId)) {
    return NextResponse.json(
      { error: "weekId must be one of week-1, week-2, week-3" },
      { status: 400 }
    );
  }
  if (!isValidHandle(submitterHandle)) {
    return NextResponse.json(
      { error: "submitterHandle must be a valid GitHub handle" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const docId = voteDocId(cohortId, weekId, submitterHandle, user.uid);
  const ref = db.collection(SUMMER_COHORT_VOTES_COLLECTION).doc(docId);
  const existing = await ref.get();

  let voted: boolean;
  if (existing.exists) {
    await ref.delete();
    voted = false;
  } else {
    // Cohort 1 docs stay unfielded for back-compat with the millions of
    // existing rows; cohorts 2+ get a `cohortId` field so the GET filter can
    // scope correctly.
    const baseFields = {
      weekId,
      submitterHandle: submitterHandle.toLowerCase(),
      voterUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    };
    await ref.set(
      cohortId === "cohort-1" ? baseFields : { ...baseFields, cohortId }
    );
    voted = true;
  }

  // Recount this submission for the response so the client gets an authoritative
  // post-toggle number rather than relying on optimistic estimation. Need to
  // filter by cohort in-memory since we can't easily compose "field absent OR
  // equal to value" in a single Firestore query.
  const countSnap = await db
    .collection(SUMMER_COHORT_VOTES_COLLECTION)
    .where("weekId", "==", weekId)
    .where("submitterHandle", "==", submitterHandle.toLowerCase())
    .get();
  const count = countSnap.docs.filter((doc) =>
    voteDocMatchesCohort(doc.data(), cohortId)
  ).length;

  return NextResponse.json({
    weekId,
    cohortId,
    submitterHandle: submitterHandle.toLowerCase(),
    voted,
    count,
  });
}
