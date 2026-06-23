/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { DiscordIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import {
  SUMMER_COHORT_LOCALSTORAGE_KEY,
  SUMMER_COHORT_OPEN_EVENT,
  SUMMER_COHORT_RETURN_TO,
  SUMMER_COHORT_VIEW_TO,
} from "@/lib/summer-cohort";

// Tentative kickoff for the Hult Cohort Developer Program pilot (Cohort 2).
const START_LABEL = "Thursday, July 9";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Pages that already cover the modal's content — don't auto-pop on top of
// them. Manual dispatch of SUMMER_COHORT_OPEN_EVENT still works.
// NOTE: /summer-cohort is intentionally NOT suppressed during the Hult
// transition — every cohort surface should surface the launch message.
const SUPPRESS_AUTO_OPEN_PREFIXES = [
  "/contribute/game-art",
  "/login",
  "/signup",
];

// Cap the wait for the "have you applied?" fetch before opening anyway.
// Keeps the modal snappy if the API is slow; the CTA defaults to "register".
const APPLIED_FETCH_TIMEOUT_MS = 600;

export default function SummerCohortModal() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  // null = not yet known; true/false = resolved.
  const [hasApplied, setHasApplied] = useState<boolean | null>(null);
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

  const handleClose = useCallback(() => {
    try {
      localStorage.setItem(SUMMER_COHORT_LOCALSTORAGE_KEY, todayKey());
    } catch {
      /* ignore */
    }
    setIsOpen(false);
  }, []);

  const isLoggedOut = !user && !authLoading;
  const isRegistered = hasApplied === true;
  // Registered users land on their details/view; everyone else heads to the
  // apply form, which still registers them for Cohort 2.
  const registerHref = isRegistered ? SUMMER_COHORT_VIEW_TO : SUMMER_COHORT_RETURN_TO;
  const newUserPrimaryHref = `/signup?redirect=${encodeURIComponent(SUMMER_COHORT_RETURN_TO)}`;
  const newUserSecondaryHref = `/login?redirect=${encodeURIComponent(SUMMER_COHORT_RETURN_TO)}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      titleId="summer-cohort-title"
      closeButtonLabel="Close cohort announcement"
    >
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
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          </svg>
        </div>

        <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-2">
          Launching soon
        </p>
        <h2 id="summer-cohort-title" className="text-2xl font-bold text-white mb-3">
          The Hult Cohort Developer Program
        </h2>
        <p className="text-neutral-400 mb-5">
          Cursor Boston has teamed up with{" "}
          <span className="text-neutral-200 font-medium">
            Hult International Business School
          </span>
          —Cohort 2 is becoming the inaugural pilot of the new Hult Cohort
          Developer Program. We&rsquo;re putting the finishing touches on the new
          platform, and lots more info is coming over the next two weeks.
        </p>

        <div className="mb-6 px-4 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
          <span className="block text-xs uppercase tracking-wide text-emerald-300 font-semibold">
            Be ready to start
          </span>
          <span className="block text-lg font-bold text-white">{START_LABEL}</span>
        </div>

        {isRegistered ? (
          <div className="px-4 py-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-left">
            <p className="flex items-start gap-2 text-emerald-200 font-semibold">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 mt-0.5 text-emerald-400"
                aria-hidden="true"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              You&rsquo;re registered for Cohort 2.
            </p>
            <p className="mt-2 text-sm text-neutral-300">
              Nothing else to do right now — you&rsquo;ll receive all the email
              updates from Cursor Boston as we finalize the details. Just be ready
              to start on {START_LABEL}.
            </p>
          </div>
        ) : isLoggedOut ? (
          <>
            <p className="text-sm text-neutral-300 mb-3">
              Register for Cohort 2 to lock in your spot in the pilot and get
              every update by email.
            </p>
            <Link
              href={newUserPrimaryHref}
              onClick={handleClose}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
            >
              Create account &amp; register
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
          <>
            <p className="text-sm text-neutral-300 mb-3">
              Register for Cohort 2 so you receive all the email updates and your
              spot in the pilot is confirmed.
            </p>
            <Link
              href={registerHref}
              onClick={handleClose}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
            >
              Register for Cohort 2
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
          </>
        )}

        {/* Community-discovery footer — folks who want to lurk first still get
            a path into Discord, Events, and the PR-ideas explorer. */}
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
    </Modal>
  );
}
