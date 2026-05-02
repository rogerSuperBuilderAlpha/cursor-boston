/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { type NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { SUMMER_COHORT_VOTES_COLLECTION } from "@/lib/summer-cohort";

const VALID_WEEK_IDS = new Set(["week-1", "week-2", "week-3"]);

/**
 * Simple, deterministic doc ID so a (weekId, submitterHandle, voterUid) triple
 * resolves to exactly one Firestore document. Toggling = create-if-absent /
 * delete-if-present.
 */
function voteDocId(
  weekId: string,
  submitterHandle: string,
  voterUid: string
): string {
  return `${weekId}__${submitterHandle.toLowerCase()}__${voterUid}`;
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
  const weekId = request.nextUrl.searchParams.get("weekId");
  if (!isValidWeekId(weekId)) {
    return NextResponse.json(
      { error: "weekId must be one of week-1, week-2, week-3" },
      { status: 400 }
    );
  }

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

  const obj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const weekId = obj.weekId;
  const submitterHandle = obj.submitterHandle;

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

  const docId = voteDocId(weekId, submitterHandle, user.uid);
  const ref = db.collection(SUMMER_COHORT_VOTES_COLLECTION).doc(docId);
  const existing = await ref.get();

  let voted: boolean;
  if (existing.exists) {
    await ref.delete();
    voted = false;
  } else {
    await ref.set({
      weekId,
      submitterHandle: submitterHandle.toLowerCase(),
      voterUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    voted = true;
  }

  // Recount this submission for the response so the client gets an authoritative
  // post-toggle number rather than relying on optimistic estimation.
  const countSnap = await db
    .collection(SUMMER_COHORT_VOTES_COLLECTION)
    .where("weekId", "==", weekId)
    .where("submitterHandle", "==", submitterHandle.toLowerCase())
    .count()
    .get();

  return NextResponse.json({
    weekId,
    submitterHandle: submitterHandle.toLowerCase(),
    voted,
    count: countSnap.data().count,
  });
}
