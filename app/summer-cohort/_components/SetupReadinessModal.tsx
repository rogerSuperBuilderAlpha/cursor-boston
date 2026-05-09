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
  /** Discord is not connected — triggers the modal to pop. */
  needsDiscord: boolean;
  /** GitHub is not connected — triggers the modal to pop. */
  needsGithub: boolean;
  /** Intake survey not yet submitted — displayed only, never triggers pop. */
  needsSurvey: boolean;
  onConnectDiscord: () => void;
  onConnectGithub: () => void;
  /** Closes the modal and switches the page to the intake-survey tab. */
  onGoToSurvey: () => void;
}

/**
 * Sticky readiness modal for admitted Cohort 1 admits.
 * Pops on every page load while Discord OR GitHub is missing.
 * Closing only suppresses for the current page-load — no localStorage flag
 * — so users keep being nudged until they connect both.
 */
export function SetupReadinessModal({
  needsDiscord,
  needsGithub,
  needsSurvey,
  onConnectDiscord,
  onConnectGithub,
  onGoToSurvey,
}: SetupReadinessModalProps) {
  const shouldOpen = needsDiscord || needsGithub;
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
          Cohort 1 kicks off Mon, May 11 — let&apos;s get you ready
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          A few quick checks before kickoff. Knock these out now and you can
          show up Monday focused on the work, not the setup.
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
        </ul>

        <div className="mt-5 rounded-lg border border-emerald-700/60 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
            <Laptop className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            On your laptop
          </div>
          <p className="mt-1.5 text-sm text-neutral-200">
            Install <strong>Node</strong>, <strong>Git</strong>, and{" "}
            <strong>Cursor</strong> (or Claude Code) before Monday. The full
            walkthrough is at <span className="font-mono">ludwitt.com/alc</span>.
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
}

function StatusRow({
  label,
  done,
  doneCopy,
  actionLabel,
  onAction,
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
          className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-400"
        >
          {actionLabel}
        </button>
      ) : null}
    </li>
  );
}
