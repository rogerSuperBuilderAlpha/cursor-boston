/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { GamePlayer } from "@/lib/game/types";
import { magicMultiplier } from "@/lib/game/combat";
import {
  ARMAGEDDON_TILE_GATE,
  ARMAGEDDON_TURN_COST,
  SEAL_COUNT,
  computeArmageddonSuccessChanceFromMultiplier,
} from "@/lib/game/content/armageddon";

interface ApocalypsePanelProps {
  user: User;
  player: GamePlayer;
  /** Count of magic-typed tiles the player owns. Parent derives from its
   *  own tile list and passes in — keeps this panel from importing MapTile
   *  and lets the parent cache / override the value. */
  magicLandCount: number;
  // Optional global counter so the panel can display "M / 7 seals broken"
  // without an extra fetch. Pass null when unknown.
  sealsBroken: number | null;
  /** Called regardless of cast outcome (turns deducted either way). Use to
   *  refresh parent state after the API returns. */
  onAfterCast?: () => void;
}

interface LastCast {
  sealBroken: boolean;
  successChance: number;
  sealsBroken: number;
  shouldTriggerResolve: boolean;
}

/**
 * Top-of-page panel on /game/armageddon that surfaces the universal
 * Armageddon spell. Locked under ARMAGEDDON_TILE_GATE tiles. When
 * unlocked, shows the live success chance (derived from magic-land
 * count + magic-multiplier upgrades) and a destructive cast button.
 * Outcome flash renders in-place so the player doesn't lose context
 * after rolling.
 */
export function ApocalypsePanel({
  user,
  player,
  magicLandCount,
  sealsBroken,
  onAfterCast,
}: ApocalypsePanelProps) {
  const tilesHeld = player.stats?.tilesHeld ?? 0;
  const successChance = useMemo(() => {
    const mm = magicMultiplier(magicLandCount, player.activeUpgrades ?? {});
    return computeArmageddonSuccessChanceFromMultiplier(mm);
  }, [magicLandCount, player.activeUpgrades]);

  const unlocked = tilesHeld >= ARMAGEDDON_TILE_GATE;
  const affordable = player.turnsRemaining >= ARMAGEDDON_TURN_COST;
  const allSealsBroken = sealsBroken !== null && sealsBroken >= SEAL_COUNT;
  const canCast = unlocked && affordable && !allSealsBroken;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<LastCast | null>(null);

  const cast = async () => {
    if (!canCast || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/spell/armageddon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Armageddon cast failed";
        throw new Error(msg);
      }
      setLast({
        sealBroken: Boolean(data.sealBroken),
        successChance: Number(data.successChance ?? successChance),
        sealsBroken: Number(data.sealsBroken ?? 0),
        shouldTriggerResolve: Boolean(data.shouldTriggerResolve),
      });
      if (onAfterCast) onAfterCast();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Armageddon cast failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        "rounded-lg border p-5 mb-6 " +
        (unlocked
          ? "border-red-800 bg-red-950/30 text-red-100 dark:border-red-700"
          : "border-neutral-300 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 text-neutral-700 dark:text-neutral-300")
      }
    >
      <div className="mb-2">
        <div className="text-xs uppercase tracking-widest opacity-70">
          Apocalypse
        </div>
        <h2 className="text-2xl font-bold mt-1">Armageddon</h2>
      </div>

      <p className="text-sm leading-relaxed mb-4 opacity-90">
        Strike the heavens. Risk{" "}
        <strong className="font-mono">{ARMAGEDDON_TURN_COST}</strong> turns to
        break one of the seven Seals. Low base chance — your magic-optimized
        kingdom raises the odds. When the seventh Seal breaks, the world ends
        and is remade.
      </p>

      {!unlocked && (
        <div className="rounded-md bg-neutral-200 dark:bg-neutral-800 px-3 py-2 text-sm">
          🔒 Locked. Unlocks at{" "}
          <strong className="font-mono">
            {ARMAGEDDON_TILE_GATE.toLocaleString()}
          </strong>{" "}
          tiles. You hold{" "}
          <strong className="font-mono">{tilesHeld.toLocaleString()}</strong>.
        </div>
      )}

      {unlocked && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
            <div>
              <div className="text-xs uppercase opacity-70">Cost</div>
              <div className="font-mono text-lg">{ARMAGEDDON_TURN_COST}t</div>
            </div>
            <div>
              <div className="text-xs uppercase opacity-70">Success chance</div>
              <div className="font-mono text-lg text-amber-300">
                {(successChance * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs uppercase opacity-70">Magic tiles</div>
              <div className="font-mono text-lg">{magicLandCount}</div>
            </div>
            <div>
              <div className="text-xs uppercase opacity-70">Seals broken</div>
              <div className="font-mono text-lg">
                {sealsBroken ?? "—"} / {SEAL_COUNT}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={cast}
            disabled={!canCast || busy}
            className={
              "w-full sm:w-auto px-6 py-3 rounded-md font-semibold text-sm transition " +
              (canCast && !busy
                ? "bg-red-700 hover:bg-red-600 text-white"
                : "bg-neutral-600 text-neutral-300 cursor-not-allowed")
            }
          >
            {busy
              ? "Striking the heavens…"
              : allSealsBroken
                ? "All seals broken — Armageddon is upon us"
                : !affordable
                  ? `Need ${ARMAGEDDON_TURN_COST} turns (have ${player.turnsRemaining})`
                  : "Cast Armageddon (100 turns)"}
          </button>
        </>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-red-200 px-3 py-2 text-sm text-red-900 dark:bg-red-900 dark:text-red-100">
          {error}
        </div>
      )}

      {last && (
        <div
          className={
            "mt-3 rounded-md px-3 py-2 text-sm " +
            (last.sealBroken
              ? "bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
              : "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200")
          }
        >
          {last.sealBroken ? (
            <>
              <strong>A Seal cracks.</strong> The world dims briefly. Seals
              broken: {last.sealsBroken} / {SEAL_COUNT}.
              {last.shouldTriggerResolve && (
                <div className="mt-1 font-semibold">
                  The seventh Seal has broken. The world is being remade.
                </div>
              )}
            </>
          ) : (
            <>
              <strong>The ritual fizzles.</strong> No seal breaks this time.
              Odds were {(last.successChance * 100).toFixed(1)}%.
            </>
          )}
        </div>
      )}
    </div>
  );
}
