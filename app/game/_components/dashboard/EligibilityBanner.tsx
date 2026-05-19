/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCountdown } from "../../_lib/dashboard-helpers";
import type { Eligibility } from "../../_lib/dashboard-types";

/**
 * PR-eligibility banner: are you connected to GitHub, did you merge
 * something this week, and how long until the next rollover. The
 * countdown ticks once per second.
 *
 * Three render modes:
 *   - GitHub not connected → amber banner with link to /profile
 *   - Connected + has merged a PR this week → emerald (eligible)
 *   - Connected + no PR this week → orange (not eligible — yet)
 */
export function EligibilityBanner({ eligibility }: { eligibility: Eligibility }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const rolloverAt = new Date(eligibility.nextRolloverIso).getTime();
  const remaining = rolloverAt - now;
  const eligible = eligibility.mergedPrCountThisWeek > 0;
  const githubConnected = eligibility.githubLogin !== null;

  if (!githubConnected) {
    return (
      <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm leading-relaxed">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-3 mb-1">
          <strong className="text-amber-900 dark:text-amber-200">
            ⚠ GitHub not connected
          </strong>
          <span className="text-xs text-amber-800 dark:text-amber-300 font-mono">
            Next rollover: {formatCountdown(remaining)}
          </span>
        </div>
        <p className="text-amber-900 dark:text-amber-200">
          Generals earns turns by tracking PRs you merge into this repo.
          Without a connected GitHub account, the rollover can&apos;t see
          your merges.{" "}
          <Link
            href="/profile"
            className="underline hover:no-underline font-medium"
          >
            Connect GitHub on your profile →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`mb-6 rounded-lg border p-4 text-sm leading-relaxed ${
        eligible
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
          : "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-3 mb-1">
        <strong>
          {eligible ? "✓" : "✗"} GitHub connected as{" "}
          <span className="font-mono break-all">{eligibility.githubLogin}</span>
        </strong>
        <span className="text-xs font-mono">
          Next rollover: {formatCountdown(remaining)}
        </span>
      </div>
      {eligible ? (
        <p>
          You&apos;ve merged{" "}
          <strong>
            {eligibility.mergedPrCountThisWeek} PR
            {eligibility.mergedPrCountThisWeek === 1 ? "" : "s"}
          </strong>{" "}
          this week. You&apos;ll receive 100 turns at the next rollover.
        </p>
      ) : (
        <p>
          You haven&apos;t merged a PR this week yet. Merge at least one
          before the rollover (Sunday 00:00 EST) to earn 100 turns next
          week. No PR, no turns.
        </p>
      )}
    </div>
  );
}
