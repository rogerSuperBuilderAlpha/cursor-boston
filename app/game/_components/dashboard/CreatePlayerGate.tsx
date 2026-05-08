/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useState } from "react";

interface CreatePlayerGateProps {
  creating: boolean;
  error: string | null;
  onCreate: (displayName: string) => void;
}

/**
 * First-run gate: user is signed in but has no game player yet. Asks for
 * a general name, then spawns a starting cluster + 300 turns + 3-week
 * shield via `/api/game/player` (POST).
 */
export function CreatePlayerGate({
  creating,
  error,
  onCreate,
}: CreatePlayerGateProps) {
  const [nameInput, setNameInput] = useState("");
  const trimmed = nameInput.trim();
  const canSubmit = trimmed.length >= 3 && trimmed.length <= 32 && !creating;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-3xl font-bold mb-4">Begin your campaign</h1>
        <p className="text-neutral-600 dark:text-neutral-300 mb-3">
          You haven&apos;t enlisted yet. Name your general and we&apos;ll:
        </p>
        <ul className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 inline-block text-left list-disc ml-5">
          <li>Claim a 25-tile starting cluster, all already revealed.</li>
          <li>
            Grant you 300 starter turns — enough to assign every tile, pick a
            caste, recruit a real army, and still push the frontier before
            next Sunday&apos;s rollover.
          </li>
          <li>
            Drop a 3-week shield over you so no one can attack until
            you&apos;ve had a chance to develop your forces.
          </li>
          <li>
            From there: explore outward, develop the lands you take, build
            units, raid neighbors.
          </li>
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onCreate(trimmed);
          }}
          className="mb-3"
        >
          <label
            htmlFor="general-name"
            className="block text-left text-xs uppercase tracking-wide text-neutral-500 mb-1"
          >
            Name your general
          </label>
          <input
            id="general-name"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. Captain Ash, The Quiet Hand"
            maxLength={32}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-neutral-500 text-left">
            3-32 characters. Letters, digits, spaces, apostrophes, hyphens.
          </p>
        </form>
        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => onCreate(trimmed)}
            disabled={!canSubmit}
            className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
          >
            {creating ? "Spawning…" : "Enlist as a general"}
          </button>
          <Link
            href="/game/help"
            className="px-6 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            How to play
          </Link>
        </div>
      </div>
    </div>
  );
}
