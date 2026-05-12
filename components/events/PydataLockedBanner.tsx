/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";

/**
 * Shown at the top of /events when a user was redirected away from the
 * gated PyData event page (`?pydataLocked=1`). Dismissible — once gone
 * for the session it stays gone.
 */
export function PydataLockedBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-4 dark:bg-amber-500/15"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="flex-1 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-semibold">
            PyData × Cursor Boston attendance is locked
          </p>
          <p className="mt-1">
            We&apos;ve handed Moderna the final 150-person door list, so only
            confirmed attendees can view that event page. Confirmed attendees
            received an email from Moderna (via Envoy) with NDA paperwork that
            must be completed before entry. If you can no longer attend,
            there&apos;s no need to contact us.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notice"
          className="-mr-1 shrink-0 rounded p-1 text-amber-800 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-200"
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
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
