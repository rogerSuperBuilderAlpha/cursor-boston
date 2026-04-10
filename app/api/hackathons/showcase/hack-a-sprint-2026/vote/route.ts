/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  fetchShowcaseSubmissionsFromGitHub,
} from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import {
  hackASprint2026PeerVoteDocId,
  hackASprint2026ScoreDocId,
  userHasHackASprint2026Signup,
} from "@/lib/hackathon-asprint-2026-state";
import { checkRateLimit, getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOTE_RATE = rateLimitConfigs.hackathonShowcaseVote;

function normalizeIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`hack-asprint-peer-vote:${clientId}`, VOTE_RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429 }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const phase = getHackASprint2026Phase();
    if (phase !== "peerVotingOpen") {
      return NextResponse.json(
        { error: "Peer voting is not open." },
        { status: 403 }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const userSnap = await db.collection("users").doc(user.uid).get();
    const userData = userSnap.data();
    if (userData?.hackASprint2026Unlocked !== true) {
      return NextResponse.json(
        { error: "Enter the event passcode first." },
        { status: 403 }
      );
    }

    const signedUp = await userHasHackASprint2026Signup(db, user.uid);
    if (!signedUp) {
      return NextResponse.json(
        { error: "Website event signup required." },
        { status: 403 }
      );
    }

    let body: { submissionIds?: unknown };
    try {
      body = (await request.json()) as { submissionIds?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const ids = normalizeIds(body.submissionIds);
    if (!ids || ids.length !== 6) {
      return NextResponse.json(
        { error: "Submit exactly 6 distinct project picks." },
        { status: 400 }
      );
    }

    const unique = new Set(ids);
    if (unique.size !== 6) {
      return NextResponse.json(
        { error: "Picks must be 6 different projects." },
        { status: 400 }
      );
    }

    const submissions = await fetchShowcaseSubmissionsFromGitHub();
    const allowed = new Set(submissions.map((s) => s.submissionId));
    for (const id of ids) {
      if (!allowed.has(id)) {
        return NextResponse.json({ error: `Unknown submission: ${id}` }, { status: 400 });
      }
    }

    const githubData =
      userData?.github && typeof userData.github === "object"
        ? (userData.github as { login?: string })
        : undefined;
    const ghLogin =
      typeof githubData?.login === "string"
        ? githubData.login.trim().toLowerCase()
        : "";
    if (ghLogin && ids.some((id) => id === ghLogin)) {
      return NextResponse.json(
        { error: "You cannot pick your own submission." },
        { status: 400 }
      );
    }

    const uidRate = checkRateLimit(`hack-asprint-peer-vote-uid:${user.uid}`, VOTE_RATE);
    if (!uidRate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: uidRate.retryAfter },
        { status: 429 }
      );
    }

    const voteRef = db
      .collection("hackathonASprint2026PeerVotes")
      .doc(hackASprint2026PeerVoteDocId(user.uid));
    await db.runTransaction(async (tx) => {
      const prevSnap = await tx.get(voteRef);
      const prevData = prevSnap.data();
      const prevSubmissionIds = prevData?.submissionIds;
      const oldIds: string[] = Array.isArray(prevSubmissionIds)
        ? (prevSubmissionIds as string[]).map((x) =>
            String(x).toLowerCase()
          )
        : [];

      const oldSet = new Set(oldIds);
      const newSet = new Set(ids);

      for (const sid of oldSet) {
        if (!newSet.has(sid)) {
          const scoreRef = db
            .collection("hackathonShowcaseScores")
            .doc(hackASprint2026ScoreDocId(sid));
          tx.set(
            scoreRef,
            {
              peerVoteCount: FieldValue.increment(-1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      for (const sid of newSet) {
        if (!oldSet.has(sid)) {
          const scoreRef = db
            .collection("hackathonShowcaseScores")
            .doc(hackASprint2026ScoreDocId(sid));
          tx.set(
            scoreRef,
            {
              eventId: HACK_A_SPRINT_2026_EVENT_ID,
              submissionId: sid,
              peerVoteCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      tx.set(voteRef, {
        eventId: HACK_A_SPRINT_2026_EVENT_ID,
        userId: user.uid,
        submissionIds: ids,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true, submissionIds: ids });
  } catch (e) {
    console.error("[hack-a-sprint peer vote]", e);
    return NextResponse.json({ error: "Vote failed" }, { status: 500 });
  }
}
