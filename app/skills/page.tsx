/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  GraduationCap,
  Target,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BadgeGrid } from "@/components/badges/BadgeGrid";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import type { BadgeEligibilityDataStatus } from "@/lib/badges/getBadgeEligibilityInput";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import {
  ensureUserBadgesForEligibleWithStatus,
  type BadgeAwardPersistenceStatus,
  type UserBadgeMap,
} from "@/lib/badges/data";
import type { BadgeDefinition, BadgeEligibilityMap } from "@/lib/badges/types";
import type { ProfileDataApiResponse } from "@/lib/profile-data-types";
import { buildSkillsPassportSummary } from "@/lib/skills-passport";
import { cn } from "@/lib/utils";

function getGithubLogin(profile: unknown): string {
  if (!profile || typeof profile !== "object" || !("github" in profile)) {
    return "";
  }

  const github = (profile as { github?: unknown }).github;
  if (!github || typeof github !== "object" || !("login" in github)) {
    return "";
  }

  const login = (github as { login?: unknown }).login;
  return typeof login === "string" ? login.trim() : "";
}

export default function SkillsPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [badgeDefinitions, setBadgeDefinitions] =
    useState<BadgeDefinition[]>(BADGE_DEFINITIONS);
  const [usingFallbackDefinitions, setUsingFallbackDefinitions] = useState(false);
  const [eligibilityMap, setEligibilityMap] = useState<
    BadgeEligibilityMap | undefined
  >(undefined);
  const [userBadgeMap, setUserBadgeMap] = useState<UserBadgeMap>({});
  const [loadingPassport, setLoadingPassport] = useState(false);
  const [badgeDataStatus, setBadgeDataStatus] =
    useState<BadgeEligibilityDataStatus>({
      state: "failed",
      isAuthoritative: false,
      failedSources: [],
    });
  const [badgePersistenceStatus, setBadgePersistenceStatus] =
    useState<BadgeAwardPersistenceStatus>({ state: "complete" });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/skills");
    }
  }, [loading, router, user]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/badges/definitions", {
          cache: "no-store",
        });
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
        setUsingFallbackDefinitions(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset derived auth-scoped state on sign-out
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

    setLoadingPassport(true);
    void (async () => {
      try {
        const headers = { Authorization: `Bearer ${await user.getIdToken()}` };
        let response = await fetch("/api/profile/data", { headers });
        if (!response.ok) {
          throw new Error(`profile data HTTP ${response.status}`);
        }

        let profileData = (await response.json()) as ProfileDataApiResponse;
        const githubLogin = getGithubLogin(userProfile);
        if (githubLogin && (profileData.stats.pullRequestsCount ?? 0) === 0) {
          response = await fetch("/api/profile/data?reconcileGithub=1", {
            headers: { Authorization: `Bearer ${await user.getIdToken()}` },
          });
          if (response.ok) {
            profileData = (await response.json()) as ProfileDataApiResponse;
          }
        }

        const evaluated = evaluateBadgeEligibility(
          profileData.badgeEligibility.input
        );
        const persistenceResult = await ensureUserBadgesForEligibleWithStatus(
          user.uid,
          evaluated,
          profileData.userBadgeMap as UserBadgeMap
        );

        setEligibilityMap(evaluated);
        setUserBadgeMap(persistenceResult.userBadgeMap);
        setBadgeDataStatus(profileData.badgeEligibility.status);
        setBadgePersistenceStatus(persistenceResult.status);
      } catch (error) {
        console.error("Error loading skills passport:", error);
        setEligibilityMap(evaluateBadgeEligibility({}));
        setUserBadgeMap({});
        setBadgeDataStatus({
          state: "failed",
          isAuthoritative: false,
          failedSources: [],
          message: "Skills passport data could not be loaded right now.",
        });
        setBadgePersistenceStatus({
          state: "failed",
          message: "Badge awards could not be saved right now.",
        });
      } finally {
        setLoadingPassport(false);
      }
    })();
  }, [user, userProfile]);

  const passport = useMemo(
    () =>
      buildSkillsPassportSummary(
        badgeDefinitions,
        eligibilityMap,
        userBadgeMap
      ),
    [badgeDefinitions, eligibilityMap, userBadgeMap]
  );

  if (loading || !user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-neutral-900 dark:border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <BrainCircuit className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-3xl font-bold text-foreground md:text-4xl">
                Skills Passport
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400 md:text-base">
                Track AI-assisted development progress through earned community
                badges and verified activity signals.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryStat
              icon={<Award className="h-4 w-4" aria-hidden="true" />}
              label="Badges earned"
              value={`${passport.earnedCount}/${passport.totalCount}`}
            />
            <SummaryStat
              icon={<Target className="h-4 w-4" aria-hidden="true" />}
              label="Passport progress"
              value={`${passport.percent}%`}
            />
            <SummaryStat
              icon={<GraduationCap className="h-4 w-4" aria-hidden="true" />}
              label="Tracks active"
              value={String(passport.tracks.length)}
            />
          </div>
        </section>

        {(usingFallbackDefinitions ||
          badgeDataStatus.state !== "complete" ||
          badgePersistenceStatus.state !== "complete") && (
          <section className="mb-6 space-y-3">
            {usingFallbackDefinitions && (
              <StatusNotice tone="warning">
                Badge definitions are using fallback data right now.
              </StatusNotice>
            )}
            {badgeDataStatus.state !== "complete" && (
              <StatusNotice
                tone={badgeDataStatus.state === "failed" ? "error" : "warning"}
              >
                {badgeDataStatus.message ||
                  "Some passport signals are temporarily unavailable."}
              </StatusNotice>
            )}
            {badgePersistenceStatus.state !== "complete" && (
              <StatusNotice
                tone={
                  badgePersistenceStatus.state === "failed" ? "error" : "warning"
                }
              >
                {badgePersistenceStatus.message ||
                  "Some earned badge updates are still syncing."}
              </StatusNotice>
            )}
          </section>
        )}

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Skill Tracks
            </h2>
            {loadingPassport && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Updating...
              </span>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {passport.tracks.map((track) => (
              <article
                key={track.id}
                className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {track.name}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {track.description}
                    </p>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                    {track.earnedCount}/{track.totalCount}
                  </span>
                </div>
                <ProgressBar value={track.percent} label={track.name} />
                <div className="mt-4 flex flex-wrap gap-2">
                  {track.badges.map((badge) => {
                    const earned = passport.earnedBadgeIds.includes(badge.id);
                    return (
                      <span
                        key={badge.id}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                          earned
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400"
                        )}
                      >
                        {earned ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <CircleDashed className="h-3.5 w-3.5" />
                        )}
                        {badge.name}
                      </span>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                Skill Evidence
              </h2>
              <Link
                href="/badges"
                className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"
              >
                View all badges
              </Link>
            </div>
            <BadgeGrid
              definitions={badgeDefinitions}
              eligibilityMap={eligibilityMap}
              earnedBadgeIds={passport.earnedBadgeIds}
              userBadgeMap={userBadgeMap}
              isAuthoritative={badgeDataStatus.isAuthoritative}
            />
          </div>

          <aside className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold text-foreground">
              Next Milestones
            </h2>
            <div className="mt-4 space-y-4">
              {passport.nextMilestones.length > 0 ? (
                passport.nextMilestones.map((milestone) => (
                  <div key={milestone.badge.id}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {milestone.badge.name}
                        </p>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                          {milestone.reason}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                        {milestone.current}/{milestone.target}{" "}
                        {milestone.unit}
                      </span>
                    </div>
                    <ProgressBar
                      value={milestone.percent}
                      label={milestone.badge.name}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Every badge-backed track is complete.
                </p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      aria-label={`${label} progress`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-emerald-600"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function StatusNotice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        tone === "error"
          ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      )}
      role="status"
    >
      {children}
    </div>
  );
}
