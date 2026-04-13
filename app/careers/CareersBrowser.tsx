/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Building2, MapPin, Clock, Star, DollarSign } from "lucide-react";
import { JOB_TYPES, EXPERIENCE_LEVELS, type JobListing, type JobType, type ExperienceLevel } from "@/types/careers";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  any: "Any level",
};

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function JobCard({ job }: { job: JobListing }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  return (
    <Link
      href={`/careers/${job.id}`}
      className="group block rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
            {job.title}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
            <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="truncate">{job.company}</span>
          </p>
        </div>
        {job.featured && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold ring-1 ring-amber-300 dark:ring-amber-700">
            <Star className="h-3 w-3" strokeWidth={2} aria-hidden />
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {job.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {JOB_TYPE_LABELS[job.type] ?? job.type}
        </span>
        {salary && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {salary}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-block px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium">
          {EXPERIENCE_LABELS[job.experienceLevel] ?? job.experienceLevel}
        </span>
        {job.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium ring-1 ring-emerald-200 dark:ring-emerald-800"
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

interface Props {
  initialListings: JobListing[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
}

/** Client component: handles filter interactions and load-more. Initial data comes from server. */
export default function CareersBrowser({ initialListings, initialHasMore, initialNextCursor }: Props) {
  const [listings, setListings] = useState<JobListing[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);

  const [remote, setRemote] = useState(false);
  const [jobType, setJobType] = useState<JobType | "">("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | "">("");

  // Track whether any filter has been changed from the defaults
  const hasActiveFilters = remote || !!jobType || !!experienceLevel;

  const fetchListings = useCallback(
    async (append = false, cursor: string | null = null) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "12");
        if (remote) params.set("remote", "true");
        if (jobType) params.set("type", jobType);
        if (experienceLevel) params.set("experienceLevel", experienceLevel);
        if (append && cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/careers/listings?${params.toString()}`);
        if (res.ok) {
          const data = (await res.json()) as {
            listings?: JobListing[];
            nextCursor?: string | null;
            hasMore?: boolean;
          };
          const list = data.listings ?? [];
          setListings((prev) => (append ? [...prev, ...list] : list));
          setNextCursor(data.nextCursor ?? null);
          setHasMore(!!data.hasMore);
        }
      } catch {
        if (!append) setListings([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [remote, jobType, experienceLevel]
  );

  // Only re-fetch when filters change (not on initial mount — server already provided data)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    void fetchListings();
  }, [fetchListings, mounted]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return;
    void fetchListings(true, nextCursor);
  }, [hasMore, loadingMore, nextCursor, fetchListings]);

  return (
    <section className="py-12 md:py-16 px-6">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="lg:w-56 shrink-0">
          <div className="sticky top-24 space-y-6 p-5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Filters
            </h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={remote}
                onChange={(e) => setRemote(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-emerald-500 focus:ring-emerald-400"
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Remote only
              </span>
            </label>
            <div>
              <label htmlFor="careers-type" className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                Job type
              </label>
              <select
                id="careers-type"
                value={jobType}
                onChange={(e) => setJobType(e.target.value as JobType | "")}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">All types</option>
                {JOB_TYPES.map((t) => (
                  <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="careers-experience" className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                Experience
              </label>
              <select
                id="careers-experience"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel | "")}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">All levels</option>
                {EXPERIENCE_LEVELS.map((l) => (
                  <option key={l} value={l}>{EXPERIENCE_LABELS[l]}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => { setRemote(false); setJobType(""); setExperienceLevel(""); }}
                className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
              >
                Clear filters
              </button>
            )}
          </div>
        </aside>

        {/* Job grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Open Roles</h2>
            {!loading && (
              <span className="text-sm text-neutral-500">
                {listings.length} listing{listings.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-20">
              <Building2 className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-700 mb-4" strokeWidth={1.5} />
              <p className="text-neutral-600 dark:text-neutral-400 text-lg">
                {hasActiveFilters
                  ? "No listings match your filters. Try adjusting them."
                  : "No job listings yet. Check back soon!"}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => { setRemote(false); setJobType(""); setExperienceLevel(""); }}
                  className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {listings.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 rounded-xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium hover:bg-neutral-300 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-emerald-500" />
                        Loading…
                      </span>
                    ) : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
