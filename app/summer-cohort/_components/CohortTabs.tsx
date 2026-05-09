/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

export type CohortTabId =
  | "info"
  | "intake-survey"
  | "setup"
  | "game"
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

const ALL_TABS: readonly TabSpec[] = [
  { id: "info", label: "Cohort Info", shortLabel: "Cohort" },
  { id: "intake-survey", label: "Intake Survey", shortLabel: "Survey" },
  { id: "my-info", label: "My Info", shortLabel: "Me" },
  { id: "setup", label: "Setup Instructions", shortLabel: "Setup" },
  { id: "game", label: "Game", shortLabel: "Game" },
  { id: "week-1", label: "Week 1: PM", shortLabel: "W1" },
  { id: "week-2", label: "Week 2: Comms", shortLabel: "W2" },
  { id: "week-3", label: "Week 3: Vibe Marketing", shortLabel: "W3" },
  { id: "week-4", label: "Week 4: Ludwitt", shortLabel: "W4" },
  { id: "week-5", label: "Week 5: Startup", shortLabel: "W5" },
  { id: "week-6", label: "Week 6: OSS PR", shortLabel: "W6" },
];

interface CohortTabsProps {
  activeTab: CohortTabId;
  onChange: (tab: CohortTabId) => void;
  /** When true, the intake-survey tab renders with a "needs-attention" badge.
   *  When false (survey already submitted), the intake-survey tab is hidden. */
  showIntakeSurvey: boolean;
}

export function CohortTabs({ activeTab, onChange, showIntakeSurvey }: CohortTabsProps) {
  const tabs = ALL_TABS.filter((t) =>
    t.id === "intake-survey" ? showIntakeSurvey : true
  );
  return (
    <nav
      role="tablist"
      aria-label="Cohort dashboard sections"
      className="mt-6 -mx-1 overflow-x-auto"
    >
      <div className="flex min-w-max gap-1 px-1 pb-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const isIntake = tab.id === "intake-survey";
          const baseClasses =
            "shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors sm:text-sm sm:normal-case sm:tracking-normal";
          const styleClasses = isActive
            ? isIntake
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-emerald-500 text-white shadow-sm"
            : isIntake
              ? "border border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
              : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800";
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
              className={`${baseClasses} ${styleClasses}`}
            >
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {isIntake ? (
                <span
                  aria-hidden
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-600 align-middle dark:bg-amber-300"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
