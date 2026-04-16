/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import type { PublicMember, MemberFilters, SortOption } from "@/types/members";

function revivePublicMember(raw: PublicMember): PublicMember {
  const c = raw.createdAt as unknown;
  if (typeof c === "string") {
    return {
      ...raw,
      createdAt: { toDate: () => new Date(c) },
    };
  }
  return raw;
}

const defaultFilters: MemberFilters = {
  hasDiscord: false,
  hasLinkedIn: false,
  hasTwitter: false,
  hasGithub: false,
  hasSubstack: false,
  hasWebsite: false,
  memberType: "all",
};

export function useMembers(initialSearch: string = "") {
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filters, setFilters] = useState<MemberFilters>(defaultFilters);
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // Load via cached API (avoids N client Firestore reads per visitor).
  useEffect(() => {
    async function fetchPublicMembers() {
      try {
        const res = await fetch("/api/members/public");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as { members?: PublicMember[] };
        const list = Array.isArray(body.members) ? body.members : [];
        setMembers(list.map(revivePublicMember));
      } catch (error) {
        console.error("Error fetching members:", error);
      } finally {
        setLoading(false);
      }
    }

    void fetchPublicMembers();
  }, []);

  // Filter and sort members
  const filteredAndSortedMembers = useMemo(() => {
    let result = [...members];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((member) => {
        const searchableFields = [
          member.displayName,
          member.bio,
          member.location,
          member.company,
          member.jobTitle,
        ].filter(Boolean);
        return searchableFields.some((field) =>
          field?.toLowerCase().includes(query)
        );
      });
    }

    // Apply member type filter
    if (filters.memberType !== "all") {
      result = result.filter((m) => m.memberType === filters.memberType);
    }

    // Apply link filters (only for humans, agents don't have these)
    if (filters.hasDiscord) {
      result = result.filter((m) => m.discord?.username);
    }
    if (filters.hasLinkedIn) {
      result = result.filter((m) => m.socialLinks?.linkedIn);
    }
    if (filters.hasTwitter) {
      result = result.filter((m) => m.socialLinks?.twitter);
    }
    if (filters.hasGithub) {
      result = result.filter((m) => m.socialLinks?.github);
    }
    if (filters.hasSubstack) {
      result = result.filter((m) => m.socialLinks?.substack);
    }
    if (filters.hasWebsite) {
      result = result.filter((m) => m.socialLinks?.website);
    }

    // Apply sorting
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
          const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
          return dateB - dateA;
        });
        break;
      case "oldest":
        result.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
          const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
          return dateA - dateB;
        });
        break;
      case "mostTalks":
        result.sort((a, b) => (b.talksGiven || 0) - (a.talksGiven || 0));
        break;
      case "mostEvents":
        result.sort((a, b) => (b.eventsAttended || 0) - (a.eventsAttended || 0));
        break;
      case "mostPRs":
        result.sort((a, b) => (b.pullRequestsCount || 0) - (a.pullRequestsCount || 0));
        break;
      case "name":
        result.sort((a, b) => {
          const nameA = a.displayName?.toLowerCase() || "";
          const nameB = b.displayName?.toLowerCase() || "";
          return nameA.localeCompare(nameB);
        });
        break;
    }

    return result;
  }, [members, searchQuery, filters, sortBy]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "memberType") return value !== "all";
      return Boolean(value);
    }).length;
  }, [filters]);

  // Clear all filters
  const clearFilters = () => {
    setFilters(defaultFilters);
    setSearchQuery("");
  };

  return {
    members,
    loading,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    filteredAndSortedMembers,
    activeFilterCount,
    clearFilters,
  };
}
