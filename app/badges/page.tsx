/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getBadgeEligibilityData,
  type BadgeEligibilityDataStatus,
} from "@/lib/badges/getBadgeEligibilityInput";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import {
  ensureUserBadgesForEligibleWithStatus,
  getUserBadgeMap,
  type BadgeAwardPersistenceStatus,
  type UserBadgeMap,
} from "@/lib/badges/data";
import type { BadgeEligibilityMap } from "@/lib/badges/types";
import { getEarnedBadgeIds } from "@/lib/badges/utils";
import { BadgeGrid } from "@/components/badges/BadgeGrid";
import type { BadgeDefinition } from "@/lib/badges/types";

export default function BadgesPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [eligibilityMap, setEligibilityMap] = useState<BadgeEligibilityMap | undefined>(undefined);
  const [userBadgeMap, setUserBadgeMap] = useState<UserBadgeMap>({});
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [badgeDefinitions, setBadgeDefinitions] = useState<BadgeDefinition[]>(BADGE_DEFINITIONS);
  const [usingFallbackDefinitions, setUsingFallbackDefinitions] = useState(false);
  const [badgeDataStatus, setBadgeDataStatus] = useState<BadgeEligibilityDataStatus>({
    state: "failed",
    isAuthoritative: false,
    failedSources: [],
  });
  const [badgePersistenceStatus, setBadgePersistenceStatus] =
    useState<BadgeAwardPersistenceStatus>({ state: "complete" });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/badges");
    }
  }, [loading, user, router]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/badges/definitions", { cache: "no-store" });
        if (!response.ok) {
          setUsingFallbackDefinitions(true);
          return;
        }
        const data = (await response.json()) as {
          definitions?: BadgeDefinition[];
          source?: "firestore" | "seeded-fallback" | "local-fallback";
        };
        if (Array.isArray(data.definitions) && data.definitions.length > 0) {
          setBadgeDefinitions(data.definitions);
        }
        setUsingFallbackDefinitions(data.source !== "firestore");
      } catch {
        // Keep local fallback definitions
        setUsingFallbackDefinitions(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      setEligibilityMap(undefined);
      setUserBadgeMap({});
      setBadgeDataStatus({
        state: "failed",
        isAuthoritative: false,
        failedSources: [],
      });
      setBadgePersistenceStatus({ state: "complete" });
      return;
    }

    setLoadingBadges(true);
    (async () => {
      try {
        const badgeData = await getBadgeEligibilityData({
          uid: user.uid,
          displayName: userProfile?.displayName ?? user.displayName ?? null,
          visibility: userProfile?.visibility ?? null,
          bio: userProfile?.bio ?? null,
          photoURL: userProfile?.photoURL ?? user.photoURL ?? null,
          discord: userProfile?.discord,
          github: userProfile?.github,
        });
        const evaluated = evaluateBadgeEligibility(badgeData.input);
        const persisted = await getUserBadgeMap(user.uid);
        const persistenceResult = await ensureUserBadgesForEligibleWithStatus(
          user.uid,
          evaluated,
          persisted
        );
        setEligibilityMap(evaluated);
        setUserBadgeMap(persistenceResult.userBadgeMap);
        setBadgeDataStatus(badgeData.status);
        setBadgePersistenceStatus(persistenceResult.status);
      } catch (err) {
        console.error("Error loading badge eligibility:", err);
        setEligibilityMap(evaluateBadgeEligibility({}));
        setUserBadgeMap({});
        setBadgeDataStatus({
          state: "failed",
          isAuthoritative: false,
          failedSources: [],
          message: "Badge data could not be loaded right now.",
        });
        setBadgePersistenceStatus({
          state: "failed",
          message: "Badge awards could not be saved right now.",
        });
      } finally {
        setLoadingBadges(false);
      }
    })();
  }, [user, userProfile]);

  const earnedBadgeIds = getEarnedBadgeIds(
    badgeDefinitions,
    eligibilityMap,
    userBadgeMap
  );
  const earnedCount = earnedBadgeIds.length;
  const totalCount = badgeDefinitions.length;

  if (loading || !user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neutral-900 dark:border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-6xl mx-auto">
        <section className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Achievement Badges</h1>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl">
            Track your milestones across profile completion, community participation, events, and contributions.
          </p>
        </section>

        <section className="mb-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm">
            <span className="text-foreground font-medium">{earnedCount}</span>
            <span className="text-neutral-600 dark:text-neutral-400">earned</span>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-600 dark:text-neutral-400">{totalCount} total</span>
          </div>
        </section>

        {usingFallbackDefinitions && (
          <section className="mb-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              Badge definitions are using fallback data right now.
            </div>
          </section>
        )}

        {badgeDataStatus.state !== "complete" && (
          <section className="mb-4">
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                badgeDataStatus.state === "failed"
                  ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              {badgeDataStatus.message ||
                "Badge data is partially unavailable. Some badge statuses may be unverified."}
              {process.env.NODE_ENV !== "production" &&
                badgeDataStatus.failedSources.length > 0 && (
                  <p className="mt-1 text-[11px] opacity-80">
                    Debug: failed badge sources: {badgeDataStatus.failedSources.join(", ")}
                  </p>
                )}
            </div>
          </section>
        )}

        {badgePersistenceStatus.state !== "complete" && (
          <section className="mb-4">
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                badgePersistenceStatus.state === "failed"
                  ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              {badgePersistenceStatus.message ||
                (badgePersistenceStatus.state === "failed"
                  ? "We couldn’t save some badge updates. Earned dates may be missing. Please refresh or try again."
                  : "Some badge updates are still syncing. Earned dates may appear shortly.")}
            </div>
          </section>
        )}

        <section className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Your Progress</h2>
            {loadingBadges && <span className="text-xs text-neutral-400">Updating...</span>}
          </div>

          <BadgeGrid
            definitions={badgeDefinitions}
            eligibilityMap={eligibilityMap}
            earnedBadgeIds={earnedBadgeIds}
            userBadgeMap={userBadgeMap}
            isAuthoritative={badgeDataStatus.isAuthoritative}
          />
        </section>
      </div>
    </div>
  );
}
