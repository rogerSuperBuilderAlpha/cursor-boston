/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { BadgeGrid } from "@/components/badges/BadgeGrid";
import { useProfileContext } from "../_contexts/ProfileContext";

export function EarnedBadgesSection() {
  const { badges } = useProfileContext();
  const {
    eligibilityMap,
    userBadgeMap,
    earnedIds,
    earnedDefinitions,
    loading,
    dataStatus,
    persistenceStatus,
    usingFallback,
  } = badges;

  return (
    <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Earned Badges</h2>
        <Link
          href="/badges"
          className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View all badges
        </Link>
      </div>

      {loading ? (
        <span className="text-xs text-neutral-400">Updating...</span>
      ) : earnedDefinitions.length === 0 ? (
        <div className="text-sm text-neutral-400">
          No badges earned yet. Complete milestones to unlock your first one.
        </div>
      ) : (
        <BadgeGrid
          definitions={earnedDefinitions}
          eligibilityMap={eligibilityMap}
          earnedBadgeIds={earnedIds}
          userBadgeMap={userBadgeMap}
          compact
          layout="horizontal"
          isAuthoritative={dataStatus.isAuthoritative}
        />
      )}

      {dataStatus.state !== "complete" && (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
            dataStatus.state === "failed"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          {dataStatus.message ||
            "Badge data is partially unavailable. Some badge statuses may be unverified."}
          {process.env.NODE_ENV !== "production" &&
            dataStatus.failedSources.length > 0 && (
              <p className="mt-1 text-[11px] opacity-80">
                Debug: failed badge sources: {dataStatus.failedSources.join(", ")}
              </p>
            )}
        </div>
      )}

      {persistenceStatus.state !== "complete" && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            persistenceStatus.state === "failed"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          {persistenceStatus.message ||
            (persistenceStatus.state === "failed"
              ? "We couldn't save some badge updates. Earned dates may be missing. Please refresh or try again."
              : "Some badge updates are still syncing. Earned dates may appear shortly.")}
        </div>
      )}

      {usingFallback && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Badge definitions are using fallback data right now.
        </div>
      )}
    </div>
  );
}
