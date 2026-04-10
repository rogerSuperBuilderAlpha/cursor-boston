/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoteType = "up" | "down";

interface VoteBody {
  entryId?: unknown;
  type?: unknown;
}

function isNonNullObject(value: unknown): value is VoteBody {
  return typeof value === "object" && value !== null;
}

const COOKBOOK_VOTE_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };

function userVoteIndexDocId(uid: string, entryId: string) {
  return `${uid}_${entryId}`;
}

/** Processes a vote (add, switch, or remove) on a cookbook entry within a Firestore transaction. */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(
      `cookbook-vote:${clientId}`,
      COOKBOOK_VOTE_RATE_LIMIT
    );
    if (!rateResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfterSeconds: rateResult.retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateResult.retryAfter || 60) },
        }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const rawBody = await request.json();
    if (!isNonNullObject(rawBody)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const entryId = typeof rawBody.entryId === "string" ? rawBody.entryId : undefined;
    const type = rawBody.type;

    const sanitizedEntryId = entryId ? sanitizeDocId(entryId) : null;
    if (
      !sanitizedEntryId ||
      (type !== "up" && type !== "down")
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const voteType = type as VoteType;
    const entryRef = db.collection("cookbook_entries").doc(sanitizedEntryId);
    const voteRef = entryRef.collection("votes").doc(user.uid);
    const indexRef = db
      .collection("cookbook_user_votes")
      .doc(userVoteIndexDocId(user.uid, sanitizedEntryId));

    const result = await db.runTransaction(async (tx) => {
      const [entrySnap, voteSnap] = await Promise.all([
        tx.get(entryRef),
        tx.get(voteRef),
      ]);

      if (!entrySnap.exists) {
        throw new Error("Entry not found");
      }

      const entryData = entrySnap.data() || {};
      const upCount = Number(entryData.upCount || 0);
      const downCount = Number(entryData.downCount || 0);

      if (voteSnap.exists) {
        const existingType = voteSnap.data()?.type as VoteType | undefined;

        // Toggle off: user clicked the same vote type again, so remove the vote entirely
        if (existingType === voteType) {
          tx.delete(voteRef);
          tx.delete(indexRef);
          const updates = {
            upCount: voteType === "up" ? Math.max(0, upCount - 1) : upCount,
            downCount:
              voteType === "down" ? Math.max(0, downCount - 1) : downCount,
            netScore:
              (voteType === "up" ? Math.max(0, upCount - 1) : upCount) -
              (voteType === "down" ? Math.max(0, downCount - 1) : downCount),
          };
          tx.update(entryRef, updates);
          return {
            status: 200 as const,
            body: {
              action: "removed",
              type: voteType,
              upCount: updates.upCount,
              downCount: updates.downCount,
            },
          };
        }

        // Switch: user changed their vote (e.g. up→down), so decrement the old type and increment the new
        tx.update(voteRef, {
          type: voteType,
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.set(
          indexRef,
          {
            userId: user.uid,
            entryId: sanitizedEntryId,
            type: voteType,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        const nextUpCount =
          (existingType === "up" ? Math.max(0, upCount - 1) : upCount) +
          (voteType === "up" ? 1 : 0);
        const nextDownCount =
          (existingType === "down" ? Math.max(0, downCount - 1) : downCount) +
          (voteType === "down" ? 1 : 0);
        tx.update(entryRef, {
          upCount: nextUpCount,
          downCount: nextDownCount,
          netScore: nextUpCount - nextDownCount,
        });
        return {
          status: 200 as const,
          body: {
            action: "switched",
            type: voteType,
            previousType: existingType,
            upCount: nextUpCount,
            downCount: nextDownCount,
          },
        };
      }

      // New vote: no prior vote exists, so create the vote doc and increment the matching count
      tx.set(voteRef, {
        userId: user.uid,
        type: voteType,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(indexRef, {
        userId: user.uid,
        entryId: sanitizedEntryId,
        type: voteType,
        updatedAt: FieldValue.serverTimestamp(),
      });
      const newUpCount = voteType === "up" ? upCount + 1 : upCount;
      const newDownCount = voteType === "down" ? downCount + 1 : downCount;
      tx.update(entryRef, {
        upCount: newUpCount,
        downCount: newDownCount,
        netScore: newUpCount - newDownCount,
      });
      return {
        status: 200 as const,
        body: {
          action: "added",
          type: voteType,
          upCount: newUpCount,
          downCount: newDownCount,
        },
      };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof Error && error.message === "Entry not found") {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    logger.logError(error, { endpoint: "/api/cookbook/vote" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** Returns the authenticated user's vote history for all cookbook entries. */
export async function GET(request: NextRequest) {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ userVotes: {} });
    }

    const userVotes: Record<string, string> = {};
    try {
      const user = await getVerifiedUser(request);
      if (user) {
        const userVotesSnap = await db
          .collection("cookbook_user_votes")
          .where("userId", "==", user.uid)
          .get();
        userVotesSnap.forEach((doc) => {
          const d = doc.data();
          const eid = typeof d.entryId === "string" ? d.entryId : undefined;
          const t = d.type;
          if (eid && (t === "up" || t === "down")) {
            userVotes[eid] = t;
          }
        });
      }
    } catch {
      // unauthenticated
    }

    return NextResponse.json({ userVotes });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/cookbook/vote GET" });
    return NextResponse.json({ userVotes: {} });
  }
}
