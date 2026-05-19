/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";

/**
 * Top-of-dashboard invitation for designers to contribute art to the
 * game catalog. Renders unconditionally (no auth or per-player gate)
 * since most catalog entries still ship without art and a designer
 * landing here is exactly who we want to convert.
 *
 * Visual style is intentionally distinct from the status-alert banners
 * (eligibility = amber/emerald, caste-change = neutral) — violet reads
 * as a friendly invitation rather than something the player needs to
 * resolve.
 */
export function DesignersWantedCard() {
  return (
    <div
      className="mb-6 rounded-lg border border-violet-300/60 bg-violet-50 dark:border-violet-700/40 dark:bg-violet-950/30 p-4"
      role="region"
      aria-label="Designers wanted"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
            🎨 Designers wanted — help us bring the game to life
          </p>
          <p className="mt-1 text-sm text-violet-800/90 dark:text-violet-200/90">
            Most units, spells, and buildings still ship without art. If you
            can draw, your work goes straight into the catalog and into every
            player&apos;s game on the next page load.
          </p>
        </div>
        <Link
          href="/contribute/game-art"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-50 dark:focus-visible:ring-offset-violet-950"
        >
          Read the contributor guide
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
