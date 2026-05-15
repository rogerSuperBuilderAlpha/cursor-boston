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
    <main className="min-h-[80vh] px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-950/90 px-4 py-3 shadow-xl shadow-black/20 md:px-5 md:py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <Bot size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                  PR Idea Explorer
                </h1>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Launch a Cursor Cloud Agent and turn your interests into a reviewable PR.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300">
                <CursorIcon size={14} />
                <span className="truncate max-w-[18rem]">{connectedLabel}</span>
                <Link href="/profile/cursor" className="text-emerald-300 hover:text-emerald-200">
                  Manage
                </Link>
              </div>
              {!launchOpen && (
                <button
                  type="button"
                  onClick={() => setLaunchOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-emerald-300"
                  aria-expanded={launchOpen}
                  aria-controls="pr-ideas-launch-panel"
                >
                  <Plus size={14} />
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

        {cursorInfo && launchOpen && (
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

        <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
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
