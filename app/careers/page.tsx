/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const runtime = "nodejs";

import CareersBrowser from "./CareersBrowser";
import { getAdminDb } from "@/lib/firebase-admin";
import { type JobListing } from "@/types/careers";
import demoListings from "@/content/careers-demo.json";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

const PAGE_SIZE = 12;

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

async function getInitialListings(): Promise<{
  listings: JobListing[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  try {
    const db = getAdminDb();
    if (!db) {
      // Demo mode: filter and sort in memory
      let filtered = (demoListings as JobListing[]).filter(
        (l) => l.status === "active"
      );
      filtered.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      });
      const page = filtered.slice(0, PAGE_SIZE);
      const hasMore = filtered.length > PAGE_SIZE;
      const nextCursor =
        hasMore && page.length > 0 ? page[page.length - 1].id : null;
      return { listings: page, hasMore, nextCursor };
    }

    const snap = await db
      .collection("jobListings")
      .where("status", "==", "active")
      .orderBy("featured", "desc")
      .orderBy("postedAt", "desc")
      .limit(PAGE_SIZE + 1)
      .get();

    const docs = snap.docs.slice(0, PAGE_SIZE);
    const listings = docs.map((doc) =>
      mapDocToListing(doc as QueryDocumentSnapshot)
    );
    const hasMore = snap.docs.length > PAGE_SIZE;
    const nextCursor =
      hasMore && listings.length > 0 ? listings[listings.length - 1].id : null;
    return { listings, hasMore, nextCursor };
  } catch {
    return { listings: [], hasMore: false, nextCursor: null };
  }
}

export default async function CareersPage() {
  const { listings, hasMore, nextCursor } = await getInitialListings();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-b from-transparent via-neutral-50/50 dark:via-neutral-950/30 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold rounded-full mb-6 ring-1 ring-emerald-500/20">
            Boston Tech Jobs
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Careers in AI-Native Development
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Boston-area companies looking for Cursor-proficient developers. Browse
            roles where your AI development skills are a first-class requirement.
          </p>
        </div>
      </section>

      {/* Browse */}
      <CareersBrowser
        initialListings={listings}
        initialHasMore={hasMore}
        initialNextCursor={nextCursor}
      />
    </div>
  );
}
