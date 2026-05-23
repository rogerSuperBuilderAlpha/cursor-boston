/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  CalendarDays,
  DollarSign,
  ExternalLink,
  Mail,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  filterOpportunityListings,
  formatOpportunityType,
  getOpportunityTypeBadgeClass,
  getOpportunityTypeOptions,
  type OpportunityListing,
  type OpportunityWorkModeFilter,
} from "@/lib/opportunity-listings";

function OpportunityCard({ opportunity }: { opportunity: OpportunityListing }) {
  return (
    <article className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span
                className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${getOpportunityTypeBadgeClass(opportunity.type)}`}
              >
                {formatOpportunityType(opportunity.type)}
              </span>
              {opportunity.featured && (
                <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-300">
                  Featured
                </span>
              )}
              {opportunity.remote && (
                <span className="inline-block rounded-full bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-700 dark:text-sky-300">
                  Remote
                </span>
              )}
            </div>
            <h3 className="mb-1 text-2xl font-bold text-foreground md:text-3xl">
              {opportunity.title}
            </h3>
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              {opportunity.company}
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          {opportunity.location && (
            <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <MapPin size={16} aria-hidden="true" />
              <span>{opportunity.location}</span>
            </div>
          )}
          {opportunity.compensation && (
            <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <DollarSign size={16} aria-hidden="true" />
              <span>{opportunity.compensation}</span>
            </div>
          )}
          {opportunity.postedDate && (
            <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <CalendarDays size={16} aria-hidden="true" />
              <span>Posted {opportunity.postedDate}</span>
            </div>
          )}
        </div>

        <p className="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
          {opportunity.description}
        </p>

        {opportunity.aboutCompany && (
          <div className="mb-6">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              About {opportunity.company}
            </h4>
            <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
              {opportunity.aboutCompany}
            </p>
          </div>
        )}

        {opportunity.team && opportunity.team.length > 0 && (
          <div className="mb-6">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              The Team
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              {opportunity.team.map((member) => (
                <div
                  key={member.name}
                  className="rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-700/50 dark:bg-neutral-800/50"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {member.name}
                    </span>
                    <span className="text-neutral-500">&middot;</span>
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {member.role}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {member.bio}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {opportunity.tags && opportunity.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {opportunity.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex shrink-0 flex-wrap gap-2">
            {opportunity.applyUrl && (
              <a
                href={opportunity.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                Apply
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
            {opportunity.contactEmail && (
              <a
                href={`mailto:${opportunity.contactEmail}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                Contact
                <Mail size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function OpportunityListings({
  opportunities,
}: {
  opportunities: OpportunityListing[];
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [workMode, setWorkMode] = useState<OpportunityWorkModeFilter>("all");

  const typeOptions = useMemo(
    () => getOpportunityTypeOptions(opportunities),
    [opportunities]
  );
  const filteredOpportunities = useMemo(
    () => filterOpportunityListings(opportunities, { query, type, workMode }),
    [opportunities, query, type, workMode]
  );
  const hasFilters = query.trim() !== "" || type !== "all" || workMode !== "all";

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">
              Open Opportunities
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Showing {filteredOpportunities.length} of {opportunities.length} listings.
            </p>
          </div>

          {opportunities.length > 0 && (
            <div className="grid w-full gap-3 lg:max-w-3xl lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
              <label className="relative block">
                <span className="sr-only">Search opportunities</span>
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search roles, companies, tags"
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </label>

              <label className="relative block">
                <span className="sr-only">Filter by opportunity type</span>
                <SlidersHorizontal
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                  aria-hidden="true"
                />
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="all">All types</option>
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatOpportunityType(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="sr-only">Filter by work mode</span>
                <select
                  value={workMode}
                  onChange={(event) =>
                    setWorkMode(event.target.value as OpportunityWorkModeFilter)
                  }
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="all">All modes</option>
                  <option value="remote">Remote</option>
                  <option value="in-person">Boston area</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setType("all");
                  setWorkMode("all");
                }}
                disabled={!hasFilters}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <RotateCcw size={15} aria-hidden="true" />
                Reset
              </button>
            </div>
          )}
        </div>

        {opportunities.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p className="mb-4 text-neutral-600 dark:text-neutral-400">
              No opportunities posted yet. Check back soon!
            </p>
          </div>
        ) : filteredOpportunities.length > 0 ? (
          <div className="grid gap-8">
            {filteredOpportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
            <p className="font-medium text-neutral-950 dark:text-white">
              No opportunities match those filters.
            </p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Try a broader search or reset the filters.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
