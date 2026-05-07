/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getCasteProfile } from "@/lib/game/content";
import {
  effectiveUnitCap,
  PRODUCTION_SPELL_DURATION_TURNS,
} from "@/lib/game/turns";
import {
  computeTileThreat,
  rankTileIdsByThreat,
  type ThreatOwnerInfo,
} from "@/lib/game/threat";
import type {
  Caste,
  GamePlayer,
  MapTile,
  TurnReport,
  UnitType,
} from "@/lib/game/types";

interface PlayerResponseError {
  message?: string;
  code?: string;
}

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: MapTile[];
  error?: PlayerResponseError | string;
}

interface OwnerSummary {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
}

interface WorldResponse {
  success: boolean;
  tiles?: MapTile[];
  owners?: OwnerSummary[];
  error?: PlayerResponseError | string;
}

const UNITS_PER_CYCLE = 10;
const TURNS_PER_CYCLE = 5;

/**
 * Distribute `totalCycles` build-cycles across `tileIds` (in threat-ranked
 * order, top-threat first), favoring earlier entries. Linear weights:
 * rank 0 gets weight N, rank N-1 gets weight 1, total = N(N+1)/2. The top
 * tile receives roughly N times the bottom tile's share, with remainder
 * cycles falling to the most-threatened tiles first.
 *
 * Returns plan entries with `cycles > 0` only.
 */
function buildThreatPriorityPlan(
  threatRankedTileIds: ReadonlyArray<string>,
  totalCycles: number
): Array<{ tileId: string; cycles: number }> {
  const N = threatRankedTileIds.length;
  if (N === 0 || totalCycles <= 0) return [];
  const weights = threatRankedTileIds.map((_, i) => N - i);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const cycles = threatRankedTileIds.map((_, i) =>
    Math.floor((totalCycles * weights[i]) / totalWeight)
  );
  let assigned = cycles.reduce((a, b) => a + b, 0);
  // Top-down remainder allocation so the most-threatened tile picks up the
  // leftover when totalCycles doesn't divide evenly.
  let cursor = 0;
  while (assigned < totalCycles) {
    cycles[cursor % N]++;
    assigned++;
    cursor++;
  }
  return threatRankedTileIds
    .map((tileId, idx) => ({ tileId, cycles: cycles[idx] }))
    .filter((p) => p.cycles > 0);
}

