/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  msUntilRefresh,
  type CachedMapView,
} from "@/lib/game/local-map-cache";
import type { ViewMode } from "../_lib/types";

interface Props {
  mode: ViewMode;
  onModeChange: (next: ViewMode) => void;
  cachedView: CachedMapView | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function PersonalMapToolbar({
  mode,
  onModeChange,
  cachedView,
  refreshing,
  onRefresh,
}: Props) {
  const ms = msUntilRefresh(cachedView);
  const allowed = ms === 0;
  // "5 min" rate-limit countdown. Round up to whole minutes for the button
  // copy so the user sees a stable 5/4/3/2/1 progression.
  const minutesLeft = Math.ceil(ms / 60_000);
  const lastFetched = cachedView
    ? new Date(cachedView.lastFetchedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs uppercase tracking-wide text-neutral-500 mr-1">
        View
      </span>
      <button
        onClick={() => onModeChange("personal")}
        className={`px-3 py-1.5 rounded-lg text-sm border ${
          mode === "personal"
            ? "bg-emerald-500 text-white border-emerald-500"
            : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        }`}
      >
        Personal
      </button>
      <button
        onClick={() => onModeChange("world")}
        className={`px-3 py-1.5 rounded-lg text-sm border ${
          mode === "world"
            ? "bg-emerald-500 text-white border-emerald-500"
            : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        }`}
        title="Fetch the whole world (no rate limit; rarely needed)"
      >
        🌐 Whole world
      </button>
      {mode === "personal" && (
        <>
          <button
            onClick={onRefresh}
            disabled={refreshing || !allowed}
            className="px-3 py-1.5 rounded-lg text-sm border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              !allowed
                ? `Cooldown — refresh available in ~${minutesLeft} min`
                : "Refetch your map from the server"
            }
          >
            {refreshing
              ? "Refreshing…"
              : allowed
                ? "↻ Refresh map"
                : `↻ Refresh in ~${minutesLeft}m`}
          </button>
          {lastFetched && (
            <span className="text-xs text-neutral-500">
              Last fetched at {lastFetched}
            </span>
          )}
        </>
      )}
    </div>
  );
}
