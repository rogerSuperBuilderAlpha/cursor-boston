/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export type OpportunityWorkModeFilter = "all" | "remote" | "in-person";

export interface OpportunityTeamMember {
  name: string;
  role: string;
  bio: string;
}

export interface OpportunityListing {
  id: string;
  slug?: string;
  title: string;
  company: string;
  type: string;
  compensation?: string;
  location?: string;
  remote?: boolean;
  postedDate?: string;
  description: string;
  aboutCompany?: string;
  team?: OpportunityTeamMember[];
  tags?: string[];
  contactEmail?: string | null;
  applyUrl?: string | null;
  featured?: boolean;
}

export interface OpportunityFilters {
  query?: string;
  type?: string;
  workMode?: OpportunityWorkModeFilter;
}

export function formatOpportunityType(type: string): string {
  switch (type) {
    case "cofounder":
      return "Co-Founder";
    case "full-time":
      return "Full-Time";
    case "part-time":
      return "Part-Time";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

export function getOpportunityTypeBadgeClass(type: string): string {
  switch (type) {
    case "cofounder":
      return "bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "full-time":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "contract":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "internship":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-300";
    default:
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-500/10 dark:text-neutral-300";
  }
}

export function getOpportunityTypeOptions(
  opportunities: readonly OpportunityListing[]
): string[] {
  return Array.from(new Set(opportunities.map((opportunity) => opportunity.type))).sort(
    (a, b) => formatOpportunityType(a).localeCompare(formatOpportunityType(b))
  );
}

function normalizeQuery(query: string | undefined): string {
  return query?.trim().toLowerCase() ?? "";
}

function matchesQuery(opportunity: OpportunityListing, query: string): boolean {
  if (!query) return true;
  const haystack = [
    opportunity.title,
    opportunity.company,
    opportunity.type,
    opportunity.compensation,
    opportunity.location,
    opportunity.description,
    opportunity.aboutCompany,
    ...(opportunity.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesWorkMode(
  opportunity: OpportunityListing,
  workMode: OpportunityWorkModeFilter | undefined
): boolean {
  if (!workMode || workMode === "all") return true;
  if (workMode === "remote") return opportunity.remote === true;
  return opportunity.remote !== true;
}

export function filterOpportunityListings(
  opportunities: readonly OpportunityListing[],
  filters: OpportunityFilters
): OpportunityListing[] {
  const query = normalizeQuery(filters.query);
  return opportunities.filter(
    (opportunity) =>
      matchesQuery(opportunity, query) &&
      (!filters.type || filters.type === "all" || opportunity.type === filters.type) &&
      matchesWorkMode(opportunity, filters.workMode)
  );
}
