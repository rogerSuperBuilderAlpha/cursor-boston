/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SPECIAL_UNITS_BY_ID } from "@/lib/game/content/special-units/_index";
import type { GamePlayer } from "@/lib/game/types";

interface SummonableUnitsCardProps {
  player: GamePlayer;
  /** Called after a successful summon / unsummon so the dashboard
   *  re-fetches the player doc. */
  onRefresh: () => void;
}

/**
 * Player-pool view of caste-themed special units summoned by farm heroes.
 * Stationed entries show where they're deployed and offer an "unsummon"
 * action; unstationed entries show a tile-id input + summon button.
 *
 * Special units aren't heroes — they have no stamina, no conversion, and
 * vaporize if the tile they're stationed on is captured.
 */
export function SummonableUnitsCard({
  player,
  onRefresh,
}: SummonableUnitsCardProps) {
  const { user } = useAuth();
  // Memoize so the empty-array fallback is stable across renders; otherwise
  // every render creates a fresh `[]` and downstream useMemo dependencies
  // would refire.
  const pool = useMemo(
    () => player.summonableSpecialUnits ?? [],
    [player.summonableSpecialUnits]
  );
  const [busyInstanceId, setBusyInstanceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tileInput, setTileInput] = useState<Record<string, string>>({});

  const callApi = useCallback(
    async (path: string, body: unknown, instanceId: string) => {
      if (!user) return;
      setError(null);
      setBusyInstanceId(instanceId);
      try {
        const token = await user.getIdToken();
        const res = await fetch(path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error?.message ?? data.error ?? "Action failed");
        }
        onRefresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setBusyInstanceId(null);
      }
    },
    [user, onRefresh]
  );

  const summary = useMemo(() => {
    let stationed = 0;
    let unstationed = 0;
    for (const u of pool) {
      if (u.stationedTileId) stationed += 1;
      else unstationed += 1;
    }
    return { stationed, unstationed };
  }, [pool]);

  if (pool.length === 0) return null;

  return (
    <section className="mb-6 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Summonable Special Units
        </h2>
        <span className="text-xs text-neutral-500">
          {summary.unstationed} ready · {summary.stationed} stationed
        </span>
      </div>
      {error && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <ul className="space-y-2">
        {pool.map((instance) => {
          const def = SPECIAL_UNITS_BY_ID.get(instance.defId);
          const isBusy = busyInstanceId === instance.instanceId;
          return (
            <li
              key={instance.instanceId}
              className="rounded border border-neutral-200 dark:border-neutral-800 p-2 text-sm"
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="font-semibold">
                  {def?.name ?? instance.defId}
                </span>
                <span className="text-xs text-neutral-500">
                  +{def?.attackBonus ?? 0} atk · +{def?.defenseBonus ?? 0} def
                </span>
              </div>
              {def?.flavor && (
                <p className="text-xs text-neutral-500 italic mt-0.5">
                  {def.flavor}
                </p>
              )}
              {instance.stationedTileId ? (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-neutral-500">
                    Stationed on{" "}
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {instance.stationedTileId}
                    </span>
                  </span>
                  <button
                    onClick={() =>
                      callApi(
                        "/api/game/special-units/unsummon",
                        { instanceId: instance.instanceId },
                        instance.instanceId
                      )
                    }
                    disabled={isBusy}
                    className="ml-auto px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {isBusy ? "…" : "Recall"}
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="tile id (e.g. q5r-3)"
                    value={tileInput[instance.instanceId] ?? ""}
                    onChange={(e) =>
                      setTileInput((prev) => ({
                        ...prev,
                        [instance.instanceId]: e.target.value,
                      }))
                    }
                    className="flex-1 px-2 py-1 text-xs font-mono rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                  <button
                    onClick={() => {
                      const tileId = (tileInput[instance.instanceId] ?? "").trim();
                      if (!tileId) {
                        setError("Enter a tile id first.");
                        return;
                      }
                      callApi(
                        "/api/game/special-units/summon",
                        {
                          instanceId: instance.instanceId,
                          targetTileId: tileId,
                        },
                        instance.instanceId
                      );
                    }}
                    disabled={isBusy}
                    className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isBusy ? "…" : "Summon"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
