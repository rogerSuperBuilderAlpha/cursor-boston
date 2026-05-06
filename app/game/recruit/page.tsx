/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getCasteProfile } from "@/lib/game/content";
import {
  effectiveUnitCap,
  PRODUCTION_SPELL_DURATION_TURNS,
} from "@/lib/game/turns";
import type {
  GamePlayer,
  GameTile,
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
  tiles: GameTile[];
  error?: PlayerResponseError | string;
}

const UNITS_PER_CYCLE = 10;
const TURNS_PER_CYCLE = 5;

export default function RecruitPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<GameTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitType, setUnitType] = useState<UnitType>("ground");
  const [requestedUnits, setRequestedUnits] = useState(50);
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
      const res = await fetch("/api/game/player", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as PlayerResponse;
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to load";
        throw new Error(msg);
      }
      setPlayer(data.player);
      setTiles(data.tiles ?? []);
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

  const militaryTiles = tiles.filter((t) => t.type === "military");
  const foodTiles = tiles.filter((t) => t.type === "food");
  const magicTiles = tiles.filter((t) => t.type === "magic");

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

  const handleRecruit = useCallback(async () => {
    if (!user || !player) return;
    if (militaryTiles.length === 0) {
      setError("You have no military tiles to recruit from.");
      return;
    }
    const units = Math.max(
      UNITS_PER_CYCLE,
      Math.min(maxUnits, Math.floor(requestedUnits / UNITS_PER_CYCLE) * UNITS_PER_CYCLE)
    );
    const totalCycles = Math.floor(units / UNITS_PER_CYCLE);
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
    let unitsBuilt = 0;
    let artifactsFound = 0;
    try {
      const token = await user.getIdToken();
      // Round-robin across military tiles so units distribute evenly.
      for (let i = 0; i < totalCycles; i++) {
        const tileId = militaryTiles[i % militaryTiles.length].tileId;
        const res = await fetch("/api/game/build", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tileId, unitType }),
        });
        const data = await res.json();
        if (!data.success) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Recruit failed";
          setError(`Stopped at ${i} / ${totalCycles}: ${msg}`);
          break;
        }
        unitsBuilt += UNITS_PER_CYCLE;
        if (data.report) {
          const report = data.report as TurnReport;
          if (report.artifactFound) artifactsFound++;
          setRecentReports((prev) => [report, ...prev].slice(0, 25));
        }
        setProgress({
          done: i + 1,
          total: totalCycles,
          unitsBuilt,
          artifactsFound,
        });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recruit failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [user, player, militaryTiles, maxUnits, requestedUnits, unitType, refresh]);

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
              <button
                onClick={handleRecruit}
                disabled={busy || maxCycles === 0}
                className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {busy
                  ? progress
                    ? `Training ${progress.done} / ${progress.total} cycles…`
                    : "Training…"
                  : `Recruit ${Math.min(
                      maxUnits,
                      Math.max(
                        UNITS_PER_CYCLE,
                        Math.floor(requestedUnits / UNITS_PER_CYCLE) *
                          UNITS_PER_CYCLE
                      )
                    )} ${unitType}`}
              </button>
              <span className="text-xs text-neutral-500">
                ({TURNS_PER_CYCLE} turns / {UNITS_PER_CYCLE} units · across{" "}
                {militaryTiles.length} tile
                {militaryTiles.length === 1 ? "" : "s"})
              </span>
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
