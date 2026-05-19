/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { User } from "firebase/auth";
import { CastePickCard } from "@/app/game/setup/_components/CastePickCard";
import { CASTES } from "@/app/game/setup/_lib/constants";
import type { Caste, GamePlayer } from "@/lib/game/types";

const TILES_THRESHOLD = 1000;

interface Props {
  player: GamePlayer;
  user: User | null;
  onRefresh: () => Promise<void>;
}

/**
 * Conditional dashboard card. Shown once the player has reached the
 * `TILES_THRESHOLD` tiles-held mark and has not yet used their one-time
 * caste-change. Click to expand into a confirm-then-pick flow that POSTs
 * to /api/game/caste/change.
 *
 * Mounting is fully gated by the parent — this component renders nothing
 * if the player isn't eligible.
 */
export function CasteChangeCard({ player, user, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible =
    player.phase === "play" &&
    player.caste !== null &&
    player.stats.tilesHeld >= TILES_THRESHOLD &&
    (player.casteChangesUsed ?? 0) === 0;

  if (!eligible) return null;

  async function changeTo(newCaste: Caste) {
    if (!user) return;
    if (newCaste === player.caste) {
      setError("That's your current caste — pick a different one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/caste/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ caste: newCaste }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          data.error?.message ?? data.error ?? "Caste change failed"
        );
      }
      await onRefresh();
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caste change failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-purple-300 bg-purple-50 p-4 dark:border-purple-900/60 dark:bg-purple-900/10">
      <div className="flex items-start gap-3">
        <Sparkles
          className="mt-0.5 h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">
            You&apos;ve hit 1,000 tiles — caste switch unlocked
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-purple-900/80 dark:text-purple-200/80">
            One-time switch. Your current caste is{" "}
            <strong className="capitalize">{player.caste}</strong>. After
            you switch, your caste is <strong>permanent</strong> — there
            are no further changes. Skipping is fine; the unlock stays
            here until you use it.
          </p>
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="mt-3 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
            >
              Switch my caste…
            </button>
          ) : (
            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-purple-700 dark:text-purple-300">
                  Pick the caste you want to keep forever
                </p>
                <button
                  onClick={() => setExpanded(false)}
                  className="rounded-lg p-1 text-purple-700 transition-colors hover:bg-purple-100 dark:text-purple-300 dark:hover:bg-purple-900/30"
                  aria-label="Cancel caste change"
                >
                  <X
                    className="h-4 w-4"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {CASTES.filter((c) => c !== player.caste).map((c) => (
                  <CastePickCard
                    key={c}
                    caste={c}
                    busy={busy}
                    onChoose={() => void changeTo(c)}
                  />
                ))}
              </div>
              {error && (
                <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/10 dark:text-red-300">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
