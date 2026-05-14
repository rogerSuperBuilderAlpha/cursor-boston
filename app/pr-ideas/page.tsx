/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus } from "lucide-react";
import { CursorIcon } from "@/components/icons";
import { useAuth } from "@/contexts/AuthContext";
import { LaunchPanel } from "./_components/LaunchPanel";
import { RunDetail } from "./_components/RunDetail";
import { RunsRail } from "./_components/RunsRail";
import { useIdeaRuns } from "./_hooks/useIdeaRuns";

function capLabel(value?: number): string {
  if (value === undefined) return "Cap not set";
  return value === 0 ? "Unlimited cap" : `$${value}/mo cap`;
}

export default function PrIdeasPage() {
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();
  const cursorInfo = userProfile?.cursor ?? null;
  const [launchOpen, setLaunchOpen] = useState(false);

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
  } = useIdeaRuns({ user, cursorConnected: Boolean(cursorInfo) });

  const connectedLabel = useMemo(() => {
    if (!cursorInfo) return "Checking Cursor connection";
    return `${cursorInfo.apiKeyFingerprint} · ${capLabel(cursorInfo.monthlyCapUsd)}`;
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

  return (
    <main className="min-h-[80vh] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-950/90 p-5 shadow-2xl shadow-black/20 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <Bot size={22} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">
                  Cursor Boston workflow
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  PR Idea Explorer
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-neutral-400">
                  Launch a Cursor Cloud Agent, watch the run, and turn your interests into
                  small reviewable contribution ideas, run the build, and submit a PR.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300">
                <CursorIcon size={16} />
                <span>{connectedLabel}</span>
                <Link href="/profile/cursor" className="text-emerald-300 hover:text-emerald-200">
                  Manage
                </Link>
              </div>
              {!launchOpen && (
                <button
                  type="button"
                  onClick={() => setLaunchOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-300"
                  aria-expanded={launchOpen}
                  aria-controls="pr-ideas-launch-panel"
                >
                  <Plus size={16} />
                  Start from source
                </button>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                if (selectedRunId) {
                  void refreshRun(selectedRunId);
                } else if (cursorInfo) {
                  void loadRuns(true, "refreshing");
                }
              }}
              disabled={!cursorInfo}
              className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-100 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}

        {cursorInfo && (
          <LaunchPanel
            open={launchOpen}
            hasRuns={hasRuns}
            launching={runAction === "launch"}
            issues={githubIssues}
            issuesLoading={githubIssuesLoading}
            issuesError={githubIssuesError}
            onToggle={() => setLaunchOpen((current) => !current)}
            onLoadIssues={loadGithubIssues}
            onLaunch={async (form) => {
              const run = await launchIdeaRun(form);
              if (run) {
                setLaunchOpen(false);
                return true;
              }
              return false;
            }}
          />
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <RunsRail
            runs={runs}
            selectedRunId={selectedRunId}
            loadingState={pageLoadingState}
            onSelect={setSelectedRunId}
          />
          <RunDetail
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
