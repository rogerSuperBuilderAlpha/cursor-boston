/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
const SUPPRESS_AUTO_OPEN_PREFIXES = ["/summer-cohort", "/contribute/game-art"];

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

  if (!isOpen) return null;

  const ctaHref = hasApplied ? SUMMER_COHORT_VIEW_TO : SUMMER_COHORT_RETURN_TO;
  const ctaLabel = hasApplied ? "View your cohort" : "Apply";

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
            Cursor Boston Summer Cohort
          </h2>
          <p className="text-neutral-400 mb-6">
            Two six-week sessions to build with Cursor alongside other Boston
            developers, founders, and students.
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

          <Link
            href={ctaHref}
            onClick={handleClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
          >
            {ctaLabel}
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
