/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  SPORTS_HACK_2026_ATTENDANCE_LIMIT,
  SPORTS_HACK_2026_EVENT_DATE,
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_SHORT_NAME,
} from "@/lib/sports-hack-2026";

/**
 * Bottom-right nudge for users who have claimed a Sports Hack spot but
 * haven't completed the second-step attendance confirmation. Mounted
 * site-wide in AppShell. Suppression rules (any failure hides the modal):
 *
 *   1. user is signed in and auth context is resolved
 *   2. pathname is not under /hackathons/sports-hack-2026
 *      (the event pages have their own inline confirm UI)
 *   3. event date has not passed
 *   4. sessionStorage 'sports-hack-2026-confirm-dismissed' is unset
 *   5. me.signedUp === true && me.attendingConfirmed === false
 */

const DISMISS_STORAGE_KEY = "sports-hack-2026-confirm-dismissed";

type SignupMeResponse = {
  me: {
    signedUp: boolean;
    attendingConfirmed?: boolean;
  } | null;
};

function isPastEventDate(): boolean {
  // SPORTS_HACK_2026_EVENT_DATE is "2026-05-26" in ET. Compare to UTC midnight
  // of the day after — gives the modal one full day of grace before hiding.
  const cutoff = new Date(`${SPORTS_HACK_2026_EVENT_DATE}T23:59:59-04:00`);
  return Date.now() > cutoff.getTime();
}

export function SportsHackConfirmAttendanceModal() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [eligibleToShow, setEligibleToShow] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Initialize the dismissed flag from sessionStorage. Done in effect (not
  // useState init) because sessionStorage is not available in SSR.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissed(
        window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === "1"
      );
    } catch {
      // sessionStorage can throw in some private-browsing modes — treat as
      // not-dismissed.
    }
  }, []);

  const onPath = pathname?.startsWith("/hackathons/sports-hack-2026") ?? false;
  const suppressedByContext =
    loading || !user || dismissed || onPath || isPastEventDate();

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (suppressedByContext) {
      setEligibleToShow(false);
      return;
    }
    if (!user || fetchedRef.current) return;
    fetchedRef.current = true;
    let aborted = false;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/hackathons/events/${SPORTS_HACK_2026_EVENT_ID}/signup`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const json = (await res.json()) as SignupMeResponse;
        if (aborted) return;
        const me = json.me;
        if (
          me &&
          me.signedUp === true &&
          me.attendingConfirmed !== true
        ) {
          setEligibleToShow(true);
        }
      } catch {
        // Non-critical — silently skip the nudge if the lookup fails.
      }
    })();
    return () => {
      aborted = true;
    };
  }, [user, suppressedByContext]);

  const handleConfirm = useCallback(async () => {
    if (!user) return;
    setConfirming(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/hackathons/events/${SPORTS_HACK_2026_EVENT_ID}/confirm-attendance`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(json.error || "Could not confirm attendance");
      }
      // No sessionStorage flag set — me.attendingConfirmed will now be true,
      // which naturally suppresses the modal on next mount.
      setEligibleToShow(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm attendance");
    } finally {
      setConfirming(false);
    }
  }, [user]);

  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(DISMISS_STORAGE_KEY, "1");
      } catch {
        // Best-effort — if storage fails, the modal still hides for this mount.
      }
    }
    setDismissed(true);
    setEligibleToShow(false);
  }, []);

  if (suppressedByContext || !eligibleToShow) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Confirm Sports Hack attendance"
      className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)] rounded-2xl border border-emerald-500/30 bg-white p-4 shadow-2xl dark:border-emerald-500/40 dark:bg-neutral-900"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
        className="absolute top-2 right-2 rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className="pr-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          {SPORTS_HACK_2026_SHORT_NAME} · May 26
        </p>
        <h2 className="mt-1 text-base font-semibold text-foreground">
          Lock in your spot
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          You&apos;ve claimed a Sports Hack spot. Confirm you&apos;ll attend so
          you&apos;re counted in the {SPORTS_HACK_2026_ATTENDANCE_LIMIT}-seat
          guaranteed-entry cap.
        </p>
        {error ? (
          <p className="mt-2 rounded-md bg-rose-500/10 px-2 py-1 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={() => void handleConfirm()}
            className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {confirming ? "Confirming…" : "Confirm I'll attend"}
          </button>
          <Link
            href={`/hackathons/${SPORTS_HACK_2026_EVENT_ID}/signup`}
            onClick={handleDismiss}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
