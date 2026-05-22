/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Link from "next/link";
import {
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  ScrollText,
  Tag,
  Users,
} from "lucide-react";
import {
  RESEARCH_TYPE_LABEL,
  isRecruiting,
  isPreprint,
  isDataset,
  isRecruitingPastDeadline,
  type ResearchEntry,
} from "@/lib/research";

interface ResearchCardProps {
  entry: ResearchEntry;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeFromNow(iso: string, now: Date = new Date()): string {
  const target = new Date(iso).getTime();
  const diffMs = target - now.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays > 1 && diffDays < 30) return `in ${diffDays} days`;
  if (diffDays < -1 && diffDays > -30) return `${Math.abs(diffDays)} days ago`;
  return formatDate(iso);
}

function TypeBadge({ entry }: { entry: ResearchEntry }) {
  const styles: Record<typeof entry.type, string> = {
    recruiting:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    preprint:
      "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
    dataset:
      "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${styles[entry.type]}`}
    >
      {RESEARCH_TYPE_LABEL[entry.type]}
    </span>
  );
}

function MetadataRow({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
      {children}
    </div>
  );
}

function MetaItem({
  icon: Icon,
  children,
  emphasis = false,
  strike = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  emphasis?: boolean;
  strike?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        emphasis
          ? "font-semibold text-neutral-900 dark:text-neutral-100"
          : ""
      } ${strike ? "line-through opacity-60" : ""}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

export function ResearchCard({ entry }: ResearchCardProps) {
  const detailHref = `/research/${entry.slug}`;
  const isExpired = isRecruiting(entry) && isRecruitingPastDeadline(entry);
  const isClosed = isRecruiting(entry) && entry.status === "closed";

  return (
    <article
      className={`group flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 ${
        isExpired || isClosed ? "opacity-75" : ""
      }`}
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <TypeBadge entry={entry} />
        <span className="text-xs text-neutral-500 dark:text-neutral-500">
          {formatDate(entry.updatedAt ?? entry.postedAt)}
          {entry.updatedAt ? " · updated" : ""}
        </span>
      </header>

      <Link
        href={detailHref}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <h3 className="text-base font-semibold leading-snug text-neutral-900 transition-colors group-hover:text-emerald-700 dark:text-neutral-100 dark:group-hover:text-emerald-400">
          {entry.title}
        </h3>
      </Link>

      <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400">
        {entry.authors
          .map((a) =>
            a.affiliation ? `${a.name} (${a.affiliation})` : a.name
          )
          .join(" · ")}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {entry.summary}
      </p>

      {isRecruiting(entry) ? (
        <MetadataRow>
          <MetaItem
            icon={Calendar}
            emphasis={!isExpired}
            strike={isExpired}
          >
            {isExpired ? "Closed " : "Deadline "}
            {relativeFromNow(entry.deadline)}
          </MetaItem>
          <MetaItem icon={Clock}>{entry.timeCommitment}</MetaItem>
          <MetaItem icon={MapPin}>{entry.location}</MetaItem>
          {typeof entry.slotsRemaining === "number" ? (
            <MetaItem icon={Users}>
              {entry.slotsRemaining} slots left
            </MetaItem>
          ) : null}
        </MetadataRow>
      ) : null}

      {isPreprint(entry) ? (
        <MetadataRow>
          <MetaItem icon={ScrollText}>
            {entry.version} · {entry.license}
          </MetaItem>
          {entry.peerReviewStatus ? (
            <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
              {entry.peerReviewStatus.replace(/-/g, " ")}
            </span>
          ) : null}
          <a
            href={entry.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </a>
        </MetadataRow>
      ) : null}

      {isDataset(entry) ? (
        <MetadataRow>
          <MetaItem icon={Tag} emphasis>
            {entry.license}
          </MetaItem>
          {entry.size ? <MetaItem icon={FileText}>{entry.size}</MetaItem> : null}
          {entry.format && entry.format.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              {entry.format.map((f) => (
                <span
                  key={f}
                  className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  {f}
                </span>
              ))}
            </span>
          ) : null}
        </MetadataRow>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {entry.disciplines.slice(0, 4).map((d) => (
          <span
            key={d}
            className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
        <Link
          href={detailHref}
          className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Details →
        </Link>
        <a
          href={entry.sourceRepoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ExternalLink className="h-3 w-3" /> Source repo
        </a>
      </div>
    </article>
  );
}
