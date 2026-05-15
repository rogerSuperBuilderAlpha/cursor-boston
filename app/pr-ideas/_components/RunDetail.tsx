/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { CheckCircle2, Copy, ExternalLink, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PromptMarkdown } from "@/components/cookbook/PromptMarkdown";
import {
  formatDuration,
  formatRunDate,
  getRunTitle,
  isActiveRun,
  STATUS_STYLES,
  type CursorIdeaRun,
  type LoadingState,
} from "../_lib/types";

interface RunDetailProps {
  run: CursorIdeaRun | null;
  loadingState: LoadingState;
  runAction: string | null;
  syncingRunId?: string | null;
  error?: string | null;
  onRefresh: (runId: string) => void;
  onMutate: (runId: string, action: "cancel" | "archive" | "delete") => void;
  onAdvanceWorkflow: (
    runId: string,
    action: "questions" | "answers" | "approve-plan" | "open-pr" | "recover-agent",
    body?: Record<string, unknown>
  ) => Promise<CursorIdeaRun | null>;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-neutral-800/80 ${className}`} />;
}

function WorkflowBadge({ run }: { run: CursorIdeaRun }) {
  const label = run.pr?.status && run.pr.status !== "not_started"
    ? formatPrStatus(run.pr.status)
    : formatWorkflowStage(run.workflowStage);
  return (
    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
      {label}
    </span>
  );
}

function formatWorkflowStage(stage?: CursorIdeaRun["workflowStage"]): string {
  switch (stage) {
    case "questions":
      return "questions";
    case "planning":
      return "planning";
    case "plan_approval":
      return "plan approval";
    case "building":
      return "building";
    case "ready_for_pr":
      return "ready for PR";
    case "pr_open":
      return "PR open";
    case "pr_commented_on":
      return "PR commented on";
    case "pr_merged":
      return "PR merged";
    case "ideas":
    default:
      return "ideas";
  }
}

function formatPrStatus(status: NonNullable<CursorIdeaRun["pr"]>["status"]): string {
  switch (status) {
    case "opening":
      return "opening PR";
    case "pr_open":
      return "PR open";
    case "pr_commented_on":
      return "PR commented on";
    case "pr_merged":
      return "PR merged";
    case "not_started":
    default:
      return "not started";
  }
}

function extractSuggestionOptions(result?: string | null): string[] {
  if (!result) return [];
  const options: string[] = [];
  for (const line of result.split("\n")) {
    const match = line.match(/^\s*(?:#{2,4}|\d+\.|\*|-)\s*(?:\*\*)?([^:\n*]{8,90})/);
    if (!match) continue;
    const label = match[1].replace(/\*\*/g, "").trim();
    if (label && !options.some((option) => option.toLowerCase() === label.toLowerCase())) {
      options.push(label);
    }
    if (options.length >= 5) break;
  }
  return options;
}

function expectedAgentWindow(run: CursorIdeaRun): string {
  switch (run.workflowStage) {
    case "questions":
      return "usually 30-90 seconds";
    case "planning":
      return "usually 1-3 minutes";
    case "building":
      return "usually 5-15 minutes";
    case "pr_open":
      return "usually 1-3 minutes";
    case "ideas":
    default:
      return "usually 2-5 minutes";
  }
}

function agentRunningLabel(run: CursorIdeaRun): string {
  switch (run.workflowStage) {
    case "questions":
      return "Cursor Cloud Agent is drafting questions";
    case "planning":
      return "Cursor Cloud Agent is creating the build plan";
    case "building":
      return "Cursor Cloud Agent is building in the repo";
    case "pr_open":
      return "Cursor Cloud Agent is opening the PR";
    case "ideas":
    default:
      return "Cursor Cloud Agent is exploring the repo";
  }
}

function elapsedForRun(run: CursorIdeaRun, now: number): number {
  // For finished/cancelled/errored runs, prefer the SDK-reported duration.
  // For active runs we must compute live — `durationMs` from the SDK is a
  // snapshot that does NOT tick between polls, so trusting it freezes the
  // timer at whatever the last poll reported.
  const stageActive =
    run.status === "starting" ||
    run.status === "running" ||
    (run.workflowStage === "questions" && (!run.questions || run.questions.length === 0)) ||
    (run.workflowStage === "planning" && !run.buildPlan) ||
    (run.workflowStage === "building" && !run.buildResult) ||
    (run.workflowStage === "pr_open" && run.pr?.status === "opening");
  if (!stageActive && run.durationMs && run.durationMs > 0) return run.durationMs;
  const start = stageStartTime(run);
  if (!start) return 0;
  const startedAt = new Date(start).getTime();
  if (Number.isNaN(startedAt)) return 0;
  return Math.max(0, now - startedAt);
}

function stageStartTime(run: CursorIdeaRun): string | null | undefined {
  // Match the elapsed clock to the current workflow stage so it reflects the
  // active step's wall-clock duration. Avoid `updatedAt` here — the poll
  // loop bumps that timestamp every few seconds and would reset the timer.
  switch (run.workflowStage) {
    case "building":
      return run.planApprovedAt ?? run.createdAt;
    case "planning":
      return run.answersSubmittedAt ?? run.createdAt;
    case "questions":
    case "plan_approval":
    case "ideas":
    default:
      return run.createdAt;
  }
}

const WORKFLOW_STEPS = [
  { id: "source", label: "Source" },
  { id: "direction", label: "Direction" },
  { id: "questions", label: "Questions" },
  { id: "plan", label: "Plan" },
  { id: "build", label: "Build" },
  { id: "pr", label: "PR" },
] as const;

function currentStepIndex(run: CursorIdeaRun): number {
  if (run.pr?.status && run.pr.status !== "not_started") return 5;
  if (run.workflowStage === "ready_for_pr" || run.workflowStage === "building" || run.buildResult) return 4;
  if (run.workflowStage === "plan_approval" || run.workflowStage === "planning" || run.buildPlan) return 3;
  if (run.workflowStage === "questions" || (run.questions && run.questions.length > 0)) return 2;
  if (run.selectedIdea || run.result) return 1;
  return 0;
}

function workflowHeading(run: CursorIdeaRun): string {
  if (run.pr?.url) return "PR is open";
  if (run.pr?.status === "opening") return "Opening the PR";
  if (run.workflowStage === "ready_for_pr" || run.buildResult) return "Build is ready for PR";
  if (run.workflowStage === "building") return "Cloud Agent is building";
  if (run.workflowStage === "plan_approval" || run.buildPlan) return "Review and approve the build plan";
  if (run.workflowStage === "planning") return "Cloud Agent is creating the build plan";
  if (run.questions && run.questions.length > 0 && !run.answersSubmittedAt) return "Answer Cursor's questions";
  if (run.workflowStage === "questions") return "Cloud Agent is drafting questions";
  if (run.result && !run.selectedIdea) return "Choose a direction";
  return "Cloud Agent is inspecting the repo";
}

interface AgentRunningModalProps {
  run: CursorIdeaRun;
  elapsed: number;
  canCancel: boolean;
  cancelling: boolean;
  onClose: () => void;
  onCancel: () => void;
}

function AgentRunningModal({
  run,
  elapsed,
  canCancel,
  cancelling,
  onClose,
  onCancel,
}: AgentRunningModalProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-running-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-neutral-950 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/15 p-2">
            <Loader2 size={18} className="animate-spin text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="agent-running-title" className="text-base font-semibold text-white">
              Cursor Cloud Agent is running
            </h3>
            <p className="mt-0.5 text-sm text-neutral-400">{agentRunningLabel(run)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-900 hover:text-white"
            aria-label="Run in background"
          >
            <X size={16} />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-2">
            <dt className="uppercase tracking-[0.14em] text-neutral-500">Elapsed</dt>
            <dd className="mt-1 text-sm text-white">{formatDuration(elapsed) ?? "0s"}</dd>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-2">
            <dt className="uppercase tracking-[0.14em] text-neutral-500">Expected</dt>
            <dd className="mt-1 text-sm text-white">{expectedAgentWindow(run)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-neutral-400">
          The agent keeps running in the background. Close this dialog to watch the live log — every other
          action stays disabled until the agent finishes, except for Cancel.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
            >
              {cancelling && <Loader2 size={12} className="animate-spin" />}
              Cancel run
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-900"
          >
            Run in background
          </button>
        </div>
      </div>
    </div>
  );
}

function workflowDescription(run: CursorIdeaRun): string {
  if (run.pr?.url) return "The work is now tracked as a pull request.";
  if (run.pr?.status === "opening") return "Cursor is creating the PR and syncing its URL back here.";
  if (run.workflowStage === "ready_for_pr" || run.buildResult) return "Review the build summary, then open a PR.";
  if (run.workflowStage === "building") return "Cursor is editing and validating the repository in a cloud workspace.";
  if (run.workflowStage === "plan_approval" || run.buildPlan) return "Approve only if this plan matches the contribution you want.";
  if (run.workflowStage === "planning") return "Cursor is turning your answers into a concrete build plan.";
  if (run.questions && run.questions.length > 0 && !run.answersSubmittedAt) return "Answer the questions below so Cursor can plan the build.";
  if (run.workflowStage === "questions") return "Cursor is preparing follow-up questions for your selected direction.";
  if (run.result && !run.selectedIdea) return "Pick one suggestion or write your own direction to continue.";
  return "Cursor is reading the repo and preparing contribution directions.";
}

export function RunDetail({
  run,
  loadingState,
  runAction,
  syncingRunId,
  error,
  onRefresh,
  onMutate,
  onAdvanceWorkflow,
}: RunDetailProps) {
  const [selectedIdea, setSelectedIdea] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resultExpanded, setResultExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  const loadingInitial = loadingState === "initial" && !run;
  const active = run ? isActiveRun(run.status) : false;
  const refreshing = run ? runAction === `refresh:${run.id}` : false;
  const syncing = syncingRunId === run?.id || refreshing;
  const agentWorking = run
    ? active ||
      (run.workflowStage === "questions" && (!run.questions || run.questions.length === 0)) ||
      (run.workflowStage === "planning" && !run.buildPlan) ||
      (run.workflowStage === "building" && !run.buildResult) ||
      (run.workflowStage === "pr_open" && run.pr?.status === "opening")
    : false;
  // While the agent is working, every workflow action button is disabled —
  // only the Cancel button stays usable (per UX requirement).
  const actionsLocked = agentWorking;
  const recentActivity = useMemo(
    () => (run?.activity ?? []).slice(-4).reverse(),
    [run?.activity]
  );
  const elapsed = run ? elapsedForRun(run, now) : 0;
  const cancelling = run ? runAction === `cancel:${run.id}` : false;

  useEffect(() => {
    if (!agentWorking) return undefined;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [agentWorking]);

  // Modal auto-hides via conditional render (`modalOpen && agentWorking`); no
  // synchronization effect needed. Per-run state is reset by remounting the
  // component via `key={run.id}` in the parent.

  const handleAdvance = useCallback(
    (
      action: "questions" | "answers" | "approve-plan" | "open-pr" | "recover-agent",
      body?: Record<string, unknown>
    ) => {
      if (!run) return Promise.resolve(null);
      setModalOpen(true);
      return onAdvanceWorkflow(run.id, action, body);
    },
    [run, onAdvanceWorkflow]
  );

  const handleCancelFromModal = useCallback(() => {
    if (!run) return;
    onMutate(run.id, "cancel");
  }, [run, onMutate]);

  if (loadingInitial) {
    return (
      <section className="relative min-h-[34rem] rounded-3xl border border-neutral-800 bg-neutral-950/85 p-5 md:p-6">
        <SkeletonBlock className="h-8 w-56" />
        <SkeletonBlock className="mt-4 h-24 w-full" />
        <SkeletonBlock className="mt-4 h-40 w-full" />
        <SkeletonBlock className="mt-4 h-56 w-full" />
      </section>
    );
  }

  if (!run) {
    return (
      <section className="flex min-h-[34rem] items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-950/70 p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-white">No run selected</p>
          <p className="mt-2 max-w-sm text-sm text-neutral-400">
            Launch an idea explorer or select a previous run to inspect its activity and results.
          </p>
        </div>
      </section>
    );
  }

  const copyResult = async () => {
    const content = run.pr?.url
      ? `PR opened: ${run.pr.url}`
      : run.buildResult ?? run.buildPlan ?? run.result;
    if (!content) return;
    await navigator.clipboard.writeText(content);
  };

  const busyPrefix = runAction?.endsWith(`:${run.id}`) ? runAction.split(":")[0] : null;
  const suggestionOptions = extractSuggestionOptions(run.result);
  const stepIndex = currentStepIndex(run);
  const outputContent = run.pr?.url
    ? `PR opened: ${run.pr.url}`
    : run.buildResult ?? run.buildPlan ?? run.result ?? null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/85">
      {agentWorking && syncing && <div className="h-0.5 w-full animate-pulse bg-emerald-400" />}

      <div className="p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] ${STATUS_STYLES[run.status]}`}
              >
                {active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                {run.status}
              </span>
              <WorkflowBadge run={run} />
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">
              {getRunTitle(run)}
            </h2>
            <p className={`mt-0.5 text-xs text-neutral-500 ${agentWorking && syncing ? "animate-pulse" : ""}`}>
              Updated {formatRunDate(run.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {run.cursorAgentUrl && (
              <a
                href={run.cursorAgentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/10"
              >
                Open in Cursor
                <ExternalLink size={12} />
              </a>
            )}
            <button
              type="button"
              onClick={() => onRefresh(run.id)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
          </div>
        </div>

        <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">
            <dt className="uppercase tracking-[0.14em] text-neutral-500">Agent</dt>
            <dd className="max-w-[12rem] truncate text-neutral-200">{run.cursorAgentId ?? "Pending"}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="uppercase tracking-[0.14em] text-neutral-500">Run</dt>
            <dd className="max-w-[12rem] truncate text-neutral-200">{run.cursorRunId ?? run.id}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="uppercase tracking-[0.14em] text-neutral-500">Duration</dt>
            <dd className="text-neutral-200">{formatDuration(run.durationMs) ?? "In progress"}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="uppercase tracking-[0.14em] text-neutral-500">Finished</dt>
            <dd className="text-neutral-200">{run.finishedAt ? formatRunDate(run.finishedAt) : "Not yet"}</dd>
          </div>
        </dl>

        {run.error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {run.error}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{workflowHeading(run)}</h3>
            <p className="text-xs text-neutral-400">{workflowDescription(run)}</p>
          </div>

          <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
            {WORKFLOW_STEPS.map((step, index) => (
              <li
                key={step.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                  index <= stepIndex
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "border-neutral-800 bg-neutral-950 text-neutral-500"
                }`}
              >
                {index < stepIndex ? (
                  <CheckCircle2 size={11} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
                {step.label}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-semibold text-white">Current action</h4>
              {agentWorking && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                  Cloud Agent
                </span>
              )}
            </div>

            <div className="mt-3 space-y-3">
                {agentWorking && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                    <p className="text-sm font-medium text-white">{agentRunningLabel(run)}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">Elapsed </span>
                        <span className="text-white">{formatDuration(elapsed) ?? "0s"}</span>
                      </div>
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">Expected </span>
                        <span className="text-white">{expectedAgentWindow(run)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {run.workflowStage === "ideas" && run.result && !run.selectedIdea && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white">Choose what Cursor should turn into a PR.</p>
                    {suggestionOptions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {suggestionOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSelectedIdea(option)}
                            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                              selectedIdea === option
                                ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                                : "border-neutral-700 text-neutral-300 hover:bg-neutral-900"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={selectedIdea}
                      onChange={(event) => setSelectedIdea(event.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-emerald-400 focus:outline-none"
                      placeholder="Pick one above or write your own direction..."
                    />
                    <button
                      type="button"
                      onClick={() => handleAdvance("questions", { selectedIdea: selectedIdea.trim() })}
                      disabled={!selectedIdea.trim() || busyPrefix === "questions" || actionsLocked}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-300 disabled:opacity-50"
                    >
                      {busyPrefix === "questions" && <Loader2 size={14} className="animate-spin" />}
                      Continue and ask questions
                    </button>
                  </div>
                )}

                {run.workflowStage === "questions" && (!run.questions || run.questions.length === 0) && (
                  <div className="space-y-3">
                    <SkeletonBlock className="h-5 w-4/5" />
                    <SkeletonBlock className="h-24 w-full" />
                    <p className="text-sm text-neutral-400">Cursor is preparing questions for you.</p>
                  </div>
                )}

                {run.workflowStage === "questions" && run.questions && run.questions.length > 0 && !run.answersSubmittedAt && (
                  <div className="space-y-3">
                    {run.questions.map((question) => (
                      <div key={question.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                        <p className="text-sm text-neutral-200">{question.question}</p>
                        {question.suggestions && question.suggestions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {question.suggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => setAnswers((current) => ({ ...current, [question.id]: suggestion }))}
                                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                  answers[question.id] === suggestion
                                    ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                                    : "border-neutral-700 text-neutral-300 hover:bg-neutral-950"
                                }`}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                        <input
                          value={answers[question.id] ?? ""}
                          onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-emerald-400 focus:outline-none"
                          placeholder="Pick a suggestion or write your own..."
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAdvance("answers", { answers })}
                      disabled={busyPrefix === "answers" || actionsLocked}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-300 disabled:opacity-50"
                    >
                      {busyPrefix === "answers" && <Loader2 size={14} className="animate-spin" />}
                      Submit answers and generate plan
                    </button>
                  </div>
                )}

                {run.workflowStage === "planning" && !run.buildPlan && (
                  <div className="space-y-3">
                    <SkeletonBlock className="h-5 w-2/3" />
                    <SkeletonBlock className="h-28 w-full" />
                    <p className="text-sm text-neutral-400">Cursor is creating the build plan.</p>
                  </div>
                )}

                {run.workflowStage === "plan_approval" && run.buildPlan && (
                  <button
                    type="button"
                    onClick={() => handleAdvance("approve-plan")}
                    disabled={busyPrefix === "approve-plan" || actionsLocked}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-300 disabled:opacity-50"
                  >
                    {busyPrefix === "approve-plan" && <Loader2 size={14} className="animate-spin" />}
                    Approve and build
                  </button>
                )}

                {run.workflowStage === "ready_for_pr" && !run.pr?.url && (
                  <button
                    type="button"
                    onClick={() => handleAdvance("open-pr")}
                    disabled={busyPrefix === "open-pr" || actionsLocked}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-300 disabled:opacity-50"
                  >
                    {busyPrefix === "open-pr" && <Loader2 size={14} className="animate-spin" />}
                    Open a PR
                  </button>
                )}

                {run.pr?.url && (
                  <a href={run.pr.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                    View PR <ExternalLink size={14} />
                  </a>
                )}

                {error && (
                  <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={() => handleAdvance("recover-agent")}
                      disabled={busyPrefix === "recover-agent" || actionsLocked}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-300/40 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {busyPrefix === "recover-agent" && <Loader2 size={14} className="animate-spin" />}
                      Start a fresh Cloud Agent from this context
                    </button>
                  </div>
                )}
              </div>
            </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-white">Cloud Agent log</h4>
                <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                  {syncing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
                  {syncing
                    ? "Syncing..."
                    : run.cursorLastActivityAt
                      ? `Synced ${formatRunDate(run.cursorLastActivityAt)}`
                      : "Waiting"}
                </span>
              </div>
              {run.cursorStatusDetail && (
                <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-2.5 py-1.5 text-xs text-emerald-100">
                  {run.cursorStatusDetail}
                </div>
              )}
              <div className="mt-2 max-h-[18rem] space-y-2 overflow-y-auto">
                {recentActivity.length > 0 ? (
                  recentActivity.map((item) => (
                    <div key={item.id} className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                        {item.kind ?? (item.role === "assistant" ? "agent" : "prompt")}
                      </p>
                      <PromptMarkdown content={item.summary} className="mt-1 line-clamp-4 text-sm" />
                    </div>
                  ))
                ) : agentWorking ? (
                  <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/70 p-3">
                    <div className="flex items-center gap-2 text-sm text-neutral-200">
                      <Loader2 size={14} className="animate-spin text-emerald-300" />
                      <span>{agentRunningLabel(run)}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-400">
                      The agent is working in the cloud but hasn&apos;t streamed any conversation steps to this
                      run yet. Conversation steps appear here after the agent emits its first message — Cursor
                      sometimes batches the first few seconds.
                    </p>
                    {run.cursorAgentUrl && (
                      <a
                        href={run.cursorAgentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                      >
                        Watch live in Cursor <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">No activity synced yet.</p>
                )}
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-white">Output</h4>
                <div className="flex gap-1.5">
                  {outputContent && (
                    <>
                      <button type="button" onClick={() => setResultExpanded((current) => !current)} className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900">
                        {resultExpanded ? "Collapse" : "Expand"}
                      </button>
                      <button type="button" onClick={copyResult} className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900">
                        <Copy size={12} /> Copy
                      </button>
                    </>
                  )}
                </div>
              </div>
              {outputContent ? (
                <div className={`mt-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 ${resultExpanded ? "" : "max-h-[18rem] overflow-y-auto"}`}>
                  <PromptMarkdown content={outputContent} className="space-y-3" />
                </div>
              ) : (
                <p className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 text-sm text-neutral-500">
                  Output will appear here when the current step completes.
                </p>
              )}
            </div>
          </div>
        </div>

        {run.artifacts && run.artifacts.length > 0 && (
          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">Artifacts</h3>
            <ul className="mt-2 space-y-0.5 text-xs text-neutral-400">
              {run.artifacts.map((artifact) => (
                <li key={artifact.path}>{artifact.path}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-3">
          <div className="flex flex-wrap gap-2">
            {active && (
              <button
                type="button"
                onClick={() => onMutate(run.id, "cancel")}
                disabled={runAction === `cancel:${run.id}`}
                className="rounded-lg border border-amber-500/30 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
              >
                Cancel run
              </button>
            )}
            {!run.archivedAt && (
              <button
                type="button"
                onClick={() => onMutate(run.id, "archive")}
                disabled={runAction === `archive:${run.id}` || actionsLocked}
                title={actionsLocked ? "Cancel the running agent before archiving" : undefined}
                className="rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
              >
                Archive agent
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onMutate(run.id, "delete")}
            disabled={runAction === `delete:${run.id}` || actionsLocked}
            title={actionsLocked ? "Cancel the running agent before deleting" : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>

      {modalOpen && agentWorking && (
        <AgentRunningModal
          run={run}
          elapsed={elapsed}
          canCancel={active}
          cancelling={cancelling}
          onClose={() => setModalOpen(false)}
          onCancel={handleCancelFromModal}
        />
      )}
    </section>
  );
}
