/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import type {
  DocumentSnapshot,
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { matchesCookbookSearchTerms } from "@/lib/cookbook-search";
import { sanitizeText, sanitizeDocId } from "@/lib/sanitize";
import {
  COOKBOOK_CATEGORIES,
  WORKS_WITH_LANGUAGES,
  type CookbookCategory,
  type WorksWithTag,
} from "@/types/cookbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKBOOK_SUBMIT_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };

function isValidCategory(v: string): v is CookbookCategory {
  return COOKBOOK_CATEGORIES.includes(v as CookbookCategory);
}

function isValidWorksWith(v: string): v is WorksWithTag {
  return WORKS_WITH_LANGUAGES.includes(v as WorksWithTag);
}

const PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;
const SEARCH_SCAN_BATCH = 40;
const MAX_SEARCH_SCAN = 30;

export type CookbookSort = "newest" | "oldest" | "top";

interface CreateEntryBody {
  title?: string;
  description?: string;
  promptContent?: string;
  category?: string;
  tags?: unknown[];
  worksWith?: unknown[];
}

function isNonNullObject(value: unknown): value is CreateEntryBody {
  return typeof value === "object" && value !== null;
}

function parseSort(raw: string | null): CookbookSort {
  if (raw === "oldest" || raw === "top" || raw === "newest") return raw;
  return "newest";
}

function isFirestoreIndexError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const code = (err as { code?: number }).code;
  const message = String((err as Error).message ?? "");
  return (
    code === 9 ||
    (message.includes("FAILED_PRECONDITION") && message.includes("index"))
  );
}

interface CookbookEntryRow {
  id: string;
  title: string;
  description: string;
  promptContent: string;
  category: string;
  tags: string[];
  worksWith: string[];
  authorId: string;
  authorDisplayName: string;
  createdAt: string;
  upCount: number;
  downCount: number;
}

function mapDocToEntry(doc: QueryDocumentSnapshot): CookbookEntryRow {
  const d = doc.data();
  const upCount = Number(d.upCount ?? 0);
  const downCount = Number(d.downCount ?? 0);
  return {
    id: doc.id,
    title: d.title || "",
    description: d.description || "",
    promptContent: d.promptContent || "",
    category: d.category || "other",
    tags: Array.isArray(d.tags) ? d.tags : [],
    worksWith: Array.isArray(d.worksWith) ? d.worksWith : [],
    authorId: d.authorId || "",
    authorDisplayName: d.authorDisplayName || "",
    createdAt: d.createdAt?.toMillis?.()
      ? new Date(d.createdAt.toMillis()).toISOString()
      : "",
    upCount,
    downCount,
  };
}

function buildFilteredQuery(
  db: Firestore,
  sort: CookbookSort,
  category: string | null,
  worksWith: string | null
): Query {
  let q: Query = db.collection("cookbook_entries");
  if (category && isValidCategory(category)) {
    q = q.where("category", "==", category);
  }
  if (worksWith && isValidWorksWith(worksWith)) {
    q = q.where("worksWith", "array-contains", worksWith);
  }
  if (sort === "top") {
    q = q.orderBy("netScore", "desc").orderBy("createdAt", "desc");
  } else if (sort === "oldest") {
    q = q.orderBy("createdAt", "asc");
  } else {
    q = q.orderBy("createdAt", "desc");
  }
  return q;
}

