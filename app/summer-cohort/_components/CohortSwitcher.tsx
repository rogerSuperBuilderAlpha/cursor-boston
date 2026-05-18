/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { SUMMER_COHORTS, type SummerCohortId } from "@/lib/summer-cohort";

interface CohortSwitcherProps {
  selectedCohort: SummerCohortId;
  onChange: (cohort: SummerCohortId) => void;
  /** Cohort ids the user is admitted to. Cohorts in this set get a small
   *  "you" pill so the switcher communicates the difference between
   *  member and observer modes. */
  memberCohorts?: ReadonlySet<SummerCohortId>;
}

export function CohortSwitcher({
  selectedCohort,
  onChange,
  memberCohorts,
}: CohortSwitcherProps) {
  return (
    <nav
      role="tablist"
      aria-label="Cohort selector"
      className="mb-6 -mx-1 overflow-x-auto"
    >
      <div className="flex min-w-max gap-1 px-1 pb-1">
        {SUMMER_COHORTS.map((cohort) => {
          const isActive = cohort.id === selectedCohort;
          const isMember = memberCohorts?.has(cohort.id) ?? false;
          const baseClasses =
            "shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors";
          const styleClasses = isActive
            ? "bg-emerald-500 text-white shadow-sm"
            : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800";
          return (
            <button
              key={cohort.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(cohort.id)}
              className={`${baseClasses} ${styleClasses}`}
            >
              <span>{cohort.label}</span>
              <span
                className={`ml-2 hidden text-xs font-medium sm:inline ${
                  isActive
                    ? "text-emerald-100"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {cohort.startLabel}
              </span>
              {isMember ? (
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  }`}
                >
                  You
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
