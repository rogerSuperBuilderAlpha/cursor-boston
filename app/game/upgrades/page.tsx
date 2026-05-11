/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ALL_BUILDINGS,
  ALL_UNITS,
  ALL_UPGRADES,
} from "@/lib/game/content";
import { CatalogImage } from "@/app/game/_components/CatalogImage";
import { CatalogLore } from "@/app/game/_components/CatalogLore";
import type {
  BuildingDefinition,
  Caste,
  GamePlayer,
  UnitDefinition,
  UpgradeDefinition,
} from "@/lib/game/types";

const UPGRADE_TURN_COST = 1;

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  error?: { message?: string } | string;
}

export default function UpgradesPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    refresh();
  }, [authLoading, refresh]);

  const callApi = useCallback(
    async (path: string, body: unknown) => {
      if (!user) return null;
      setError(null);
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
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Action failed";
          throw new Error(msg);
        }
        await refresh();
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        return null;
      }
    },
    [user, refresh]
  );

  const onApply = useCallback(
    async (targetId: string, upgradeId: string) => {
      setBusyId(targetId);
      try {
        await callApi("/api/game/upgrades/apply", { targetId, upgradeId });
      } finally {
        setBusyId(null);
      }
    },
    [callApi]
  );

  const onRemove = useCallback(
    async (targetId: string) => {
      setBusyId(targetId);
      try {
        await callApi("/api/game/upgrades/remove", { targetId });
      } finally {
        setBusyId(null);
      }
    },
    [callApi]
  );

  const caste: Caste | null = player?.caste ?? null;

  const units: UnitDefinition[] = useMemo(
    () => (caste ? ALL_UNITS.filter((u) => u.caste === caste) : []),
    [caste]
  );
  const buildings: BuildingDefinition[] = useMemo(
    () =>
      caste
        ? ALL_BUILDINGS.filter((b) => b.caste === caste)
        : [],
    [caste]
  );
  const upgradesByTarget: Record<string, UpgradeDefinition[]> = useMemo(() => {
    const out: Record<string, UpgradeDefinition[]> = {};
    if (!caste) return out;
    for (const u of ALL_UPGRADES) {
      if (u.caste !== caste) continue;
      if (!out[u.targetId]) out[u.targetId] = [];
      out[u.targetId].push(u);
    }
    return out;
  }, [caste]);

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
        <Link
          href="/login"
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Link
          href="/game"
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg"
        >
          Enlist first
        </Link>
      </div>
    );
  }

  if (!caste) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center max-w-md">
        <div>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Pick a caste before browsing upgrades — each caste has its own set.
          </p>
          <Link
            href="/game/setup"
            className="px-6 py-3 bg-emerald-500 text-white rounded-lg"
          >
            Continue setup →
          </Link>
        </div>
      </div>
    );
  }

  const active = player.activeUpgrades ?? {};
  const canSpend = player.turnsRemaining >= UPGRADE_TURN_COST;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold capitalize">{caste} upgrades</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6 text-sm leading-relaxed">
          <p className="mb-1">
            Each unit and each per-caste building has three upgrade options.
            Only one can be active per target.
          </p>
          <p>
            Applying or removing an upgrade costs{" "}
            <strong>{UPGRADE_TURN_COST} turn</strong>. Switching A → B is
            <strong> 2 turns</strong> total (remove, then apply), the same
            shape as land re-assignment.
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="text-sm text-neutral-500 mb-6">
          Turns remaining: <strong>{player.turnsRemaining}</strong>
        </div>

        <h2 className="text-lg font-semibold mb-3">Units</h2>
        <div className="space-y-4 mb-10">
          {units.map((u) => (
            <UpgradeRow
              key={u.id}
              targetId={u.id}
              targetLabel={`${u.name} (${u.type})`}
              targetSubLabel={`base ${u.attack}/${u.defense}/${u.hp}`}
              options={upgradesByTarget[u.id] ?? []}
              activeUpgradeId={active[u.id] ?? null}
              busy={busyId === u.id}
              canSpend={canSpend}
              onApply={onApply}
              onRemove={onRemove}
            />
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-3">Buildings</h2>
        <div className="space-y-4 mb-10">
          {buildings.map((b) => (
            <UpgradeRow
              key={b.id}
              targetId={b.id}
              targetLabel={b.name}
              targetSubLabel={`${b.landType} building`}
              options={upgradesByTarget[b.id] ?? []}
              activeUpgradeId={active[b.id] ?? null}
              busy={busyId === b.id}
              canSpend={canSpend}
              onApply={onApply}
              onRemove={onRemove}
            />
          ))}
        </div>

        <div className="mt-10">
          <Link
            href="/game"
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function UpgradeRow({
  targetId,
  targetLabel,
  targetSubLabel,
  options,
  activeUpgradeId,
  busy,
  canSpend,
  onApply,
  onRemove,
}: {
  targetId: string;
  targetLabel: string;
  targetSubLabel: string;
  options: UpgradeDefinition[];
  activeUpgradeId: string | null;
  busy: boolean;
  canSpend: boolean;
  onApply: (targetId: string, upgradeId: string) => void;
  onRemove: (targetId: string) => void;
}) {
  const sorted = [...options].sort((a, b) => a.optionIndex - b.optionIndex);
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-semibold">{targetLabel}</h3>
          <p className="text-xs text-neutral-500 mt-0.5">{targetSubLabel}</p>
        </div>
        {activeUpgradeId && (
          <button
            onClick={() => onRemove(targetId)}
            disabled={busy || !canSpend}
            className="text-xs px-3 py-1 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            Remove (1 turn)
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sorted.map((opt) => {
          const isActive = activeUpgradeId === opt.id;
          const otherActive = activeUpgradeId !== null && !isActive;
          const effects = formatEffects(opt);
          return (
            <div
              key={opt.id}
              className={`border rounded-lg p-3 text-sm ${
                isActive
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                <CatalogImage entry={opt} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-medium">{opt.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                      Option {opt.optionIndex}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {opt.description}
                  </p>
                </div>
              </div>
              <CatalogLore entry={opt} className="text-xs mb-2" />
              {effects && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-2 font-mono">
                  {effects}
                </p>
              )}
              {isActive ? (
                <span className="inline-block text-xs text-emerald-700 dark:text-emerald-400">
                  ✓ Active
                </span>
              ) : (
                <button
                  onClick={() => onApply(targetId, opt.id)}
                  disabled={busy || otherActive || !canSpend}
                  className="w-full px-3 py-1.5 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={
                    otherActive
                      ? "Remove the active upgrade first."
                      : !canSpend
                        ? "Not enough turns."
                        : ""
                  }
                >
                  Apply (1 turn)
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatEffects(u: UpgradeDefinition): string {
  const parts: string[] = [];
  if (u.effects.attackDelta) parts.push(fmt(u.effects.attackDelta, "atk"));
  if (u.effects.defenseDelta) parts.push(fmt(u.effects.defenseDelta, "def"));
  if (u.effects.hpDelta) parts.push(fmt(u.effects.hpDelta, "hp"));
  if (u.effects.capacityBonusDelta)
    parts.push(fmt(u.effects.capacityBonusDelta, "cap"));
  if (u.effects.magicMultiplierDelta) {
    parts.push(`+${(u.effects.magicMultiplierDelta * 100).toFixed(1)}% magic`);
  }
  return parts.join("  ·  ");
}

function fmt(n: number, label: string): string {
  return `${n > 0 ? "+" : ""}${n} ${label}`;
}
