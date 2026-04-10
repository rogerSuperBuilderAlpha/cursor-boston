/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PublicMember, MemberFilters, SortOption, MemberType } from "@/types/members";

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

  // Fetch members on mount
  useEffect(() => {
    async function fetchPublicMembers() {
      if (!db) {
        setLoading(false);
        return;
      }

      try {
        // Fetch human members
        const usersRef = collection(db, "users");
        const usersQuery = query(
          usersRef,
          where("visibility.isPublic", "==", true),
          orderBy("createdAt", "desc")
        );
        const usersSnapshot = await getDocs(usersQuery);
        const humanMembers = usersSnapshot.docs.map((doc) => ({
          uid: doc.id,
          memberType: "human" as MemberType,
          ...doc.data(),
        })) as PublicMember[];

        // Fetch agent members
        const agentsRef = collection(db, "agents");
        const agentsQuery = query(
          agentsRef,
          where("visibility.isPublic", "==", true),
          where("status", "==", "claimed"),
          orderBy("createdAt", "desc")
        );
        const agentsSnapshot = await getDocs(agentsQuery);
        const agentMembers = agentsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            uid: doc.id,
            memberType: "agent" as MemberType,
            displayName: data.name,
            photoURL: data.avatarUrl || null,
            bio: data.description,
            visibility: {
              ...data.visibility,
              showBio: true,
              showMemberSince: true,
            },
            createdAt: data.createdAt,
            owner: data.visibility?.showOwner ? {
              displayName: data.ownerDisplayName,
              email: data.ownerEmail,
            } : undefined,
          } as PublicMember;
        });

        // Combine and sort by creation date
        const allMembers = [...humanMembers, ...agentMembers].sort((a, b) => {
          const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
          const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
          return dateB - dateA;
        });

        setMembers(allMembers);
      } catch (error) {
        console.error("Error fetching members:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicMembers();
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
