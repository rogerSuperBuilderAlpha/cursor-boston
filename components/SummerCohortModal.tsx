/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { DiscordIcon } from "@/components/icons";
import {
  SUMMER_COHORTS,
  SUMMER_COHORT_IMMERSION,
  SUMMER_COHORT_LOCALSTORAGE_KEY,
  SUMMER_COHORT_OPEN_EVENT,
  SUMMER_COHORT_RETURN_TO,
  SUMMER_COHORT_VIEW_TO,
} from "@/lib/summer-cohort";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Pages that already cover the modal's content — don't auto-pop on top of
// them. Manual dispatch of SUMMER_COHORT_OPEN_EVENT still works.
const SUPPRESS_AUTO_OPEN_PREFIXES = [
  "/summer-cohort",
  "/contribute/game-art",
  "/login",
  "/signup",
];

// Cap the wait for the "have you applied?" fetch before opening anyway.
// Keeps the modal snappy if the API is slow; the CTA defaults to "Apply".
const APPLIED_FETCH_TIMEOUT_MS = 600;

export default function SummerCohortModal() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  // null = not yet known; true/false = resolved.
  const [hasApplied, setHasApplied] = useState<boolean | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Prevent double-resolves from racing each other.
  const appliedResolvedRef = useRef(false);

  // Auto-open gate: localStorage + pathname + applied-state lookup.
  useEffect(() => {
    if (authLoading) return;
    let lastShown: string | null = null;
    try {
      lastShown = localStorage.getItem(SUMMER_COHORT_LOCALSTORAGE_KEY);
    } catch {
      // localStorage unavailable; skip auto-open entirely
      return;
    }
    if (lastShown === todayKey()) return;
    if (
      pathname &&
      SUPPRESS_AUTO_OPEN_PREFIXES.some((p) => pathname.startsWith(p))
    ) {
      return;
    }

    let cancelled = false;
    const resolveApplied = (value: boolean | null) => {
      if (cancelled || appliedResolvedRef.current) return;
      appliedResolvedRef.current = true;
      setHasApplied(value);
      setIsOpen(true);
    };

    if (!user) {
      resolveApplied(false);
      return () => {
        cancelled = true;
      };
    }

    // Race the apply-status fetch against a short timeout so a slow API
    // can't delay the modal indefinitely.
    const timer = setTimeout(() => resolveApplied(false), APPLIED_FETCH_TIMEOUT_MS);
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/summer-cohort/apply", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          resolveApplied(false);
          return;
        }
        const json = (await res.json()) as { application?: unknown | null };
        resolveApplied(json.application != null);
      } catch {
        resolveApplied(false);
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authLoading, user, pathname]);

  // Manual open via custom event — bypasses every gate.
  useEffect(() => {
    const handleOpen = () => {
      if (hasApplied === null) setHasApplied(false);
      setIsOpen(true);
    };
    window.addEventListener(SUMMER_COHORT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(SUMMER_COHORT_OPEN_EVENT, handleOpen);
  }, [hasApplied]);

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

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(SUMMER_COHORT_LOCALSTORAGE_KEY, todayKey());
    } catch {
      /* ignore */
    }
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  // Open cohorts only — what a brand new applicant can actually join.
  // Closed cohorts still render in the list (greyed) so the modal accurately
  // reflects the program shape, but the CTAs target the open cohort.
  const openCohort = useMemo(
    () => SUMMER_COHORTS.find((c) => !c.signupsClosed) ?? null,
    []
  );

  if (!isOpen) return null;

  // CTA strategy:
  //   - Already applied        → "View your cohort" (single primary)
  //   - Logged in, not applied → "Apply" (single primary, jumps to form)
  //   - Logged out             → "Create account & apply" (primary)
  //                              + small "Already have an account? Sign in"
  const applyHref = hasApplied ? SUMMER_COHORT_VIEW_TO : SUMMER_COHORT_RETURN_TO;
  const signedInPrimaryLabel = hasApplied ? "View your cohort" : "Apply";
  const newUserPrimaryHref = `/signup?redirect=${encodeURIComponent(SUMMER_COHORT_RETURN_TO)}`;
  const newUserSecondaryHref = `/login?redirect=${encodeURIComponent(SUMMER_COHORT_RETURN_TO)}`;
  const isLoggedOut = !user && !authLoading;
  // Modal headline reflects the next cohort actually open for signups.
  const headlineCohortLabel = openCohort?.label ?? "Cursor Boston Summer Cohort";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summer-cohort-title"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <button
          ref={closeButtonRef}
          onClick={handleClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Close summer cohort message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>

          <h2
            id="summer-cohort-title"
            className="text-2xl font-bold text-white mb-2"
          >
            {hasApplied
              ? "Cursor Boston Summer Cohort"
              : `Join ${headlineCohortLabel}`}
          </h2>
          <p className="text-neutral-400 mb-6">
            {hasApplied
              ? "Two six-week sessions to build with Cursor alongside other Boston developers, founders, and students."
              : openCohort
                ? `Six weeks building with Cursor alongside other Boston developers, founders, and students. Kicks off ${openCohort.startLabel}.`
                : "Two six-week sessions to build with Cursor alongside other Boston developers, founders, and students."}
          </p>

          <ul className="space-y-2 mb-6 text-left">
            {SUMMER_COHORTS.map((cohort) => {
              const closed = cohort.signupsClosed === true;
              return (
                <li
                  key={cohort.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border ${
                    closed
                      ? "bg-neutral-900/40 border-neutral-800 opacity-70"
                      : "bg-neutral-800/60 border-neutral-700"
                  }`}
                >
                  <span
                    className={`text-sm font-semibold ${
                      closed ? "text-neutral-400" : "text-white"
                    }`}
                  >
                    {cohort.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`text-xs ${
                        closed ? "text-neutral-500" : "text-neutral-300"
                      }`}
                    >
                      {cohort.startLabel} – {cohort.endLabel}
                    </span>
                    {closed ? (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400">
                        Closed
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Primary CTA. Logged-out new visitors get the create-account
              path so they don't have to discover the "Sign up" link buried
              at the bottom of /login. */}
          {isLoggedOut ? (
            <>
              <Link
                href={newUserPrimaryHref}
                onClick={handleClose}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                Create account &amp; apply
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <p className="mt-3 text-xs text-neutral-400">
                Already have an account?{" "}
                <Link
                  href={newUserSecondaryHref}
                  onClick={handleClose}
                  className="font-semibold text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <Link
              href={applyHref}
              onClick={handleClose}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
            >
              {signedInPrimaryLabel}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          <div className="mt-5 space-y-2 text-left">
            <a
              href={SUMMER_COHORT_IMMERSION.lumaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClose}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-neutral-800 bg-neutral-800/40 hover:bg-neutral-800/70 hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-wide text-emerald-400 font-semibold">
                  {SUMMER_COHORT_IMMERSION.label}
                </span>
                <span className="block text-sm text-white truncate">
                  {SUMMER_COHORT_IMMERSION.title}
                </span>
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-400 shrink-0"
                aria-hidden="true"
              >
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </a>

            <Link
              href="/contribute/game-art"
              onClick={handleClose}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-neutral-800 bg-neutral-800/40 hover:bg-neutral-800/70 hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-wide text-violet-300 font-semibold">
                  Designers
                </span>
                <span className="block text-sm text-white truncate">
                  Contribute art to the game
                </span>
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-400 shrink-0"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Community-discovery footer — replaces the old standalone
              welcome modal. Compact chips so the cohort CTA stays the
              hero, but folks who want to lurk first still get a path
              into Discord, Events, and the PR-ideas explorer. */}
          <div className="mt-6 pt-5 border-t border-neutral-800">
            <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-3 text-left">
              Or just explore the community
            </p>
            <div className="grid grid-cols-3 gap-2">
              <a
                href="https://discord.gg/Wsncg8YYqc"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg border border-neutral-800 bg-neutral-800/30 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]"
              >
                <DiscordIcon size={18} className="text-[#7983f5]" />
                <span className="text-xs font-medium text-neutral-200">Discord</span>
              </a>
              <Link
                href="/events"
                onClick={handleClose}
                className="flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg border border-neutral-800 bg-neutral-800/30 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-300"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="text-xs font-medium text-neutral-200">Events</span>
              </Link>
              <Link
                href="/pr-ideas"
                onClick={handleClose}
                className="flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg border border-neutral-800 bg-neutral-800/30 hover:bg-neutral-800/60 hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-300"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <path d="M9 9h6v6H9z" />
                </svg>
                <span className="text-xs font-medium text-neutral-200">PR Ideas</span>
              </Link>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="mt-4 text-neutral-500 hover:text-neutral-300 text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
