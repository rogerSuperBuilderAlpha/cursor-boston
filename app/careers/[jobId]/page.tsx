/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const runtime = "nodejs";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, Clock, Star, DollarSign } from "lucide-react";
import { getAdminDb } from "@/lib/firebase-admin";
import { type JobListing } from "@/types/careers";
import demoListings from "@/content/careers-demo.json";

import ApplySection from "./ApplySection";

const JOB_TYPE_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};

const EXPERIENCE_LABELS: Record<string, string> = {
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

async function getJob(jobId: string): Promise<JobListing | null> {
  try {
    const db = getAdminDb();
    if (!db) {
      return (
        (demoListings as JobListing[]).find(
          (l) => l.id === jobId && l.status === "active"
        ) ?? null
      );
    }

    const doc = await db.collection("jobListings").doc(jobId).get();
    if (!doc.exists || doc.data()?.status !== "active") return null;

    const d = doc.data()!;
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
    } as JobListing;
  } catch {
    return null;
  }
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job) notFound();

  const salary = formatSalary(job.salaryMin, job.salaryMax);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Back link */}
      <Link
        href="/careers"
        className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-foreground transition-colors mb-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to Careers
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            {job.title}
          </h1>
          {job.featured && (
            <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-semibold ring-1 ring-amber-300 dark:ring-amber-700">
              <Star className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Featured
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" strokeWidth={2} aria-hidden />
            {job.company}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" strokeWidth={2} aria-hidden />
            {job.location}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" strokeWidth={2} aria-hidden />
            {JOB_TYPE_LABELS[job.type] ?? job.type}
          </span>
          {salary && (
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" strokeWidth={2} aria-hidden />
              {salary}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="inline-block px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-medium">
            {EXPERIENCE_LABELS[job.experienceLevel] ?? job.experienceLevel}
          </span>
          {job.tags.map((tag) => (
            <span
              key={tag}
              className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium ring-1 ring-emerald-200 dark:ring-emerald-800"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="prose prose-neutral dark:prose-invert max-w-none mb-12">
        <h2 className="text-xl font-semibold text-foreground mb-4">About this role</h2>
        <div className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {job.description}
        </div>
      </div>

      <hr className="border-neutral-200 dark:border-neutral-800 mb-12" />

      {/* Apply section */}
      <section aria-label="Apply for this job">
        <h2 className="text-2xl font-bold text-foreground mb-6">Apply</h2>
        <ApplySection jobId={job.id} applyUrl={job.applyUrl} />
      </section>
    </div>
  );
}
