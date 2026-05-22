/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Mail,
  MessageSquare,
} from "lucide-react";
import {
  RESEARCH_REPO_README_URL,
  RESEARCH_TYPE_LABEL,
  isDataset,
  isPreprint,
  isRecruiting,
  isRecruitingPastDeadline,
  loadAllResearchEntries,
  repoFileUrlForSlug,
  type ResearchEntry,
} from "@/lib/research";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return loadAllResearchEntries().map(({ entry }) => ({ slug: entry.slug }));
}

function getEntry(slug: string): ResearchEntry | null {
  const all = loadAllResearchEntries();
  return all.find((l) => l.entry.slug === slug)?.entry ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) return { title: "Research entry not found" };
  return {
    title: `${entry.title} — Research`,
    description: entry.summary,
    alternates: { canonical: `https://cursorboston.com/research/${entry.slug}` },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function TypeBadge({ type }: { type: ResearchEntry["type"] }) {
  const styles: Record<ResearchEntry["type"], string> = {
    recruiting:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    preprint: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    dataset:
      "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${styles[type]}`}
    >
      {RESEARCH_TYPE_LABEL[type]}
    </span>
  );
}

function MetaTable({
  rows,
}: {
  rows: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-5 text-sm dark:border-neutral-800 dark:bg-neutral-900/50 sm:grid-cols-[max-content_1fr]">
      {rows.map((r, i) => (
        <div
          key={i}
          className="contents sm:contents"
        >
          <dt className="font-semibold text-neutral-700 dark:text-neutral-300">
            {r.label}
          </dt>
          <dd className="text-neutral-800 dark:text-neutral-200">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ResearchEntryPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) notFound();

  const fileUrl = repoFileUrlForSlug(entry.slug);
  const isExpired = isRecruiting(entry) && isRecruitingPastDeadline(entry);
  const isClosed = isRecruiting(entry) && entry.status === "closed";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/research"
        className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Research
      </Link>

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={entry.type} />
          {isRecruiting(entry) && entry.status === "paused" ? (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Paused
            </span>
          ) : null}
          {isClosed ? (
            <span className="rounded-md bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              Closed
            </span>
          ) : null}
          {isExpired && !isClosed ? (
            <span className="rounded-md bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              Past deadline
            </span>
          ) : null}
          {isPreprint(entry) && entry.peerReviewStatus ? (
            <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
              {entry.peerReviewStatus.replace(/-/g, " ")}
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-neutral-900 dark:text-neutral-100">
          {entry.title}
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {entry.authors.map((a, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-700 hover:underline dark:hover:text-emerald-400"
                >
                  {a.name}
                </a>
              ) : (
                a.name
              )}
              {a.affiliation ? (
                <span className="text-neutral-500"> ({a.affiliation})</span>
              ) : null}
            </span>
          ))}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Posted {formatDate(entry.postedAt)}
          {entry.updatedAt
            ? ` · Updated ${formatDate(entry.updatedAt)}`
            : ""}
        </p>
      </header>

      <section className="prose prose-neutral mb-6 max-w-none text-neutral-800 dark:prose-invert dark:text-neutral-200">
        <p>{entry.summary}</p>
      </section>

      {isRecruiting(entry) ? (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Study details
          </h2>
          <MetaTable
            rows={[
              {
                label: "Deadline",
                value: (
                  <span className={isExpired ? "line-through opacity-70" : ""}>
                    {formatDateTime(entry.deadline)}
                  </span>
                ),
              },
              { label: "Compensation", value: entry.compensation },
              { label: "Time commitment", value: entry.timeCommitment },
              {
                label: "Location",
                value: <span className="capitalize">{entry.location}</span>,
              },
              { label: "Eligibility", value: entry.eligibility },
              ...(typeof entry.slotsRemaining === "number"
                ? [
                    {
                      label: "Slots remaining",
                      value: `${entry.slotsRemaining}`,
                    },
                  ]
                : []),
              ...(entry.irb
                ? [
                    {
                      label: "IRB",
                      value: `${entry.irb.institution} — Protocol #${entry.irb.protocolNumber}`,
                    },
                  ]
                : []),
            ]}
          />
          {entry.studyUrl && !isExpired && !isClosed ? (
            <a
              href={entry.studyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              <Globe className="h-4 w-4" /> Go to study
            </a>
          ) : null}
        </section>
      ) : null}

      {isPreprint(entry) ? (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Paper details
          </h2>
          <MetaTable
            rows={[
              { label: "Version", value: entry.version },
              { label: "License", value: entry.license },
              ...(entry.doi ? [{ label: "DOI", value: entry.doi }] : []),
              ...(entry.peerReviewStatus
                ? [
                    {
                      label: "Peer review",
                      value: entry.peerReviewStatus.replace(/-/g, " "),
                    },
                  ]
                : []),
            ]}
          />
          <a
            href={entry.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
          >
            <FileText className="h-4 w-4" /> Read PDF
          </a>
        </section>
      ) : null}

      {isDataset(entry) ? (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Dataset details
          </h2>
          <MetaTable
            rows={[
              { label: "License", value: entry.license },
              ...(entry.size ? [{ label: "Size", value: entry.size }] : []),
              ...(entry.format && entry.format.length > 0
                ? [{ label: "Formats", value: entry.format.join(", ") }]
                : []),
              ...(entry.doi ? [{ label: "DOI", value: entry.doi }] : []),
            ]}
          />
          {entry.citation ? (
            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Citation
              </p>
              <p className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
                {entry.citation}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Where the content lives
        </h2>
        <p className="mb-3 text-sm text-neutral-700 dark:text-neutral-300">
          Cursor Boston hosts the metadata — the actual files, materials,
          and documentation live in the researcher&apos;s own GitHub repo.
        </p>
        <a
          href={entry.sourceRepoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <GitBranch className="h-4 w-4" /> {entry.sourceRepoUrl.replace(/^https?:\/\//, "")}
          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
        </a>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Contact & discussion
        </h2>
        <div className="flex flex-wrap gap-3">
          {entry.contactEmail ? (
            <a
              href={`mailto:${entry.contactEmail}`}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <Mail className="h-4 w-4" /> {entry.contactEmail}
            </a>
          ) : null}
          {entry.contactUrl ? (
            <a
              href={entry.contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <Globe className="h-4 w-4" /> Contact link
            </a>
          ) : null}
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          >
            <MessageSquare className="h-4 w-4" /> Discuss via PR / issue
          </a>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Community discussion happens through pull requests against this
          entry&apos;s JSON file, or as issues / PRs on the researcher&apos;s
          linked source repo. See the{" "}
          <a
            href={RESEARCH_REPO_README_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 hover:underline dark:text-emerald-400"
          >
            submission guide
          </a>{" "}
          for the review process.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Disciplines
        </h2>
        <div className="flex flex-wrap gap-2">
          {entry.disciplines.map((d) => (
            <span
              key={d}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {d}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
