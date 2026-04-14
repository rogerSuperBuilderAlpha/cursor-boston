/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/contexts/AuthContext";
import type { BadgeEligibilityDataStatus } from "@/lib/badges/getBadgeEligibilityInput";
import type { ProfileDataApiResponse } from "@/lib/profile-data-types";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import {
  ensureUserBadgesForEligibleWithStatus,
  type BadgeAwardPersistenceStatus,
  type UserBadgeMap,
} from "@/lib/badges/data";
import type { BadgeDefinition, BadgeEligibilityMap } from "@/lib/badges/types";
import { getEarnedBadgeIds } from "@/lib/badges/utils";

export function useBadges(
  user: User | null,
  _userProfile: UserProfile | null,
  profileBundle: ProfileDataApiResponse | null
) {
  void _userProfile;
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

  useEffect(() => {
    if (!user) {
      setEligibilityMap(undefined);
      setUserBadgeMap({});
      setDataStatus({ state: "failed", isAuthoritative: false, failedSources: [] });
      setPersistenceStatus({ state: "complete" });
      setLoading(false);
      return;
    }

    if (!profileBundle) {
      setLoading(true);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const badgeData = profileBundle.badgeEligibility;
        const evaluated = evaluateBadgeEligibility(badgeData.input);
        const persistenceResult = await ensureUserBadgesForEligibleWithStatus(
          user.uid,
          evaluated,
          profileBundle.userBadgeMap as UserBadgeMap
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
  }, [user, profileBundle]);

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