export default function RecruitPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<MapTile[]>([]);
  const [worldTiles, setWorldTiles] = useState<MapTile[]>([]);
  const [owners, setOwners] = useState<Map<string, OwnerSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitType, setUnitType] = useState<UnitType>("ground");
  const [requestedUnits, setRequestedUnits] = useState(50);
  // "" → auto-route by threat across all military tiles. Otherwise the
  // user has explicitly picked one tile and 100% of the recruit goes there.
  const [selectedTileId, setSelectedTileId] = useState<string>("");
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    unitsBuilt: number;
    artifactsFound: number;
  } | null>(null);
  const [recentReports, setRecentReports] = useState<TurnReport[]>([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const token = await user.getIdToken();
      const [playerRes, worldRes] = await Promise.all([
        fetch("/api/game/player", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/game/world", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const data = (await playerRes.json()) as PlayerResponse;
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to load";
        throw new Error(msg);
      }
      setPlayer(data.player);
      setTiles(data.tiles ?? []);
      const worldData = (await worldRes.json()) as WorldResponse;
      if (worldData.success) {
        setWorldTiles(worldData.tiles ?? []);
        const map = new Map<string, OwnerSummary>();
        for (const o of worldData.owners ?? []) map.set(o.userId, o);
        setOwners(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    refresh();
  }, [authLoading, refresh]);

  const militaryTiles = useMemo(
    () => tiles.filter((t) => t.type === "military"),
    [tiles]
  );
  const foodTiles = tiles.filter((t) => t.type === "food");
  const magicTiles = tiles.filter((t) => t.type === "magic");

  // Threat-ranked military-tile ids. Drives the auto-route distribution and
  // the order tiles appear in the manual-override picker (most exposed at
  // top is what a player wants to see).
  const threatRankedMilitaryIds = useMemo(() => {
    if (!player) return [] as string[];
    const ownerInfo = new Map<string, ThreatOwnerInfo>();
    for (const [uid, o] of owners) ownerInfo.set(uid, { shielded: o.shielded });
    const threat = computeTileThreat({
      myTiles: militaryTiles,
      worldTiles,
      owners: ownerInfo,
      myUserId: player.userId,
    });
    return rankTileIdsByThreat(
      militaryTiles.map((t) => t.tileId),
      threat
    );
  }, [militaryTiles, worldTiles, owners, player]);

  // Compute the player's current effective unit cap. This mirrors what the
  // server uses inside buildUnitsServer so the displayed numbers match what
  // will actually go through.
  const cap = player
    ? effectiveUnitCap(player, foodTiles.length, magicTiles.length)
    : 0;
  const unitsAlive = player?.stats.unitsAlive ?? 0;
  const availableCap = Math.max(0, cap - unitsAlive);
  const turnsRemaining = player?.turnsRemaining ?? 0;
  // How many BUILD CYCLES the player can afford right now.
  const maxCyclesByCap = Math.floor(availableCap / UNITS_PER_CYCLE);
  const maxCyclesByTurns = Math.floor(turnsRemaining / TURNS_PER_CYCLE);
  const maxCycles = Math.min(maxCyclesByCap, maxCyclesByTurns);
  const maxUnits = maxCycles * UNITS_PER_CYCLE;

  // Final units rounded to a multiple of UNITS_PER_CYCLE and bounded by cap.
  const effectiveUnits = useMemo(
    () =>
      Math.max(
        UNITS_PER_CYCLE,
        Math.min(
          maxUnits,
          Math.floor(requestedUnits / UNITS_PER_CYCLE) * UNITS_PER_CYCLE
        )
      ),
    [maxUnits, requestedUnits]
  );
  const effectiveCycles = Math.max(0, Math.floor(effectiveUnits / UNITS_PER_CYCLE));

  // Distribution preview, used to render a transparent "this is where the
  // units are going" line above the recruit button. Auto-routes by threat
  // unless the user explicitly picked a tile.
  const planPreview = useMemo(() => {
    if (effectiveCycles === 0) return [];
    if (selectedTileId) {
      return [{ tileId: selectedTileId, cycles: effectiveCycles }];
    }
    return buildThreatPriorityPlan(threatRankedMilitaryIds, effectiveCycles);
  }, [effectiveCycles, selectedTileId, threatRankedMilitaryIds]);

  const handleRecruit = useCallback(async () => {
    if (!user || !player) return;
    if (militaryTiles.length === 0) {
      setError("You have no military tiles to recruit from.");
      return;
    }
    const totalCycles = effectiveCycles;
    if (totalCycles === 0) {
      setError("Not enough turns or capacity to recruit any units.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({
      done: 0,
      total: totalCycles,
      unitsBuilt: 0,
      artifactsFound: 0,
    });
    try {
      const token = await user.getIdToken();
      const planEntries = selectedTileId
        ? [{ tileId: selectedTileId, cycles: totalCycles }]
        : buildThreatPriorityPlan(threatRankedMilitaryIds, totalCycles);
      const plan = planEntries.map(({ tileId, cycles }) => ({
        tileId,
        unitType,
        cycles,
      }));
      const res = await fetch("/api/game/build/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Recruit failed";
        throw new Error(msg);
      }
      const reports: TurnReport[] = Array.isArray(data.reports)
        ? data.reports
        : [];
      let artifactsFound = 0;
      for (const r of reports) if (r.artifactFound) artifactsFound++;
      const unitsBuilt =
        typeof data.produced === "number"
          ? data.produced
          : reports.length * UNITS_PER_CYCLE;
      if (reports.length > 0) {
        setRecentReports((prev) =>
          [...reports.slice().reverse(), ...prev].slice(0, 25)
        );
      }
      setProgress({
        done: reports.length,
        total: totalCycles,
        unitsBuilt,
        artifactsFound,
      });
      if (data.stoppedEarly) {
        setError(
          `Stopped early after ${reports.length} / ${totalCycles}: ${data.stoppedEarly}`
        );
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recruit failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [
    user,
    player,
    militaryTiles,
    effectiveCycles,
    selectedTileId,
    threatRankedMilitaryIds,
    unitType,
    refresh,
  ]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Link href="/login" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
          Sign in
        </Link>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Link href="/game" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
          Enlist first
        </Link>
      </div>
    );
  }

  const casteProfile = player.caste ? getCasteProfile(player.caste) : null;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Recruit forces</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6 text-sm leading-relaxed">
          <p>
            Each recruit cycle trains <strong>{UNITS_PER_CYCLE} units</strong>{" "}
            of one type on a military tile, costing{" "}
            <strong>{TURNS_PER_CYCLE} turns</strong>. Bulk recruit fires cycles
            round-robin across all your military tiles so units distribute
            evenly. Each cycle rolls a 3% chance for an artifact.
          </p>
          <p className="mt-2">
            Your unit cap is set by your{" "}
            <strong>food lands</strong> (+5 cap each up to 50, then +2.5),
            multiplied by any active production spells. Your{" "}
            <strong>caste</strong> shifts which unit type you build best
            (
            {casteProfile
              ? Object.entries(casteProfile.unitTypeBonuses)
                  .map(([k, v]) => `${k} ×${v}`)
                  .join(", ")
              : "—"}
            ).
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Stat label="Military tiles" value={String(militaryTiles.length)} />
          <Stat label="Unit cap" value={String(cap)} />
          <Stat label="Units alive" value={String(unitsAlive)} />
          <Stat label="Available cap" value={String(availableCap)} />
          <Stat label="Turns remaining" value={String(turnsRemaining)} />
          <Stat
            label="Max units this session"
            value={String(maxUnits)}
            hint={`(${maxCycles} cycles)`}
          />
          <Stat label="Food lands" value={String(foodTiles.length)} />
          <Stat label="Magic lands" value={String(magicTiles.length)} />
        </div>

        {(player.productionSpellsActive ?? []).length > 0 && (
          <div className="mb-6 text-xs text-neutral-500">
            Active production spells contributing to your cap:{" "}
            {(player.productionSpellsActive ?? [])
              .map((p) => p.spellId)
              .join(", ")}{" "}
            (each lasts {PRODUCTION_SPELL_DURATION_TURNS} turns from cast).
          </div>
        )}

        <div className="rounded-lg border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 mb-6">
          <h2 className="font-semibold mb-3">Bulk recruit</h2>
          {militaryTiles.length === 0 ? (
            <p className="text-sm text-neutral-500">
              You have no military tiles. Distribute some unassigned tiles to{" "}
              <em>military</em> first — head to the dashboard&apos;s
              bulk-assign panel or any tile&apos;s detail page.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm">
                  Unit type:{" "}
                  <select
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value as UnitType)}
                    disabled={busy}
                    className="ml-2 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent capitalize"
                  >
                    <option value="ground">ground</option>
                    <option value="siege">siege</option>
                    <option value="air">air</option>
                  </select>
                </label>
                <label className="text-sm">
                  Units (multiple of {UNITS_PER_CYCLE}):{" "}
                  <input
                    type="number"
                    step={UNITS_PER_CYCLE}
                    min={UNITS_PER_CYCLE}
                    max={Math.max(UNITS_PER_CYCLE, maxUnits)}
                    value={requestedUnits}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n)) setRequestedUnits(n);
                    }}
                    disabled={busy}
                    className="w-24 px-2 py-1 ml-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
                  />
                </label>
                <label className="text-sm">
                  Distribute to:{" "}
                  <select
                    value={selectedTileId}
                    onChange={(e) => setSelectedTileId(e.target.value)}
                    disabled={busy || militaryTiles.length === 0}
                    className="ml-2 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent"
                  >
                    <option value="">
                      Auto — most-threatened tiles first
                    </option>
                    {threatRankedMilitaryIds.map((tileId, idx) => (
                      <option key={tileId} value={tileId}>
                        {tileId}
                        {idx === 0 ? " (top threat)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={handleRecruit}
                  disabled={busy || maxCycles === 0}
                  className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {busy
                    ? "Training units…"
                    : `Recruit ${effectiveUnits} ${unitType}`}
                </button>
              </div>
              <p className="text-xs text-neutral-500">
                {TURNS_PER_CYCLE} turns / {UNITS_PER_CYCLE} units · across{" "}
                {militaryTiles.length} military tile
                {militaryTiles.length === 1 ? "" : "s"}.
              </p>
              {planPreview.length > 0 && (
                <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-neutral-950 px-3 py-2 text-xs">
                  <div className="font-medium mb-1">
                    {selectedTileId ? "Routing to" : "Auto-routing units"}
                  </div>
                  <ul className="font-mono text-[11px] space-y-0.5 text-neutral-700 dark:text-neutral-300">
                    {planPreview.map(({ tileId, cycles }, idx) => (
                      <li key={tileId}>
                        {tileId} +{cycles * UNITS_PER_CYCLE}
                        {!selectedTileId && idx === 0 && planPreview.length > 1
                          ? "  (most-threatened)"
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {progress && (
            <div className="mt-4 space-y-1">
              <div className="h-2 w-full bg-emerald-100 dark:bg-emerald-950/40 rounded overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{
                    width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`,
                  }}
                />
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400 flex justify-between">
                <span>
                  {progress.done} / {progress.total} cycles ·{" "}
                  {progress.unitsBuilt} units trained
                </span>
                <span>
                  {progress.artifactsFound} artifact
                  {progress.artifactsFound === 1 ? "" : "s"} found
                </span>
              </div>
            </div>
          )}
        </div>

        <h2 className="text-lg font-semibold mb-3">Your military tiles</h2>
        {militaryTiles.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">
            None yet — distribute some unassigned tiles to military first.
          </p>
        ) : (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-200 dark:divide-neutral-800">
            {militaryTiles.map((t) => (
              <Link
                key={t.tileId}
                href={`/game/tiles/${encodeURIComponent(t.tileId)}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <span className="font-mono">{t.tileId}</span>
                <span className="text-xs text-neutral-500">
                  G {t.units.ground} · S {t.units.siege} · A {t.units.air}
                </span>
              </Link>
            ))}
          </div>
        )}

        {recentReports.length > 0 && <ReportLog reports={recentReports} />}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
        {label}
      </div>
      <div className="text-lg font-semibold">
        {value}
        {hint && (
          <span className="text-xs text-neutral-500 ml-2 font-normal">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

const RARITY_TEXT: Record<string, string> = {
  common: "text-neutral-500 dark:text-neutral-400",
  rare: "text-blue-600 dark:text-blue-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-amber-600 dark:text-amber-400",
};

function ReportLog({ reports }: { reports: TurnReport[] }) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
        Field reports
      </h3>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg max-h-96 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800">
        {reports.map((r, idx) => (
          <div
            key={`${r.action}-${r.turnIndex}-${idx}`}
            className="px-4 py-3 text-sm leading-relaxed"
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-medium">{r.summary}</span>
              <span className="text-xs text-neutral-500 capitalize ml-2 shrink-0">
                {r.action} · {r.cost}t
              </span>
            </div>
            {r.narrative.length > 0 && (
              <div className="text-neutral-600 dark:text-neutral-400 italic space-y-1">
                {r.narrative.map((line, lineIdx) => (
                  <p key={lineIdx}>{line}</p>
                ))}
              </div>
            )}
            {r.artifactFound && (
              <div
                className={`mt-2 text-xs font-semibold uppercase tracking-wide ${
                  RARITY_TEXT[r.artifactFound.rarity] ?? ""
                }`}
              >
                {r.artifactFound.rarity} artifact found —{" "}
                <span className="normal-case">{r.artifactFound.name}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
