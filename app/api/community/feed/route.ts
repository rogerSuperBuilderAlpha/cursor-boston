/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import type { DocumentData, Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getOptionalVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import {
  clampLimit,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  parseCursor,
} from "@/lib/firestore-pagination";
import { communityContract } from "@/lib/api-schemas/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 120 };
const MAX_SCAN_DOCS = 250;

function timestampToIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : new Date(0).toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
  }
  return new Date(0).toISOString();
}

async function getBlockedAuthorIds(db: Firestore, uid?: string): Promise<Set<string>> {
  if (!uid) return new Set();
  const snap = await db
    .collection("userBlocks")
    .doc(uid)
    .collection("blocked")
    .limit(500)
    .get();

  return new Set(
    snap.docs
      .map((doc) => {
        const data = doc.data();
        return typeof data.targetUid === "string" ? data.targetUid : doc.id;
      })
      .filter(Boolean)
  );
}

async function getSuspendedAuthorIds(db: Firestore, authorIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(authorIds)].filter(Boolean);
  if (uniqueIds.length === 0) return new Set();

  const snaps = await Promise.all(
    uniqueIds.map((authorId) => db.collection("users").doc(authorId).get())
  );
  return new Set(
    snaps
      .filter((snap) => snap.exists && snap.data()?.suspended === true)
      .map((snap) => snap.id)
  );
}

function isRequestedThread(data: DocumentData, parentId: string | null): boolean {
  if (parentId) return data.parentId === parentId;
  return !data.parentId;
}

function toFeedMessage(doc: QueryDocumentSnapshot) {
  const data = doc.data();
  return {
    id: doc.id,
    content: typeof data.content === "string" ? data.content : "",
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    authorName: typeof data.authorName === "string" ? data.authorName : "Anonymous",
    authorPhoto: typeof data.authorPhoto === "string" ? data.authorPhoto : null,
    createdAt: timestampToIso(data.createdAt),
    ...(typeof data.parentId === "string" ? { parentId: data.parentId } : {}),
    ...(data.repostOf && typeof data.repostOf === "object" ? { repostOf: data.repostOf } : {}),
    likeCount: typeof data.likeCount === "number" ? data.likeCount : 0,
    dislikeCount: typeof data.dislikeCount === "number" ? data.dislikeCount : 0,
    replyCount: typeof data.replyCount === "number" ? data.replyCount : 0,
    repostCount: typeof data.repostCount === "number" ? data.repostCount : 0,
    bookmarkCount: typeof data.bookmarkCount === "number" ? data.bookmarkCount : 0,
  };
}

async function filterVisibleDocs(
  db: Firestore,
  docs: QueryDocumentSnapshot[],
  blockedAuthorIds: Set<string>
): Promise<QueryDocumentSnapshot[]> {
  const notHidden = docs.filter((doc) => doc.data().hidden !== true);
  const suspendedAuthorIds = await getSuspendedAuthorIds(
    db,
    notHidden.map((doc) => doc.data().authorId).filter((id): id is string => typeof id === "string")
  );

  return notHidden.filter((doc) => {
    const authorId = doc.data().authorId;
    return (
      typeof authorId === "string" &&
      !blockedAuthorIds.has(authorId) &&
      !suspendedAuthorIds.has(authorId)
    );
  });
}

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`community-feed:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const parsed = communityContract.feed.query.safeParse({
      cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      parentId: request.nextUrl.searchParams.get("parentId") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

    const user = await getOptionalVerifiedUser(request);
    const blockedAuthorIds = await getBlockedAuthorIds(db, user?.uid);
    const limit = clampLimit(parsed.data.limit, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
    const parentId = parsed.data.parentId ?? null;
    const requestedCursor = parseCursor(parsed.data.cursor);

    const messagesRef = db.collection("communityMessages");
    let lastScannedDoc: QueryDocumentSnapshot | null = null;
    let lastReturnedDoc: QueryDocumentSnapshot | null = null;
    let cursorDoc: QueryDocumentSnapshot | null = null;

    if (requestedCursor) {
      const snap = await messagesRef.doc(requestedCursor).get();
      if (snap.exists) cursorDoc = snap as QueryDocumentSnapshot;
    }

    const messages: ReturnType<typeof toFeedMessage>[] = [];
    const orderDirection = parentId ? "asc" : "desc";
    let scanned = 0;
    let hasMore = false;

    while (messages.length < limit && scanned < MAX_SCAN_DOCS) {
      const batchSize = Math.min(Math.max(limit * 2, 20), MAX_SCAN_DOCS - scanned);
      let q = messagesRef.orderBy("createdAt", orderDirection).limit(batchSize);
      const startAfterDoc = lastScannedDoc ?? cursorDoc;
      if (startAfterDoc) q = q.startAfter(startAfterDoc);

      const snap = await q.get();
      if (snap.docs.length === 0) {
        hasMore = false;
        break;
      }

      scanned += snap.docs.length;
      lastScannedDoc = snap.docs[snap.docs.length - 1] ?? lastScannedDoc;
      hasMore = snap.docs.length === batchSize;

      const threadDocs = snap.docs.filter((doc) => isRequestedThread(doc.data(), parentId));
      const visibleDocs = await filterVisibleDocs(db, threadDocs, blockedAuthorIds);

      for (const doc of visibleDocs) {
        if (messages.length >= limit) {
          hasMore = true;
          break;
        }
        messages.push(toFeedMessage(doc));
        lastReturnedDoc = doc;
      }

      if (!hasMore || messages.length >= limit) break;
    }

    if (scanned >= MAX_SCAN_DOCS && messages.length < limit && lastScannedDoc) {
      hasMore = true;
    }

    const cursorSource = lastReturnedDoc ?? lastScannedDoc;
    return NextResponse.json(
      {
        messages,
        nextCursor: hasMore && cursorSource ? cursorSource.id : null,
        hasMore,
      },
      { headers: { "Cache-Control": "private, max-age=15" } }
    );
  } catch (error) {
    logger.logError(error, { endpoint: "/api/community/feed", area: "community-safety" });
    return NextResponse.json({ error: "Failed to load feed" }, { status: 500 });
  }
}
