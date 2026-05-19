/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";

interface NameYourGeneralGateProps {
  error: string | null;
  onSave: (displayName: string) => void;
}

/**
 * Legacy gate: players who spawned before names were required get
 * bounced through this picker on next visit. We retired anonymous IDs
 * because seeing `general-x9k2…` on the leaderboard wasn't memorable.
 */
export function NameYourGeneralGate({
  error,
  onSave,
}: NameYourGeneralGateProps) {
  const [nameInput, setNameInput] = useState("");
  const trimmed = nameInput.trim();
  const canSubmit = trimmed.length >= 3 && trimmed.length <= 32;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-3">Name your general</h1>
        <p className="text-neutral-600 dark:text-neutral-300 mb-6 text-sm leading-relaxed">
          We retired anonymous IDs. Pick a name your fellow generals will see
          on the map and the leaderboard. You can change it later.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSave(trimmed);
          }}
        >
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. Captain Ash"
            maxLength={32}
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm mb-2"
            autoComplete="off"
          />
          {error && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
          >
            Save name
          </button>
        </form>
      </div>
    </div>
  );
}
