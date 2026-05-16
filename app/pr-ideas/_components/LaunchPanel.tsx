/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { ExternalLink, GitPullRequestArrow, Lightbulb, Loader2, X } from "lucide-react";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { TagsField } from "./TagsField";
import {
  emptyIdeaForm,
  hasLaunchableIdeaContent,
  IDEA_FIELD_OPTIONS,
  type GithubIssueOption,
  type IdeaFormKey,
  type LaunchFormState,
} from "../_lib/types";

interface LaunchPanelProps {
  open: boolean;
  hasRuns: boolean;
  launching: boolean;
  form: LaunchFormState;
  setForm: Dispatch<SetStateAction<LaunchFormState>>;
  launchError: string | null;
  onDismissError: () => void;
  issues: GithubIssueOption[];
  issuesLoading: boolean;
  issuesError: string | null;
  onToggle: () => void;
  onLoadIssues: () => void;
  onLaunch: (form: LaunchFormState) => Promise<boolean>;
}

export function LaunchPanel({
  open,
  hasRuns,
  launching,
  form,
  setForm,
  launchError,
  onDismissError,
  issues,
  issuesLoading,
  issuesError,
  onToggle,
  onLoadIssues,
  onLaunch,
}: LaunchPanelProps) {
  const [activeField, setActiveField] = useState<IdeaFormKey | null>(null);
  const canLaunch = hasLaunchableIdeaContent(form);

  useEffect(() => {
    if (open && form.mode === "issue") onLoadIssues();
  }, [form.mode, onLoadIssues, open]);

  const handleLaunch = async () => {
    const launched = await onLaunch(form);
    if (launched) {
      setForm(emptyIdeaForm());
      setActiveField(null);
    }
  };

  return (
    <section
      id="pr-ideas-launch-panel"
      className="rounded-3xl border border-neutral-800 bg-neutral-950/85 shadow-2xl shadow-black/20 dark:bg-neutral-950/85"
    >
      <div className="flex flex-col gap-3 px-5 py-4 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Start from an idea or a GitHub issue</h2>
            <p className="mt-1 text-sm text-neutral-400">
              {hasRuns
                ? "Pick a source, add context, then launch a Cloud Agent."
                : "Start here. Choose freeform exploration or a tracked repo issue."}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-900"
            aria-label="Close launch panel"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, mode: "idea", issue: null }))}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
              form.mode === "idea"
                ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-900"
            }`}
          >
            <Lightbulb size={18} />
            <span>
              <span className="block text-sm font-semibold">Generate ideas</span>
              <span className="block text-xs text-neutral-400">Use tags and your own description.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setForm((current) => ({ ...current, mode: "issue" }))}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
              form.mode === "issue"
                ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-900"
            }`}
          >
            <GitPullRequestArrow size={18} />
            <span>
              <span className="block text-sm font-semibold">Start from a GitHub issue</span>
              <span className="block text-xs text-neutral-400">Pick an open issue from the repo.</span>
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-neutral-800 px-5 pb-5 pt-4 md:px-6 md:pb-6">
          {launchError && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/15 p-3 text-sm text-red-950 dark:text-red-100">
              <span>{launchError}</span>
              <button
                type="button"
                onClick={onDismissError}
                className="shrink-0 rounded-lg border border-red-400/50 px-2 py-0.5 text-xs font-medium hover:bg-red-500/20"
              >
                Dismiss
              </button>
            </div>
          )}
          {form.mode === "idea" ? (
            <>
              <div
                className="grid gap-4 md:grid-cols-2"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setActiveField(null);
                  }
                }}
              >
                <TagsField
                  label="Interests"
                  placeholder="Design systems, events, onboarding..."
                  options={IDEA_FIELD_OPTIONS.interests}
                  value={form.interests}
                  isOpen={activeField === "interests"}
                  onOpen={() => setActiveField("interests")}
                  onChange={(value) => setForm((current) => ({ ...current, interests: value }))}
                />
                <TagsField
                  label="Skills"
                  placeholder="React, Firebase, docs, testing..."
                  options={IDEA_FIELD_OPTIONS.skills}
                  value={form.skills}
                  isOpen={activeField === "skills"}
                  onOpen={() => setActiveField("skills")}
                  onChange={(value) => setForm((current) => ({ ...current, skills: value }))}
                />
                <TagsField
                  label="Preferred area"
                  placeholder="Profile, events, game, API..."
                  options={IDEA_FIELD_OPTIONS.preferredArea}
                  value={form.preferredArea}
                  isOpen={activeField === "preferredArea"}
                  onOpen={() => setActiveField("preferredArea")}
                  onChange={(value) => setForm((current) => ({ ...current, preferredArea: value }))}
                />
                <TagsField
                  label="Constraints"
                  placeholder="Under 2 hours, beginner-friendly..."
                  options={IDEA_FIELD_OPTIONS.constraints}
                  value={form.constraints}
                  isOpen={activeField === "constraints"}
                  onOpen={() => setActiveField("constraints")}
                  onChange={(value) => setForm((current) => ({ ...current, constraints: value }))}
                />
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-medium text-neutral-200">Describe what you want to work on</span>
                <textarea
                  value={form.freeform}
                  onChange={(event) => setForm((current) => ({ ...current, freeform: event.target.value }))}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-emerald-400 focus:outline-none"
                  placeholder="Example: I want something UI-heavy, small enough for a first PR, ideally around Q&A or onboarding."
                />
              </label>
            </>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
              <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
                {issuesLoading && <p className="p-3 text-sm text-neutral-400">Loading GitHub issues...</p>}
                {issuesError && <p className="p-3 text-sm text-red-200">{issuesError}</p>}
                {!issuesLoading &&
                  !issuesError &&
                  issues.map((issue) => (
                    <button
                      key={issue.number}
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          issue: current.issue?.number === issue.number ? null : issue,
                        }))
                      }
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        form.issue?.number === issue.number
                          ? "border-emerald-400/60 bg-emerald-400/10"
                          : "border-neutral-800 bg-neutral-900/70 hover:bg-neutral-900"
                      }`}
                    >
                      <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                        <p className="min-w-0 text-sm font-semibold leading-snug text-white">
                          #{issue.number} {issue.title}
                        </p>
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="mt-0.5 shrink-0 text-neutral-500 hover:text-emerald-300"
                          aria-label={`Open issue #${issue.number} on GitHub`}
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                      {issue.labels.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {issue.labels.slice(0, 4).map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-400"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
              </div>
              <label className="block min-h-0">
                <span className="text-sm font-medium text-neutral-200">
                  Describe how you want to approach it (optional but recommended)
                </span>
                <textarea
                  value={form.freeform}
                  onChange={(event) => setForm((current) => ({ ...current, freeform: event.target.value }))}
                  rows={6}
                  className="mt-2 w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-emerald-400 focus:outline-none"
                  placeholder="Example: I want Cursor to find the smallest useful implementation path, avoid database changes, and focus on tests."
                />
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                  {form.issue ? (
                    <>
                      <span>Selected #{form.issue.number}</span>
                      <button
                        type="button"
                        className="text-emerald-400 hover:text-emerald-300"
                        onClick={() => setForm((c) => ({ ...c, issue: null }))}
                      >
                        Clear selection
                      </button>
                    </>
                  ) : (
                    <span>Select an issue from the list before launching.</span>
                  )}
                </p>
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching || !canLaunch}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3.5 font-semibold text-neutral-950 hover:bg-emerald-300 disabled:opacity-60"
          >
            {launching && <Loader2 size={16} className="animate-spin" />}
            {launching
              ? "Launching Cloud Agent…"
              : form.mode === "issue"
                ? "Launch from GitHub issue"
                : "Generate ideas"}
          </button>
          {!canLaunch && (
            <p className="mt-2 text-center text-xs text-neutral-500">
              Add at least one interest, skill, preferred area, constraint, or description before launching.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
