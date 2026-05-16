/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import type { GameWorldMeta, SealRecord } from "@/lib/game/types";
import {
  ARMAGEDDON_TILE_GATE,
  SEAL_COUNT,
} from "@/lib/game/content/armageddon";
import type { TopLeaderRow } from "../../_lib/dashboard-types";

function formatRelative(value: SealRecord["brokenAt"]): string {
  if (!value) return "";
  const d =
    value instanceof Date
      ? value
      : typeof (value as { toDate?: () => Date }).toDate === "function"
        ? (value as { toDate: () => Date }).toDate()
        : new Date(0);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "just now";
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

interface SealsPanelProps {
  worldMeta: GameWorldMeta | null;
  /** Top kingdoms by tilesHeld. The panel renders kingdoms ≥10k tiles
   *  ("at the gate") when any exist; otherwise the top 5 ("path to the
   *  gate"). Empty array → render no contender list. */
  topLeaders: TopLeaderRow[];
}

/**
 * Global end-game status panel. Renders the 7 Seals with broken/unbroken
 * state and per-seal attribution tooltips. Mounted full-width above the
 * per-player cards because it's shared state (every player sees the same
 * count). When armageddonState === "resolving", overlays a banner so
 * everyone knows turn-spending is briefly refused.
 */
export function SealsPanel({ worldMeta, topLeaders }: SealsPanelProps) {
  if (!worldMeta) return null;
  const sealsBroken = worldMeta.sealsBroken ?? 0;
  const seasonNumber = worldMeta.seasonNumber ?? 1;
  const armageddonState = worldMeta.armageddonState ?? "active";

  // Build the canonical 7-slot view, defaulting any missing entries.
  const seals: SealRecord[] = Array.from({ length: SEAL_COUNT }, (_, i) => {
    return worldMeta.seals?.[i] ?? { index: i, broken: false };
  });

  // Contender list: kingdoms over the Armageddon gate (≥10k tiles) get
  // top billing; if nobody's there yet, fall back to the top 5 by tiles
  // so the dashboard always shows "who's coming for the gate".
  const atGate = topLeaders.filter((p) => p.tilesHeld >= ARMAGEDDON_TILE_GATE);
  const contenders = atGate.length > 0 ? atGate : topLeaders.slice(0, 5);
  const contenderHeading =
    atGate.length > 0
      ? `${atGate.length} kingdom${atGate.length === 1 ? "" : "s"} at the gate (≥${ARMAGEDDON_TILE_GATE.toLocaleString()} tiles)`
      : "Top kingdoms — path to the gate";

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Season {seasonNumber} — The Seven Seals
          </div>
          <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {sealsBroken} / {SEAL_COUNT} broken
          </div>
        </div>
        <Link
          href="/game/armageddon"
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          View hall of fame →
        </Link>
      </div>

      {armageddonState === "resolving" && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          Armageddon is upon us — the world is being remade. Turn-spending
          actions are refused until the next age begins.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {seals.map((s, i) => {
          const broken = s.broken;
          const tooltip = broken
            ? `Broken by ${s.brokenBy?.displayName ?? "—"}` +
              (s.brokenBy?.caste ? ` (${s.brokenBy.caste})` : "") +
              `\n${formatRelative(s.brokenAt)}`
            : `Seal ${i + 1} — unbroken`;
          return (
            <div
              key={i}
              title={tooltip}
              className={
                "flex flex-col items-center w-14 h-14 rounded-md border text-xs select-none " +
                (broken
                  ? "border-red-700 bg-red-100 text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-200"
                  : "border-neutral-300 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400")
              }
            >
              <div className="text-lg leading-none mt-2">
                {broken ? "✦" : "○"}
              </div>
              <div className="mt-1 text-[10px]">#{i + 1}</div>
            </div>
          );
        })}
      </div>

      {contenders.length > 0 && (
        <div className="mt-4 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/40 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
            {contenderHeading}
          </div>
          <ol className="space-y-1 text-sm">
            {contenders.map((p, i) => {
              const atGateMarker = p.tilesHeld >= ARMAGEDDON_TILE_GATE;
              return (
                <li
                  key={p.userId}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="truncate">
                    <span className="font-mono text-xs opacity-60 mr-2">
                      #{i + 1}
                    </span>
                    <strong className="text-neutral-900 dark:text-neutral-100">
                      {p.displayName || "—"}
                    </strong>
                    {p.caste && (
                      <span className="text-xs opacity-70 ml-1">
                        ({p.caste})
                      </span>
                    )}
                    {atGateMarker && (
                      <span className="ml-2 text-xs font-semibold text-red-700 dark:text-red-300">
                        ✦ at the gate
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                    {p.tilesHeld.toLocaleString()} tiles
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        At <span className="font-mono">10,000</span> tiles, the Armageddon
        spell unlocks. Each cast costs 100 turns and rolls for a single
        Seal — your magic-optimized kingdom raises the odds. When the 7th
        Seal breaks, the world ends and a weighted lottery decides who
        carries glory into the next age.
      </p>
    </div>
  );
}
