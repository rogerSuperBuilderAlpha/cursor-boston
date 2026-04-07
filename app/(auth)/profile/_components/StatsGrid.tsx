"use client";

import { useProfileContext } from "../_contexts/ProfileContext";

export function StatsGrid() {
  const { data: { stats, loadingData } } = useProfileContext();

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Events Registered", value: stats?.eventsRegistered },
          { label: "Events Attended", value: stats?.eventsAttended },
          { label: "Talks Submitted", value: stats?.talksSubmitted },
          { label: "Talks Given", value: stats?.talksGiven },
          { label: "Pull Requests", value: stats?.pullRequestsCount },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200 dark:border-neutral-800 text-center">
            <p className="text-3xl font-bold text-foreground">{loadingData ? "-" : value || 0}</p>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-500 mb-6">
        Contributor badge progress is based on merged pull requests in this repository.
      </p>
    </>
  );
}
