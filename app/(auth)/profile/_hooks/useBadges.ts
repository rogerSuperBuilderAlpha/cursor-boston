/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/contexts/AuthContext";
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
import type { BadgeDefinition, BadgeEligibilityMap } from "@/lib/badges/types";
import { getEarnedBadgeIds } from "@/lib/badges/utils";

export function useBadges(user: User | null, userProfile: UserProfile | null) {
  const [eligibilityMap, setEligibilityMap] = useState<BadgeEligibilityMap | undefined>(undefined);
  const [userBadgeMap, setUserBadgeMap] = useState<UserBadgeMap>({});
  const [loading, setLoading] = useState(false);
  const [definitions, setDefinitions] = useState<BadgeDefinition[]>(BADGE_DEFINITIONS);
  const [usingFallback, setUsingFallback] = useState(false);
  const [dataStatus, setDataStatus] = useState<BadgeEligibilityDataStatus>({
    state: "failed",
    isAuthoritative: false,
    failedSources: [],
  });
  const [persistenceStatus, setPersistenceStatus] =
    useState<BadgeAwardPersistenceStatus>({ state: "complete" });

  // Fetch Firestore-backed badge definitions
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/badges/definitions", { cache: "no-store" });
        if (!response.ok) {
          setUsingFallback(true);
          return;
        }
        const data = (await response.json()) as {
          definitions?: BadgeDefinition[];
          source?: "firestore" | "seeded-fallback" | "local-fallback";
        };
        if (Array.isArray(data.definitions) && data.definitions.length > 0) {
          setDefinitions(data.definitions);
        }
        setUsingFallback(data.source !== "firestore");
      } catch {
        setUsingFallback(true);
      }
    })();
  }, []);

  // Evaluate eligibility and persist awards
  useEffect(() => {
    if (!user) {
      setEligibilityMap(undefined);
      setUserBadgeMap({});
      setDataStatus({ state: "failed", isAuthoritative: false, failedSources: [] });
      setPersistenceStatus({ state: "complete" });
      return;
    }

    setLoading(true);
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
        setDataStatus(badgeData.status);
        setPersistenceStatus(persistenceResult.status);
      } catch (err) {
        console.error("Error evaluating badge eligibility:", err);
        setEligibilityMap(evaluateBadgeEligibility({}));
        setUserBadgeMap({});
        setDataStatus({
          state: "failed",
          isAuthoritative: false,
          failedSources: [],
          message: "Badge data could not be loaded right now.",
        });
        setPersistenceStatus({
          state: "failed",
          message: "Badge awards could not be saved right now.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, userProfile]);

  // Derived values
  const earnedIds = getEarnedBadgeIds(definitions, eligibilityMap, userBadgeMap);
  const earnedDefinitions = definitions.filter((d) => earnedIds.includes(d.id));

  return {
    definitions,
    eligibilityMap,
    userBadgeMap,
    earnedIds,
    earnedDefinitions,
    loading,
    dataStatus,
    persistenceStatus,
    usingFallback,
  };
}
