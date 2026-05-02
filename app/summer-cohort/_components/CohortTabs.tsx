/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

export type CohortTabId =
  | "info"
  | "week-1"
  | "week-2"
  | "week-3"
  | "week-4"
  | "week-5"
  | "week-6"
  | "my-info";

interface TabSpec {
  id: CohortTabId;
  label: string;
  shortLabel: string;
}

const TABS: readonly TabSpec[] = [
  { id: "info", label: "Cohort Info", shortLabel: "Cohort" },
  { id: "my-info", label: "My Info", shortLabel: "Me" },
  { id: "week-1", label: "Week 1: PM", shortLabel: "W1" },
  { id: "week-2", label: "Week 2: Comms", shortLabel: "W2" },
  { id: "week-3", label: "Week 3: Marketing", shortLabel: "W3" },
  { id: "week-4", label: "Week 4: Ludwitt", shortLabel: "W4" },
  { id: "week-5", label: "Week 5: Startup", shortLabel: "W5" },
  { id: "week-6", label: "Week 6: OSS PR", shortLabel: "W6" },
];

interface CohortTabsProps {
  activeTab: CohortTabId;
  onChange: (tab: CohortTabId) => void;
}

export function CohortTabs({ activeTab, onChange }: CohortTabsProps) {
  return (
    <nav
      role="tablist"
      aria-label="Cohort dashboard sections"
      className="mt-6 -mx-1 overflow-x-auto"
    >
      <div className="flex min-w-max gap-1 px-1 pb-1">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={
                isActive
                  ? "shrink-0 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-sm transition-colors sm:text-sm sm:normal-case sm:tracking-normal"
                  : "shrink-0 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:text-sm sm:normal-case sm:tracking-normal"
              }
            >
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
