/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import type { LaunchFormState, CursorIdeaRun, GithubIssueOption, LoadingState } from "../_lib/types";
import {
  formatIdeaRunsApiError,
  isActiveRun,
} from "../_lib/types";

type RunAction = "cancel" | "archive" | "delete";
type WorkflowAction = "questions" | "answers" | "approve-plan" | "open-pr" | "recover-agent";

interface UseIdeaRunsArgs {
  user: User | null;
  cursorConnected: boolean;
}

function chooseSelectedRun(runs: CursorIdeaRun[]): string | null {
  const active = runs.find((run) => isActiveRun(run.status));
  return active?.id ?? runs[0]?.id ?? null;
}

export function useIdeaRuns({ user, cursorConnected }: UseIdeaRunsArgs) {
  const router = useRouter();
  const [runs, setRuns] = useState<CursorIdeaRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [runAction, setRunAction] = useState<string | null>(null);
  const [syncingRunId, setSyncingRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});
  const [visibilityState, setVisibilityState] = useState<"visible" | "hidden">("visible");
  const [pollPausedUntil, setPollPausedUntil] = useState(0);
  const [, setPollFailCount] = useState(0);
  const [githubIssues, setGithubIssues] = useState<GithubIssueOption[]>([]);
  const [githubIssuesLoading, setGithubIssuesLoading] = useState(false);
  const [githubIssuesError, setGithubIssuesError] = useState<string | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId]
  );
  const hasRuns = runs.length > 0;
  const hasActiveRun = runs.some(
    (run) =>
      isActiveRun(run.status) ||
      (run.workflowStage === "questions" && (!run.questions || run.questions.length === 0)) ||
      (run.workflowStage === "planning" && !run.buildPlan) ||
      (run.workflowStage === "building" && !run.buildResult) ||
      (run.workflowStage === "pr_open" && run.pr?.status === "opening")
  );
  const selectedRunActive = Boolean(
    selectedRun &&
      (isActiveRun(selectedRun.status) ||
        (selectedRun.workflowStage === "questions" && (!selectedRun.questions || selectedRun.questions.length === 0)) ||
        (selectedRun.workflowStage === "planning" && !selectedRun.buildPlan) ||
        (selectedRun.workflowStage === "building" && !selectedRun.buildResult) ||
        (selectedRun.workflowStage === "pr_open" && selectedRun.pr?.status === "opening"))
  );

  const authFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      if (!user) throw new Error("Missing user");
      const token = await user.getIdToken();
      return fetch(url, {
        ...init,
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [user]
  );

  const bumpPollFailures = useCallback(() => {
    setPollFailCount((current) => {
      const next = current + 1;
      if (next >= 3) {
        setPollPausedUntil(Date.now() + 30_000);
        setError(
          "Polling paused after repeated server errors. Wait a few seconds, use Retry below, or refresh the page."
        );
        return 0;
      }
      return next;
    });
  }, []);

  const loadRuns = useCallback(
    async (refresh = true, mode: LoadingState = "refreshing") => {
      if (!user || !cursorConnected) return;
      setLoadingState((current) => (current === "initial" ? current : mode));
      setError(null);
      try {
        const res = await authFetch(`/api/cursor/idea-runs?refresh=${refresh ? "true" : "false"}`);
        const payload = (await res.json().catch(() => ({}))) as {
          runs?: CursorIdeaRun[];
          error?: string;
          errorId?: string;
        };
        if (!res.ok) {
          if (res.status === 429) {
            const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
            setPollPausedUntil(Date.now() + Math.max(retryAfter, 10) * 1000);
            setError("Cursor idea runs are syncing too often. Pausing refresh briefly.");
          } else {
            if (res.status >= 500) bumpPollFailures();
            setError(formatIdeaRunsApiError(payload.error, payload.errorId));
          }
          return;
        }
        setPollFailCount(0);
        const nextRuns = payload.runs ?? [];
        setRuns(nextRuns);
        setSelectedRunId((current) => {
          if (current && nextRuns.some((run) => run.id === current)) return current;
          return chooseSelectedRun(nextRuns);
        });
      } catch {
        setError("Network error while loading idea runs.");
      } finally {
        setLoadingState("idle");
      }
    },
    [authFetch, bumpPollFailures, cursorConnected, user]
  );

  const syncRunSnapshot = useCallback(
    async (runId: string) => {
      if (!user || !cursorConnected) return;
      setSyncingRunId(runId);
      try {
        const res = await authFetch(`/api/cursor/idea-runs/${runId}`);
        const payload = (await res.json().catch(() => ({}))) as {
          run?: CursorIdeaRun;
          error?: string;
          errorId?: string;
          refreshSkipped?: string;
        };
        if (!res.ok) {
          if (res.status === 429) {
            const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
            setPollPausedUntil(Date.now() + Math.max(retryAfter, 10) * 1000);
          } else if (res.status >= 500) {
            bumpPollFailures();
          }
          return;
        }
        if (payload.refreshSkipped === "cursor_not_connected") {
          router.replace("/profile/cursor?return=/pr-ideas");
          return;
        }
        setPollFailCount(0);
        if (payload.run) {
          setRuns((current) => current.map((run) => (run.id === runId ? payload.run! : run)));
          setRunErrors((current) => {
            const next = { ...current };
            delete next[runId];
            return next;
          });
        }
      } catch {
        // Keep the existing UI visible; transient status checks should not blank the page.
      } finally {
        setSyncingRunId((current) => (current === runId ? null : current));
      }
    },
    [authFetch, bumpPollFailures, cursorConnected, router, user]
  );

  useEffect(() => {
    if (!cursorConnected || !user) return undefined;
    const timeoutId = window.setTimeout(() => {
      void loadRuns(false, "initial");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cursorConnected, loadRuns, user]);

  useEffect(() => {
    if (pollPausedUntil <= Date.now()) return undefined;
    const timeoutId = window.setTimeout(() => {
      setPollPausedUntil(0);
    }, pollPausedUntil - Date.now());
    return () => window.clearTimeout(timeoutId);
  }, [pollPausedUntil]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const syncVisibility = () => {
      setVisibilityState(document.visibilityState === "hidden" ? "hidden" : "visible");
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    if (
      !cursorConnected ||
      !user ||
      !selectedRunId ||
      !selectedRunActive ||
      visibilityState === "hidden" ||
      pollPausedUntil > Date.now()
    ) {
      return undefined;
    }

    // Kick an immediate snapshot on entry (via a 0ms timeout so the setState
    // it eventually triggers happens outside this effect's render pass) so
    // the UI doesn't sit for 3s after the user clicks an action button.
    const kickoffId = window.setTimeout(() => {
      void syncRunSnapshot(selectedRunId);
    }, 0);
    const intervalId = window.setInterval(() => {
      void syncRunSnapshot(selectedRunId);
    }, 3_000);
    return () => {
      window.clearTimeout(kickoffId);
      window.clearInterval(intervalId);
    };
  }, [
    cursorConnected,
    pollPausedUntil,
    selectedRunActive,
    selectedRunId,
    syncRunSnapshot,
    user,
    visibilityState,
  ]);

  const launchIdeaRun = useCallback(
    async (ideaForm: LaunchFormState): Promise<CursorIdeaRun | null> => {
      if (!user) return null;
      setRunAction("launch");
      setError(null);
      try {
        const res = await authFetch("/api/cursor/idea-runs", {
          method: "POST",
          body: JSON.stringify({
            mode: ideaForm.mode,
            interests: ideaForm.interests.join(", "),
            skills: ideaForm.skills.join(", "),
            preferredArea: ideaForm.preferredArea.join(", "),
            constraints: ideaForm.constraints.join(", "),
            freeform: ideaForm.freeform,
            issueNumber: ideaForm.issue ? String(ideaForm.issue.number) : undefined,
            issueTitle: ideaForm.issue?.title,
            issueBody: ideaForm.issue?.body ?? undefined,
            issueUrl: ideaForm.issue?.url,
            issueLabels: ideaForm.issue?.labels.join(", "),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          run?: CursorIdeaRun;
          error?: string;
          errorId?: string;
        };
        if (!res.ok || !body.run) {
          if (body.error === "cursor_not_connected") {
            router.replace("/profile/cursor?return=/pr-ideas");
          } else {
            setError(formatIdeaRunsApiError(body.error, body.errorId));
          }
          return null;
        }

        setPollFailCount(0);
        setRuns((current) => [body.run!, ...current.filter((run) => run.id !== body.run!.id)]);
        setSelectedRunId(body.run.id);
        return body.run;
      } catch {
        setError("Network error while launching the idea explorer.");
        return null;
      } finally {
        setRunAction(null);
      }
    },
    [authFetch, router, user]
  );

  const loadGithubIssues = useCallback(async () => {
    if (!user) return;
    if (githubIssues.length > 0 || githubIssuesLoading) return;
    setGithubIssuesLoading(true);
    setGithubIssuesError(null);
    try {
      const res = await authFetch("/api/cursor/github-issues");
      const body = (await res.json().catch(() => ({}))) as { issues?: GithubIssueOption[] };
      if (!res.ok || !body.issues) {
        setGithubIssuesError("Could not load GitHub issues.");
        return;
      }
      setGithubIssues(body.issues);
    } catch {
      setGithubIssuesError("Network error while loading GitHub issues.");
    } finally {
      setGithubIssuesLoading(false);
    }
  }, [authFetch, githubIssues.length, githubIssuesLoading, user]);

  const refreshRun = useCallback(
    async (runId: string) => {
      setRunAction(`refresh:${runId}`);
      setLoadingState("refreshing");
      setError(null);
      try {
        const res = await authFetch(`/api/cursor/idea-runs/${runId}`);
        const body = (await res.json().catch(() => ({}))) as {
          run?: CursorIdeaRun;
          error?: string;
          errorId?: string;
          refreshSkipped?: string;
        };
        if (body.refreshSkipped === "cursor_not_connected") {
          router.replace("/profile/cursor?return=/pr-ideas");
          return;
        }
        if (!res.ok || !body.run) {
          setError(formatIdeaRunsApiError(body.error, body.errorId));
          if (res.status >= 500) bumpPollFailures();
          return;
        }
        setPollFailCount(0);
        setRuns((current) => current.map((run) => (run.id === runId ? body.run! : run)));
        setRunErrors((current) => {
          const next = { ...current };
          delete next[runId];
          return next;
        });
      } catch {
        setError("Network error while refreshing the run.");
      } finally {
        setRunAction(null);
        setLoadingState("idle");
      }
    },
    [authFetch, bumpPollFailures, router]
  );

  const clearError = useCallback(() => setError(null), []);

  const mutateRun = useCallback(
    async (runId: string, action: RunAction) => {
      if (
        action === "delete" &&
        !window.confirm("Delete this run permanently? This removes the run and its Cloud Agent record.")
      ) {
        return;
      }
      setRunAction(`${action}:${runId}`);
      setError(null);
      try {
        const res = await authFetch(
          `/api/cursor/idea-runs/${runId}${action === "delete" ? "" : `/${action}`}`,
          { method: action === "delete" ? "DELETE" : "POST" }
        );
        const body = (await res.json().catch(() => ({}))) as {
          run?: CursorIdeaRun;
          error?: string;
          errorId?: string;
        };
        if (!res.ok) {
          setError(formatIdeaRunsApiError(body.error, body.errorId) || `Could not ${action} that run.`);
          return;
        }
        if (action === "delete") {
          setRuns((current) => {
            const nextRuns = current.filter((run) => run.id !== runId);
            setSelectedRunId(chooseSelectedRun(nextRuns));
            return nextRuns;
          });
        } else if (body.run) {
          setRuns((current) => current.map((run) => (run.id === runId ? body.run! : run)));
        }
      } catch {
        setError(`Network error while trying to ${action} the run.`);
      } finally {
        setRunAction(null);
      }
    },
    [authFetch]
  );

  const advanceWorkflow = useCallback(
    async (
      runId: string,
      action: WorkflowAction,
      body?: Record<string, unknown>
    ): Promise<CursorIdeaRun | null> => {
      setRunAction(`${action}:${runId}`);
      setError(null);
      try {
        const res = await authFetch(`/api/cursor/idea-runs/${runId}/${action}`, {
          method: "POST",
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          run?: CursorIdeaRun;
          error?: string;
          errorId?: string;
        };
        if (!res.ok || !payload.run) {
          const message =
            payload.error === "agent_recovery_required"
              ? "The previous Cursor Cloud Agent is no longer available. Start a fresh Cloud Agent from this context."
              : formatIdeaRunsApiError(payload.error, payload.errorId) || "Could not advance that idea run.";
          setRunErrors((current) => ({
            ...current,
            [runId]: message,
          }));
          return null;
        }
        setRunErrors((current) => {
          const next = { ...current };
          delete next[runId];
          return next;
        });
        setRuns((current) => current.map((run) => (run.id === runId ? payload.run! : run)));
        setSelectedRunId(runId);
        return payload.run;
      } catch {
        setRunErrors((current) => ({
          ...current,
          [runId]: "Network error while advancing that idea run.",
        }));
        return null;
      } finally {
        setRunAction(null);
      }
    },
    [authFetch]
  );

  return {
    runs,
    selectedRun,
    selectedRunId,
    setSelectedRunId,
    hasRuns,
    hasActiveRun,
    loadingState,
    runAction,
    syncingRunId,
    error,
    runErrors,
    githubIssues,
    githubIssuesLoading,
    githubIssuesError,
    loadRuns,
    clearError,
    loadGithubIssues,
    launchIdeaRun,
    refreshRun,
    mutateRun,
    advanceWorkflow,
  };
}
