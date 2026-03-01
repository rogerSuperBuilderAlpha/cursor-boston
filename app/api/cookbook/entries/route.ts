import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
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

interface CreateEntryBody {
  title?: string;
  description?: string;
  promptContent?: string;
  category?: string;
  tags?: unknown[];
  worksWith?: unknown[];
}

function isCreateEntryBody(value: unknown): value is CreateEntryBody {
  return typeof value === "object" && value !== null;
}

export async function GET(request: NextRequest) {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ entries: [], nextCursor: null, hasMore: false });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const worksWith = searchParams.get("worksWith");
    const search = searchParams.get("search")?.trim().toLowerCase();
    const limit = Math.min(
      Number(searchParams.get("limit")) || PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const cursor = searchParams.get("cursor")?.trim() || null;

    const hasFilters = !!(category && isValidCategory(category)) ||
      !!(worksWith && isValidWorksWith(worksWith)) ||
      !!search;
    const fetchSize = hasFilters ? Math.min(limit * 4, 80) : limit + 1;

    let query = db
      .collection("cookbook_entries")
      .orderBy("createdAt", "desc")
      .limit(fetchSize);

    if (cursor) {
      const cursorDoc = await db.collection("cookbook_entries").doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snap = await query.get();

    let entries = snap.docs.map((doc) => {
      const d = doc.data();
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
        upCount: Number(d.upCount ?? 0),
        downCount: Number(d.downCount ?? 0),
      };
    });

    if (category && isValidCategory(category)) {
      entries = entries.filter((e) => e.category === category);
    }
    if (worksWith && isValidWorksWith(worksWith)) {
      entries = entries.filter((e) =>
        e.worksWith.some((w) => w.toLowerCase() === worksWith.toLowerCase())
      );
    }
    if (search) {
      const terms = search.split(/\s+/).filter(Boolean);
      entries = entries.filter((e) => {
        const titleL = e.title.toLowerCase();
        const descL = e.description.toLowerCase();
        const tagStr = e.tags.join(" ").toLowerCase();
        return terms.some((term) =>
          titleL.includes(term) ||
          descL.includes(term) ||
          tagStr.includes(term)
        );
      });
    }

    const page = entries.slice(0, limit);
    const hasMore = entries.length > limit || snap.docs.length === fetchSize;
    const nextCursor = page.length > 0 ? page[page.length - 1].id : null;

    return NextResponse.json({
      entries: page,
      nextCursor: hasMore && nextCursor ? nextCursor : null,
      hasMore: hasMore && page.length === limit,
    });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/cookbook/entries GET" });
    return NextResponse.json({ entries: [], nextCursor: null, hasMore: false });
  }
}

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
    if (!isCreateEntryBody(rawBody)) {
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
