/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, X } from "lucide-react";
import { CursorIcon } from "@/components/icons";
import { useAuth } from "@/contexts/AuthContext";
import { LaunchPanel } from "./_components/LaunchPanel";
import { RunDetail } from "./_components/RunDetail";
import { RunsRail } from "./_components/RunsRail";
import { useIdeaRuns } from "./_hooks/useIdeaRuns";
import { emptyIdeaForm, type LaunchFormState } from "./_lib/types";

function planSummary(monthlyCapUsd: number): string {
  if (monthlyCapUsd === 0) return "Unlimited";
  return `$${monthlyCapUsd}/mo`;
}

const LAUNCH_DRAFT_PREFIX = "pr-studio-launch-draft:";
const ONBOARDING_PREFIX = "pr-studio-onboarding-dismissed:";

function loadLaunchDraft(uid: string): LaunchFormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LAUNCH_DRAFT_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LaunchFormState>;
    return {
      ...emptyIdeaForm(),
      ...parsed,
      interests: parsed.interests ?? [],
      skills: parsed.skills ?? [],
      preferredArea: parsed.preferredArea ?? [],
      constraints: parsed.constraints ?? [],
      freeform: typeof parsed.freeform === "string" ? parsed.freeform : "",
      mode: parsed.mode === "issue" ? "issue" : "idea",
      issue: parsed.issue ?? null,
    };
  } catch {
    return null;
  }
}

