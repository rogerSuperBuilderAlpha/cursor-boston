/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { sanitizeDocId } from "@/lib/sanitize";
import { JOB_TYPES, EXPERIENCE_LEVELS, type JobListing, type JobType, type ExperienceLevel } from "@/types/careers";
import demoListings from "@/content/careers-demo.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;

function applyDemoFilters(
  listings: JobListing[],
  remote: string | null,
  type: string | null,
  experienceLevel: string | null,
  featured: string | null,
  id: string | null,
  limit: number,
  cursor: string | null
): { listings: JobListing[]; nextCursor: string | null; hasMore: boolean } | { listing: JobListing } | { error: string } {
  if (id) {
    const listing = listings.find((l) => l.id === id && l.status === "active");
    if (!listing) return { error: "Not found" };
    return { listing };
  }

  let filtered = listings.filter((l) => l.status === "active");
  if (remote === "true") filtered = filtered.filter((l) => l.remote);
  if (type && JOB_TYPES.includes(type as JobType)) filtered = filtered.filter((l) => l.type === type);
  if (experienceLevel && EXPERIENCE_LEVELS.includes(experienceLevel as ExperienceLevel))
    filtered = filtered.filter((l) => l.experienceLevel === experienceLevel);
  if (featured === "true") filtered = filtered.filter((l) => l.featured);

  // Sort: featured first, then by postedAt desc
  filtered.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });

  const cursorIdx = cursor ? filtered.findIndex((l) => l.id === cursor) : -1;
  const start = cursorIdx >= 0 ? cursorIdx + 1 : 0;
  const page = filtered.slice(start, start + limit);
  const hasMore = start + limit < filtered.length;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;
  return { listings: page, nextCursor, hasMore };
}

function mapDocToListing(doc: QueryDocumentSnapshot): JobListing {
  const d = doc.data();
  return {
    id: doc.id,
    title: d.title || "",
    company: d.company || "",
    description: d.description || "",
    location: d.location || "",
    type: d.type || "full-time",
    experienceLevel: d.experienceLevel || "any",
    salaryMin: typeof d.salaryMin === "number" ? d.salaryMin : undefined,
    salaryMax: typeof d.salaryMax === "number" ? d.salaryMax : undefined,
    remote: !!d.remote,
    tags: Array.isArray(d.tags) ? d.tags : [],
    applyUrl: typeof d.applyUrl === "string" ? d.applyUrl : undefined,
    postedById: d.postedById || "",
    postedAt: d.postedAt?.toMillis?.()
      ? new Date(d.postedAt.toMillis()).toISOString()
      : "",
    featured: !!d.featured,
    status: d.status || "active",
  };
}

/** Fetches paginated active job listings with optional filters, or a single listing by id. */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id")?.trim() || null;
    const remoteParam = searchParams.get("remote");
    const typeParam = searchParams.get("type");
    const experienceLevelParam = searchParams.get("experienceLevel");
    const featuredParam = searchParams.get("featured");
    const limit = Math.min(
      Number(searchParams.get("limit")) || PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const rawCursor = searchParams.get("cursor")?.trim() || null;
    const cursor = rawCursor ? sanitizeDocId(rawCursor) : null;

    const db = getAdminDb();
    if (!db) {
      // Demo mode: serve static fixture data
      const result = applyDemoFilters(
        demoListings as JobListing[],
        remoteParam, typeParam, experienceLevelParam, featuredParam,
        id, limit, cursor
      );
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    // Single-doc id lookup (Firestore path)
    if (id) {
      const safeId = sanitizeDocId(id);
      if (!safeId) {
        return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
      }
      const doc = await db.collection("jobListings").doc(safeId).get();
      if (!doc.exists || doc.data()?.status !== "active") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ listing: mapDocToListing(doc as QueryDocumentSnapshot) });
    }

    // List fetch with filters
    let q = db
      .collection("jobListings")
      .where("status", "==", "active") as FirebaseFirestore.Query;

    if (remoteParam === "true") {
      q = q.where("remote", "==", true);
    }
    if (typeParam && JOB_TYPES.includes(typeParam as JobType)) {
      q = q.where("type", "==", typeParam);
    }
    if (
      experienceLevelParam &&
      EXPERIENCE_LEVELS.includes(experienceLevelParam as ExperienceLevel)
    ) {
      q = q.where("experienceLevel", "==", experienceLevelParam);
    }
    if (featuredParam === "true") {
      q = q.where("featured", "==", true);
    }

    q = q.orderBy("featured", "desc").orderBy("postedAt", "desc").limit(limit + 1);

    if (cursor) {
      const cursorDoc = await db.collection("jobListings").doc(cursor).get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }

    const snap = await q.get();
    const docs = snap.docs.slice(0, limit);
    const listings = docs.map((doc) => mapDocToListing(doc as QueryDocumentSnapshot));
    const hasMore = snap.docs.length > limit;
    const nextCursor =
      hasMore && listings.length > 0 ? listings[listings.length - 1].id : null;

    return NextResponse.json({ listings, nextCursor, hasMore });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/careers/listings GET" });
    return NextResponse.json({ listings: [], nextCursor: null, hasMore: false });
  }
}
