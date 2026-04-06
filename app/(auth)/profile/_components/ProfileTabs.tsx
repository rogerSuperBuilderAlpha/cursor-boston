"use client";

import type { Tab } from "../_types";
import { TAB_LABELS } from "../_types";

interface ProfileTabsProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export function ProfileTabs({ activeTab, setActiveTab }: ProfileTabsProps) {
  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800 mb-6">
      <nav className="flex gap-6 overflow-x-auto" aria-label="Profile sections">
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-foreground whitespace-nowrap ${
              activeTab === id
                ? "text-foreground border-b-2 border-emerald-500"
                : "text-neutral-500 dark:text-neutral-400 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
