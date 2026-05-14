/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Laptop,
  X,
} from "lucide-react";

const ALC_URL = "https://ludwitt.com/alc";

interface SetupReadinessModalProps {
  /** Cohort label used in the modal headline, e.g. "Cohort 1" / "Cohort 2". */
  cohortLabel: string;
  /** Kickoff date headline, e.g. "Mon, May 11 · 6–7pm EST". */
  kickoffLabel: string;
  /** Discord is not connected — triggers the modal to pop. */
  needsDiscord: boolean;
  /** GitHub is not connected — triggers the modal to pop. */
  needsGithub: boolean;
  /** Intake survey not yet submitted — displayed only, never triggers pop. */
  needsSurvey: boolean;
  /**
   * Admit hasn't self-attested their dev environment is ready
   * (Node + Git + Cursor / Claude Code). Triggers the modal to pop and
   * surfaces a single "Yes, I'm ready" button.
   */
  needsDevEnvConfirm: boolean;
  onConnectDiscord: () => void;
  onConnectGithub: () => void;
  /** Closes the modal and switches the page to the intake-survey tab. */
  onGoToSurvey: () => void;
  /**
   * POST /api/summer-cohort/confirm-dev-env, then refresh the application.
   * Should resolve once the timestamp is persisted so the row can flip to
   * "done" without a full page reload.
   */
  onConfirmDevEnv: () => Promise<void>;
}

/**
 * Sticky readiness modal for admitted cohort participants.
 * Pops on every page load while Discord, GitHub, or dev-env confirmation is
 * missing. Closing only suppresses for the current page-load — no localStorage
 * flag — so users keep being nudged until everything is done.
 */
export function SetupReadinessModal({
  cohortLabel,
  kickoffLabel,
  needsDiscord,
  needsGithub,
  needsSurvey,
  needsDevEnvConfirm,
  onConnectDiscord,
  onConnectGithub,
  onGoToSurvey,
  onConfirmDevEnv,
}: SetupReadinessModalProps) {
  const shouldOpen = needsDiscord || needsGithub || needsDevEnvConfirm;
  const [isOpen, setIsOpen] = useState(false);
  const [devEnvSubmitting, setDevEnvSubmitting] = useState(false);
  const [devEnvError, setDevEnvError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleConfirmDevEnv = useCallback(async () => {
    setDevEnvSubmitting(true);
    setDevEnvError(null);
    try {
      await onConfirmDevEnv();
    } catch {
      setDevEnvError("Couldn't save. Try again in a moment.");
    } finally {
      setDevEnvSubmitting(false);
    }
  }, [onConfirmDevEnv]);

  // Open whenever the trigger condition becomes true. We only auto-open on
  // the rising edge so that closing the modal doesn't immediately re-open it
  // within the same page-load.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (shouldOpen && !wasOpenRef.current) {
       
      setIsOpen(true);
      wasOpenRef.current = true;
    }
    if (!shouldOpen) {
      wasOpenRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hide modal once user has completed both connections
      setIsOpen(false);
    }
  }, [shouldOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-readiness-title"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl md:p-8">
        <button
          ref={closeButtonRef}
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Close readiness check"
        >
          <X className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </button>

        <h2
          id="setup-readiness-title"
          className="pr-8 text-xl font-bold text-white md:text-2xl"
        >
          Final readiness check — before {cohortLabel} kickoff
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          {cohortLabel} kickoff: <span className="font-semibold text-neutral-200">{kickoffLabel}</span>.
          Knock these out so kickoff is about the work, not logistics.
        </p>

        <ul className="mt-5 space-y-2">
          <StatusRow
            label="Connect Discord"
            done={!needsDiscord}
            doneCopy="Connected — we'll add you to the cohort channel."
            actionLabel="Connect Discord"
            onAction={onConnectDiscord}
          />
          <StatusRow
            label="Connect GitHub"
            done={!needsGithub}
            doneCopy="Connected — your PRs will count toward the cohort."
            actionLabel="Connect GitHub"
            onAction={onConnectGithub}
          />
          <StatusRow
            label="Intake survey (~5 min)"
            done={!needsSurvey}
            doneCopy="Submitted. Thanks!"
            actionLabel="Take the survey"
            onAction={() => {
              onGoToSurvey();
              handleClose();
            }}
          />
          <StatusRow
            label="Dev environment ready (Node + Git + Cursor or Claude Code)"
            done={!needsDevEnvConfirm}
            doneCopy="Confirmed — you're all set for kickoff."
            actionLabel={devEnvSubmitting ? "Saving…" : "Yes, I'm ready"}
            onAction={handleConfirmDevEnv}
            actionDisabled={devEnvSubmitting}
          />
        </ul>

        {devEnvError ? (
          <p className="mt-3 text-xs text-red-300" role="alert">
            {devEnvError}
          </p>
        ) : null}

        <div className="mt-5 rounded-lg border border-emerald-700/60 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            <Laptop className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            Haven&apos;t installed Node, Git, or an IDE yet?
          </div>
          <p className="mt-1.5 text-sm text-neutral-200">
            Not required, but <strong>highly</strong> encouraged before
            kickoff. The 20-minute walkthrough at{" "}
            <span className="font-mono">ludwitt.com/alc</span> covers Node,
            Git, and <strong>Cursor</strong> (or <strong>Claude Code</strong>)
            end-to-end so you don&apos;t spend kickoff debugging install
            issues.
          </p>
          <a
            href={ALC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
          >
            Open the setup walkthrough
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          </a>
        </div>

        <button
          onClick={handleClose}
          className="mt-5 w-full text-center text-sm text-neutral-500 transition-colors hover:text-neutral-300 focus-visible:text-white focus-visible:underline focus-visible:outline-none"
        >
          I&apos;ll come back to this
        </button>
      </div>
    </div>
  );
}

interface StatusRowProps {
  label: string;
  done: boolean;
  doneCopy: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}

function StatusRow({
  label,
  done,
  doneCopy,
  actionLabel,
  onAction,
  actionDisabled,
}: StatusRowProps) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
        done
          ? "border-emerald-700/40 bg-emerald-500/5"
          : "border-amber-700/60 bg-amber-500/10"
      }`}
    >
      {done ? (
        <CheckCircle2
          className="h-5 w-5 shrink-0 text-emerald-400"
          strokeWidth={2.25}
          aria-hidden="true"
        />
      ) : (
        <CircleAlert
          className="h-5 w-5 shrink-0 text-amber-400"
          strokeWidth={2.25}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {done ? doneCopy : "Not done yet."}
        </p>
      </div>
      {!done ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {actionLabel}
        </button>
      ) : null}
    </li>
  );
}
