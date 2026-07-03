"use client";

import { useMemo } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import MilestoneBattery from "@/components/MilestoneBattery";
import TaskCompleteToasts from "@/components/TaskCompleteToasts";
import { useSoundPreference } from "@/hooks/useSoundPreference";
import { useTaskSync } from "@/hooks/useTaskSync";
import { getCompletedCount, getCompletionPercent, initialProject } from "@/lib/project";

export default function Dashboard() {
  const { tasks, status, isLoading, moveTask, completions, dismissCompletion } = useTaskSync();
  const { soundEnabled, toggleSound } = useSoundPreference();

  const percent = useMemo(() => getCompletionPercent(tasks), [tasks]);
  const completedCount = useMemo(() => getCompletedCount(tasks), [tasks]);

  return (
    <>
      <TaskCompleteToasts completions={completions} onDismiss={dismissCompletion} />

      <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Dashboard</p>
            <p className="mt-1 text-lg font-medium text-foreground">{initialProject.name}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSound}
              className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs text-muted transition-colors hover:border-emerald-200 hover:text-foreground"
              title={soundEnabled ? "Mute completion chime" : "Enable completion chime"}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
              {soundEnabled ? "Chime on" : "Chime off"}
            </button>

            <div
              className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs text-muted"
              title={
                status === "live"
                  ? "Receiving live updates from the server"
                  : status === "connecting"
                    ? "Connecting to live updates"
                    : "Live updates disconnected"
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "live"
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                    : status === "connecting"
                      ? "animate-pulse bg-amber-400"
                      : "bg-rose-400"
                }`}
              />
              {status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
            </div>

            <div className="hidden rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted sm:block">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </header>

        <div className="space-y-8">
          <MilestoneBattery
            percent={percent}
            milestone={initialProject.milestone}
            completedCount={completedCount}
            totalCount={tasks.length}
          />

          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Workspace</h2>
              <p className="mt-1 text-sm text-muted">
                Drag cards across columns, or merge a PR with{" "}
                <span className="font-mono text-xs text-foreground">Fixes #3</span> to auto-complete
                task 3 while you stay in the terminal.
              </p>
            </div>

            {isLoading ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted">
                Loading workspace…
              </div>
            ) : (
              <KanbanBoard tasks={tasks} onMoveTask={moveTask} />
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function SoundOnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M10 3.75a.75.75 0 0 0-1.28-.53L5.47 6.47A.75.75 0 0 1 4.9 6.7H3.25A1.75 1.75 0 0 0 1.5 8.45v3.1A1.75 1.75 0 0 0 3.25 13.3H4.9a.75.75 0 0 1 .57.23l3.25 3.25A.75.75 0 0 0 10 16.25V3.75Z" />
      <path d="M13.07 6.93a.75.75 0 0 1 1.06 0 5.5 5.5 0 0 1 0 7.78.75.75 0 1 1-1.06-1.06 4 4 0 0 0 0-5.66.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M10 3.75a.75.75 0 0 0-1.28-.53L5.47 6.47A.75.75 0 0 1 4.9 6.7H3.25A1.75 1.75 0 0 0 1.5 8.45v3.1A1.75 1.75 0 0 0 3.25 13.3H4.9a.75.75 0 0 1 .57.23l3.25 3.25A.75.75 0 0 0 10 16.25V3.75Z" />
      <path d="M15.28 6.22a.75.75 0 0 1 0 1.06l-1.47 1.47 1.47 1.47a.75.75 0 1 1-1.06 1.06l-1.47-1.47-1.47 1.47a.75.75 0 1 1-1.06-1.06l1.47-1.47-1.47-1.47a.75.75 0 1 1 1.06-1.06l1.47 1.47 1.47-1.47a.75.75 0 0 1 1.06 0Z" />
    </svg>
  );
}