/** Fetches paginated cookbook entries with optional category, worksWith, search, and sort filters. */
export async function GET(request: NextRequest) {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ entries: [], nextCursor: null, hasMore: false });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const worksWith = searchParams.get("worksWith");
    const searchRaw = searchParams.get("search")?.trim().toLowerCase() || "";
    const limit = Math.min(
      Number(searchParams.get("limit")) || PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const rawCursor = searchParams.get("cursor")?.trim() || null;
    const cursor = rawCursor ? sanitizeDocId(rawCursor) : null;
    const sortParam = parseSort(searchParams.get("sort"));
    const hasSearch = searchRaw.length > 0;
    const sort: CookbookSort = hasSearch ? "newest" : sortParam;
    const searchTerms = hasSearch ? searchRaw.split(/\s+/).filter(Boolean) : [];

    if (hasSearch) {
      const results: CookbookEntryRow[] = [];
      let resumeAfter: DocumentSnapshot | null = null;
      if (cursor) {
        const cdoc = await db.collection("cookbook_entries").doc(cursor).get();
        if (cdoc.exists) {
          resumeAfter = cdoc;
        }
      }

      let iterations = 0;
      let lastSnapSize = 0;
      let exhausted = false;

      while (results.length < limit && !exhausted && iterations < MAX_SEARCH_SCAN) {
        iterations += 1;
        let q = buildFilteredQuery(db, "newest", category, worksWith).limit(
          SEARCH_SCAN_BATCH
        );
        if (resumeAfter) {
          q = q.startAfter(resumeAfter);
        }
        const snap = await q.get();
        lastSnapSize = snap.size;
        if (snap.empty) {
          exhausted = true;
          break;
        }

        for (const doc of snap.docs) {
          resumeAfter = doc;
          const entry = mapDocToEntry(doc);
          if (
            !matchesCookbookSearchTerms(
              entry.title,
              entry.description,
              entry.tags,
              searchTerms
            )
          ) {
            continue;
          }
          results.push(entry);
          if (results.length >= limit) break;
        }

        if (results.length >= limit) {
          break;
        }

        if (snap.size < SEARCH_SCAN_BATCH) {
          exhausted = true;
        }
      }

      const page = results.slice(0, limit);
      const hitScanCap = iterations >= MAX_SEARCH_SCAN;
      const hasMore =
        (page.length === limit &&
          !!resumeAfter?.id &&
          (!exhausted || lastSnapSize === SEARCH_SCAN_BATCH)) ||
        (!exhausted && hitScanCap && lastSnapSize === SEARCH_SCAN_BATCH);

      const nextCursor = hasMore && resumeAfter?.id ? resumeAfter.id : null;

      return NextResponse.json({
        entries: page,
        nextCursor,
        hasMore: !!hasMore,
      });
    }

    const runPagedQuery = async (sortMode: CookbookSort) => {
      let q = buildFilteredQuery(db, sortMode, category, worksWith).limit(
        limit + 1
      );
      if (cursor) {
        const cursorDoc = await db
          .collection("cookbook_entries")
          .doc(cursor)
          .get();
        if (cursorDoc.exists) {
          q = q.startAfter(cursorDoc);
        }
      }
      return q.get();
    };

    let snap;
    try {
      snap = await runPagedQuery(sort);
    } catch (err) {
      if (sort === "top" && isFirestoreIndexError(err)) {
        logger.warn(
          "Cookbook entries: top-sort index missing or building; served in newest order",
          {
            endpoint: "/api/cookbook/entries GET",
            detail: err instanceof Error ? err.message : String(err),
          }
        );
        snap = await runPagedQuery("newest");
      } else {
        throw err;
      }
    }

    const docs = snap.docs.slice(0, limit);
    const entries = docs.map(mapDocToEntry);
    const hasMore = snap.docs.length > limit;
    const nextCursor =
      hasMore && entries.length > 0 ? entries[entries.length - 1].id : null;

    return NextResponse.json({
      entries,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/cookbook/entries GET" });
    return NextResponse.json({ entries: [], nextCursor: null, hasMore: false });
  }
}

/** Creates a new cookbook entry after validating, sanitizing, and rate-limiting the request. */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(
      `cookbook-submit:${clientId}`,
      COOKBOOK_SUBMIT_RATE_LIMIT
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
    const body = rawBody;
    const rawTitle = body.title?.trim() || "";
    const rawDescription = body.description?.trim() || "";
    const rawPromptContent = body.promptContent?.trim() || "";
    const rawCategory = body.category?.trim() || "other";
    const rawTags = Array.isArray(body.tags)
      ? body.tags.filter((t: unknown) => typeof t === "string").slice(0, 10)
      : [];
    const rawWorksWith = Array.isArray(body.worksWith)
      ? body.worksWith.filter((w: unknown) => typeof w === "string")
      : [];

    const title = sanitizeText(rawTitle).slice(0, 200);
    const description = sanitizeText(rawDescription).slice(0, 2000);
    const promptContent = sanitizeText(rawPromptContent).slice(0, 10000);

    if (!title || !description || !promptContent) {
      return NextResponse.json(
        { error: "Title, description, and prompt content are required" },
        { status: 400 }
      );
    }

    const category = isValidCategory(rawCategory) ? rawCategory : "other";
    const tags = rawTags.map((t: string) => sanitizeText(t).slice(0, 50)).filter(Boolean);
    const worksWith = rawWorksWith.filter(isValidWorksWith);

    const entry = {
      title,
      description,
      promptContent,
      category,
      tags,
      worksWith,
      authorId: user.uid,
      authorDisplayName: sanitizeText(user.name || "Anonymous").slice(0, 100) || "Anonymous",
      createdAt: FieldValue.serverTimestamp(),
      upCount: 0,
      downCount: 0,
      netScore: 0,
    };

    const docRef = await db.collection("cookbook_entries").add(entry);

    return NextResponse.json({
      id: docRef.id,
      ...entry,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/cookbook/entries POST" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
