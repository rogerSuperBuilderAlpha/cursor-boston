/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { SummonableUnitsCard } from "@/app/game/_components/dashboard/SummonableUnitsCard";
import {
  EMERGE_CHANCE_FARM,
  EMERGE_CHANCE_MAGIC,
  EMERGE_CHANCE_MILITARY,
  STAMINA_CONVERSION_THRESHOLD,
} from "@/lib/game/content/heroes";
import type {
  GamePlayer,
  HeroListScope,
  SafeHeroSummary,
} from "@/lib/game/types";

type TabKey = HeroListScope;

interface HeroesListResponse {
  success: boolean;
  heroes?: SafeHeroSummary[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: { message?: string } | string;
}

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  error?: { message?: string } | string;
}

interface TabState {
  heroes: SafeHeroSummary[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

const EMPTY_TAB_STATE: TabState = {
  heroes: [],
  nextCursor: null,
  hasMore: false,
  loading: false,
  error: null,
};

const TAB_LABELS: Record<TabKey, string> = {
  mine: "My Heroes",
  all: "All Heroes",
  fallen: "Hall of the Fallen",
};

/**
 * /game/heroes — v2 lore + roster browser.
 *
 * Three tabs back the same API with different scope params:
 *   - mine: the viewer's currently-owned heroes
 *   - all: every living hero (location hidden unless adjacent)
 *   - fallen: deceased + past-season heroes, fully public
 *
 * Hero cards link to the detail page at /game/heroes/[heroId] which
 * carries the full history + backstory chapter system.
 */
export default function HeroesPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("mine");
  const [tabs, setTabs] = useState<Record<TabKey, TabState>>({
    mine: { ...EMPTY_TAB_STATE },
    all: { ...EMPTY_TAB_STATE },
    fallen: { ...EMPTY_TAB_STATE },
  });
  const [player, setPlayer] = useState<GamePlayer | null>(null);

  const loadTab = useCallback(
    async (scope: TabKey, cursor: string | null) => {
      if (!user) return;
      setTabs((prev) => ({
        ...prev,
        [scope]: { ...prev[scope], loading: true, error: null },
      }));
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({ scope });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/game/heroes?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as HeroesListResponse;
        if (!data.success) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Failed to load";
          throw new Error(msg);
        }
        setTabs((prev) => ({
          ...prev,
          [scope]: {
            heroes: cursor
              ? [...prev[scope].heroes, ...(data.heroes ?? [])]
              : data.heroes ?? [],
            nextCursor: data.nextCursor ?? null,
            hasMore: Boolean(data.hasMore),
            loading: false,
            error: null,
          },
        }));
      } catch (err) {
        setTabs((prev) => ({
          ...prev,
          [scope]: {
            ...prev[scope],
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load",
          },
        }));
      }
    },
    [user]
  );

  const loadPlayer = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/player", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as PlayerResponse;
      if (data.success) setPlayer(data.player);
    } catch {
      // Non-fatal — the SummonableUnitsCard just won't render without player.
    }
  }, [user]);

  // Initial load: fetch the active tab and the player doc (for summonables).
  useEffect(() => {
    if (authLoading || !user) return;
    loadTab(activeTab, null);
    loadPlayer();
    // We deliberately depend on authLoading/user only — tab switches are
    // handled by the switch handler below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const switchTab = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab);
      if (tabs[tab].heroes.length === 0 && !tabs[tab].loading) {
        loadTab(tab, null);
      }
    },
    [tabs, loadTab]
  );

  if (authLoading) {
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

  const tabState = tabs[activeTab];

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Heroes</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <HeroMechanicsBlurb />

        <div
          role="tablist"
          aria-label="Heroes views"
          className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6"
        >
          {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                onClick={() => switchTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] transition-colors ${
                  isActive
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>

        {tabState.error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">
            {tabState.error}
          </p>
        )}

        {tabState.loading && tabState.heroes.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
          </div>
        ) : tabState.heroes.length === 0 ? (
          <EmptyTabState tab={activeTab} />
        ) : (
          <>
            <ul className="space-y-3">
              {tabState.heroes.map((h) => (
                <HeroRow key={h.id} hero={h} viewerId={user.uid} />
              ))}
            </ul>
            {tabState.hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => loadTab(activeTab, tabState.nextCursor)}
                  disabled={tabState.loading}
                  className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50"
                >
                  {tabState.loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "mine" && player && (
          <div className="mt-8">
            <SummonableUnitsCard player={player} onRefresh={loadPlayer} />
          </div>
        )}
      </div>
    </div>
  );
}

function HeroMechanicsBlurb() {
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6 text-sm leading-relaxed">
      <p className="mb-2">
        Heroes are tile-bound lore characters. Each one emerges by chance
        from a class-specific action and shapes the math of that subsystem
        for as long as it stands on its tile.
      </p>
      <ul className="list-disc list-inside space-y-1 text-xs text-neutral-700 dark:text-neutral-300">
        <li>
          <strong>⚔ Military</strong> (~{(EMERGE_CHANCE_MILITARY * 100).toFixed(0)}%
          per won battle) — boosts attack from / defense on their tile;
          moves to the captured tile on a win.
        </li>
        <li>
          <strong>⚘ Farm</strong> (~{(EMERGE_CHANCE_FARM * 100).toFixed(1)}%
          per recruit on a food tile) — boosts kingdom-wide recruitment;
          can summon caste-themed special units.
        </li>
        <li>
          <strong>✦ Magic</strong> (~{(EMERGE_CHANCE_MAGIC * 100).toFixed(1)}%
          per spell from a magic tile) — boosts spells from their tile;
          contributes virtual magic lands to your Armageddon roll.
        </li>
      </ul>
      <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
        Conversion attempts unlock at stamina ≤ {STAMINA_CONVERSION_THRESHOLD}.
        Locations of foreign heroes are hidden unless your kingdom borders
        their tile. Fallen heroes are fully public lore.
      </p>
    </div>
  );
}

