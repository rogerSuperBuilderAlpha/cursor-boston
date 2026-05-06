/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { GamePlayer, GameTile, LandType } from "@/lib/game/types";

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: GameTile[];
  error?: string;
}

const LAND_FILTERS: Array<LandType | "all"> = [
  "all",
  "military",
  "food",
  "magic",
  "unassigned",
  "unrevealed",
];

export default function TilesListPage() {
  const { user, loading: authLoading } = useAuth();
  const [tiles, setTiles] = useState<GameTile[]>([]);
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LandType | "all">("all");

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/player", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as PlayerResponse;
      if (data.success) {
        setPlayer(data.player);
        setTiles(data.tiles ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    refresh();
  }, [authLoading, refresh]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Link href="/game" className="px-6 py-3 bg-emerald-500 text-white rounded-lg">
          Go to dashboard
        </Link>
      </div>
    );
  }

  const filtered =
    filter === "all" ? tiles : tiles.filter((t) => t.type === filter);

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Your tiles</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed">
          <p>
            Every tile you own. Click any tile to manage it: build units (military
            tiles only), arm a defense spell, or scout neighbors. The filter
            chips below show how your tiles are distributed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {LAND_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize border ${
                filter === t
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {t} ({t === "all" ? tiles.length : tiles.filter((x) => x.type === t).length})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <Link
              key={t.tileId}
              href={`/game/tiles/${encodeURIComponent(t.tileId)}`}
              className="block border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm">{t.tileId}</span>
                <span className="text-xs uppercase tracking-wide text-neutral-500 capitalize">
                  {t.type}
                </span>
              </div>
              <div className="text-xs text-neutral-500">
                Units: G {t.units.ground} · S {t.units.siege} · A {t.units.air}
              </div>
              {t.armedDefenseSpellId && (
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Armed: {t.armedDefenseSpellId}
                </div>
              )}
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-neutral-500 py-12">
            No tiles match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