export default function PrIdeasPage() {
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();
  const cursorInfo = userProfile?.cursor ?? null;
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchForm, setLaunchForm] = useState<LaunchFormState>(() => emptyIdeaForm());
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const {
    runs,
    selectedRun,
    selectedRunId,
    setSelectedRunId,
    hasRuns,
    loadingState,
    runAction,
    syncingRunId,
    error,
    runErrors,
    githubIssues,
    githubIssuesLoading,
    githubIssuesError,
    loadRuns,
    loadGithubIssues,
    launchIdeaRun,
    refreshRun,
    mutateRun,
    advanceWorkflow,
    clearError,
  } = useIdeaRuns({ user, cursorConnected: Boolean(cursorInfo) });

  useEffect(() => {
    if (!user?.uid) return;
    const draft = loadLaunchDraft(user.uid);
    startTransition(() => {
      if (draft) setLaunchForm(draft);
      try {
        setOnboardingDismissed(
          typeof window !== "undefined" &&
            window.localStorage.getItem(`${ONBOARDING_PREFIX}${user.uid}`) === "1"
        );
      } catch {
        setOnboardingDismissed(false);
      }
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`${LAUNCH_DRAFT_PREFIX}${user.uid}`, JSON.stringify(launchForm));
    } catch {
      /* ignore quota */
    }
  }, [launchForm, user?.uid]);

  const dismissOnboarding = () => {
    if (!user?.uid) return;
    try {
      window.localStorage.setItem(`${ONBOARDING_PREFIX}${user.uid}`, "1");
    } catch {
      /* ignore */
    }
    setOnboardingDismissed(true);
  };

  const connectedLabel = useMemo(() => {
    if (!cursorInfo) return "Checking Cursor connection";
    return cursorInfo.apiKeyFingerprint;
  }, [cursorInfo]);

  const billingChip = useMemo(() => {
    if (!cursorInfo) return null;
    return (
      <>
        <span className="min-w-0 truncate">
          Plan: {planSummary(cursorInfo.monthlyCapUsd)}
          {/* TODO: surface `usedUsd` from profile/API when available for “Used: $X.XX”. */}
        </span>
        <Link href="/profile/cursor" className="shrink-0 text-emerald-600 hover:text-emerald-500 dark:text-emerald-300 dark:hover:text-emerald-200">
          Manage
        </Link>
      </>
    );
  }, [cursorInfo]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?redirect=/pr-ideas");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!loading && user && userProfile && !cursorInfo) {
      router.replace("/profile/cursor?return=/pr-ideas");
    }
  }, [cursorInfo, loading, router, user, userProfile]);

  useEffect(() => {
    if (!loading && cursorInfo && loadingState === "idle" && !hasRuns) {
      const timeoutId = window.setTimeout(() => setLaunchOpen(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [cursorInfo, hasRuns, loading, loadingState]);

  const authOrInitialLoading = loading || Boolean(user && !userProfile);
  const pageLoadingState = authOrInitialLoading ? "initial" : loadingState;

  const showOnboardingStrip =
    Boolean(cursorInfo) && !hasRuns && !onboardingDismissed && !authOrInitialLoading;

  const mainGridClass =
    launchOpen && cursorInfo
      ? "grid items-start gap-4 lg:grid-cols-1 xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
      : "grid items-start gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]";

  return (
    <main className="min-h-[80vh] px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        <section className="rounded-2xl border border-neutral-200 bg-background/90 px-4 py-3 shadow-xl shadow-black/10 dark:border-neutral-800 dark:bg-neutral-950/90 dark:shadow-black/20 md:px-5 md:py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <Bot size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">PR Studio</h1>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                  Generate ideas and ship a reviewable PR with a Cursor Cloud Agent.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {billingChip && (
                <div className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                  <CursorIcon size={14} className="shrink-0" />
                  {billingChip}
                </div>
              )}
              {!cursorInfo && (
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  <CursorIcon size={14} />
                  <span className="truncate">{connectedLabel}</span>
                </div>
              )}
              {!launchOpen && (
                <button
                  type="button"
                  onClick={() => setLaunchOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-emerald-300"
                  aria-expanded={launchOpen}
                  aria-controls="pr-ideas-launch-panel"
                >
                  <Plus size={14} />
                  New PR idea
                </button>
              )}
            </div>
          </div>
        </section>

        {showOnboardingStrip && (
          <div className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-950 dark:text-sky-100">
            <p className="min-w-0 flex-1">
              PR Studio runs a Cursor Cloud Agent for you: it explores the repo, asks you questions, plans a
              change, builds it, and opens a PR. Pick a starting point below.
            </p>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="shrink-0 rounded-lg border border-sky-400/40 p-1.5 hover:bg-sky-500/20"
              aria-label="Dismiss intro"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {error && !launchOpen && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-950 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                clearError();
                if (selectedRunId) {
                  void refreshRun(selectedRunId);
                } else if (cursorInfo) {
                  void loadRuns(true, "refreshing");
                }
              }}
              disabled={!cursorInfo}
              className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-900 dark:text-red-100 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        )}

        {launchOpen && cursorInfo && (
          <LaunchPanel
            open={launchOpen}
            hasRuns={hasRuns}
            launching={runAction === "launch"}
            form={launchForm}
            setForm={setLaunchForm}
            launchError={error}
            onDismissError={clearError}
            issues={githubIssues}
            issuesLoading={githubIssuesLoading}
            issuesError={githubIssuesError}
            onToggle={() => {
              setLaunchOpen((current) => !current);
              clearError();
            }}
            onLoadIssues={loadGithubIssues}
            onLaunch={async (form) => {
              const run = await launchIdeaRun(form);
              if (run) {
                setLaunchOpen(false);
                setLaunchForm(emptyIdeaForm());
                return true;
              }
              return false;
            }}
          />
        )}

        {launchOpen && cursorInfo && (
          <p className="text-center text-xs xl:hidden">
            <a href="#pr-studio-run-detail" className="text-emerald-600 hover:underline dark:text-emerald-300">
              Back to selected run
            </a>
          </p>
        )}

        <div className={mainGridClass}>
          <RunsRail
            runs={runs}
            selectedRunId={selectedRunId}
            loadingState={pageLoadingState}
            onSelect={setSelectedRunId}
          />
          <RunDetail
            key={selectedRun?.id ?? "empty"}
            run={selectedRun}
            loadingState={pageLoadingState}
            runAction={runAction}
            syncingRunId={syncingRunId}
            error={selectedRun ? runErrors[selectedRun.id] : null}
            onRefresh={refreshRun}
            onMutate={mutateRun}
            onAdvanceWorkflow={advanceWorkflow}
          />
        </div>
      </div>
    </main>
  );
}
