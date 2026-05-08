/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useMemo, useState } from "react";
import { getSpellsForCasteAndType } from "@/lib/game/content";
import type { Caste, IntelReport } from "@/lib/game/types";

interface SpyActionProps {
  caste: Caste;
  tilesHeld: number;
  turnsRemaining: number;
  onSuccess: () => void;
}

/**
 * Cast the caste's intel ("spy") spell on a target enemy tile. The threat
 * box doesn't currently include a tile-picker UI, so this card takes a
 * tileId text input — players will typically paste from the map.
 */
export function SpyAction({
  caste,
  tilesHeld,
  turnsRemaining,
  onSuccess,
}: SpyActionProps) {
  const intelSpell = useMemo(() => {
    const all = getSpellsForCasteAndType(caste, "intel");
    return all[0] ?? null;
  }, [caste]);

  const [targetTileId, setTargetTileId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<IntelReport | null>(null);
  const [detected, setDetected] = useState(false);

  if (!intelSpell) return null;

  const tilesGateMet = tilesHeld >= intelSpell.minTilesRequired;
  const canAfford = turnsRemaining >= intelSpell.turnCost;

  async function run() {
    if (!intelSpell || !targetTileId.trim()) return;
    setBusy(true);
    setError(null);
    setReport(null);
    setDetected(false);
    try {
      const res = await fetch("/api/game/spy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spellId: intelSpell.id,
          targetTileId: targetTileId.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setReport(body.intelReport ?? null);
      setDetected(Boolean(body.detected));
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="spy-action"
      className="rounded-lg border-2 border-violet-300 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 p-4 scroll-mt-24"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">Spy: {intelSpell.name}</h2>
        <span className="text-xs text-neutral-500">
          {intelSpell.turnCost} turns
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 leading-relaxed">
        {intelSpell.description}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Target tile:{" "}
          <input
            type="text"
            value={targetTileId}
            onChange={(e) => setTargetTileId(e.target.value)}
            placeholder="e.g. 12_-3"
            disabled={busy}
            className="w-32 px-2 py-1 ml-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
          />
        </label>
        <button
          onClick={run}
          disabled={
            busy || !targetTileId.trim() || !tilesGateMet || !canAfford
          }
          className="px-5 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {busy ? "Casting…" : "Cast spy"}
        </button>
        {!tilesGateMet && (
          <span className="text-xs text-neutral-500">
            Needs {intelSpell.minTilesRequired} tiles held (you have {tilesHeld})
          </span>
        )}
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {report && (
        <div className="mt-3 text-xs space-y-2 text-neutral-700 dark:text-neutral-300 bg-violet-100/40 dark:bg-violet-950/30 rounded p-3">
          <p>
            <strong>Target {report.targetTileId}</strong> ({report.target.landType}
            ) — units G{report.target.units.ground} / S{report.target.units.siege}
            {" "}/ A{report.target.units.air}
            {report.target.armedDefenseSpellId
              ? ` · armed: ${report.target.armedDefenseSpellId}`
              : ""}
          </p>
          {report.weakFace && (
            <p>Forge Sight: lead with <strong>{report.weakFace}</strong>.</p>
          )}
          {report.neighbors && (
            <p>
              {report.neighbors.length} neighbor tile
              {report.neighbors.length === 1 ? "" : "s"} revealed.
            </p>
          )}
          {report.kingdomDefender && (
            <p>
              Kingdom: {report.kingdomDefender.tilesHeld} tiles ·{" "}
              {report.kingdomDefender.unitsAlive} units alive ·{" "}
              {report.kingdomDefender.artifactCount} unused artifacts
              {report.kingdomDefender.activeProductionSpellIds.length > 0
                ? ` · ${report.kingdomDefender.activeProductionSpellIds.length} production spell(s) active`
                : ""}
              .
            </p>
          )}
          {report.supply && (
            <p>
              Supply ×{report.supply.supplyMultiplier.toFixed(2)} — backed by{" "}
              {report.supply.friendlyNeighbors.length} friendly tile
              {report.supply.friendlyNeighbors.length === 1 ? "" : "s"}.
            </p>
          )}
          {detected && (
            <p className="text-amber-700 dark:text-amber-300">
              The defender felt the spy. Expect retaliation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
