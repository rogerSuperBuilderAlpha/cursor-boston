/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { Caste, GamePlayer } from "@/lib/game/types";

const CASTE_DOT: Record<Caste, string> = {
  white: "#e5e7eb",
  blue: "#60a5fa",
  black: "#a78bfa",
  red: "#f87171",
  green: "#4ade80",
};

interface DashboardHeaderProps {
  player: GamePlayer;
  renaming: boolean;
  renameInput: string;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameCancel: () => void;
  onRenameSubmit: () => void;
}

/**
 * Page header: caste dot + general name (or inline rename form). Lives
 * at the top of the dashboard above the eligibility banner.
 */
export function DashboardHeader({
  player,
  renaming,
  renameInput,
  onRenameStart,
  onRenameChange,
  onRenameCancel,
  onRenameSubmit,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {player.caste && (
          <span
            aria-hidden="true"
            className="inline-block w-3 h-3 rounded-full border border-neutral-300 dark:border-neutral-700 shrink-0"
            style={{ background: CASTE_DOT[player.caste] }}
            title={`${player.caste} caste`}
          />
        )}
        {renaming ? (
          <form
            className="flex items-center gap-2 min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              onRenameSubmit();
            }}
          >
            <input
              type="text"
              value={renameInput}
              onChange={(e) => onRenameChange(e.target.value)}
              maxLength={32}
              autoFocus
              className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xl font-semibold w-64 max-w-full"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Escape") onRenameCancel();
              }}
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onRenameCancel}
              className="px-2 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Cancel
            </button>
          </form>
        ) : (
          <h1 className="text-3xl font-bold truncate">{player.displayName}</h1>
        )}
      </div>
      {!renaming && (
        <button
          onClick={onRenameStart}
          className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline shrink-0"
          title="Rename your general"
        >
          Rename
        </button>
      )}
    </div>
  );
}