function EmptyTabState({ tab }: { tab: TabKey }) {
  const copy: Record<TabKey, { title: string; sub: string }> = {
    mine: {
      title: "No heroes yet.",
      sub: "Win battles, recruit on food tiles, or cast spells from magic tiles — each action has a chance to surface a hero loyal to your banner.",
    },
    all: {
      title: "No living heroes on the field.",
      sub: "Heroes will appear here as players across the world summon them.",
    },
    fallen: {
      title: "The hall is empty.",
      sub: "Fallen heroes from past battles and previous seasons will appear here as their stories close.",
    },
  };
  const c = copy[tab];
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center">
      <p className="text-sm font-semibold mb-2">{c.title}</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{c.sub}</p>
    </div>
  );
}

function HeroRow({
  hero,
  viewerId,
}: {
  hero: SafeHeroSummary;
  viewerId: string;
}) {
  const isMine = hero.currentOwnerId === viewerId;
  const isFallen = hero.isDeceased || hero.awaitingResurrection;
  const glyph =
    hero.class === "military" ? "⚔" : hero.class === "farm" ? "⚘" : "✦";
  const color =
    hero.class === "military"
      ? "text-red-600 dark:text-red-400"
      : hero.class === "farm"
        ? "text-amber-600 dark:text-amber-400"
        : "text-violet-600 dark:text-violet-400";

  const locationDisplay = (() => {
    if (hero.isDeceased && hero.deceasedTileId) {
      return (
        <span className="text-xs font-mono text-neutral-500">
          ✟ fell at {hero.deceasedTileId}
        </span>
      );
    }
    if (hero.awaitingResurrection) {
      return (
        <span className="text-xs text-neutral-500">
          ⌛ awaiting resurrection
        </span>
      );
    }
    if (hero.currentTileId) {
      return (
        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
          📍 {hero.currentTileId}
        </span>
      );
    }
    return <span className="text-xs text-neutral-500">📍 unknown</span>;
  })();

  const pct =
    hero.stamina != null && hero.staminaMax
      ? Math.max(0, Math.min(100, Math.round((hero.stamina / hero.staminaMax) * 100)))
      : null;

  return (
    <li className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors">
      <Link
        href={`/game/heroes/${encodeURIComponent(hero.id)}`}
        className="flex items-start gap-3"
      >
        <span className={`text-2xl ${color}`}>{glyph}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold">{hero.name}</span>
            <span className="text-xs text-neutral-500 capitalize">
              {hero.specialty.replace(/-/g, " ")} · {hero.caste}
            </span>
            {isMine && !isFallen && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                yours
              </span>
            )}
            {hero.isDeceased && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400">
                slain
              </span>
            )}
            {hero.awaitingResurrection && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                S{hero.emergedSeasonNumber}
              </span>
            )}
            {hero.hasBackstory && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                📜 chronicle
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3">
            {locationDisplay}
            {pct != null && hero.stamina != null && hero.staminaMax != null && (
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${pct < 30 ? "bg-red-500" : pct < 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono w-12 text-right text-neutral-500">
                  {hero.stamina}/{hero.staminaMax}
                </span>
              </div>
            )}
          </div>
        </div>
        <span className="text-xs text-neutral-400 self-center">→</span>
      </Link>
    </li>
  );
}
