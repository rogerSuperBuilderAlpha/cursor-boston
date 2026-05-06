/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type {
  ArtifactRarity,
  ArtifactType,
  GameArtifact,
} from "@/lib/game/types";

interface InventoryArtifact extends GameArtifact {
  definition: {
    id: string;
    name: string;
    description: string;
    flavorOnFind: string;
    baseStrength: number;
  } | null;
}

interface InventoryResponse {
  success: boolean;
  artifacts: InventoryArtifact[];
  error?: { message?: string } | string;
}

const RARITY_COLORS: Record<ArtifactRarity, string> = {
  common: "border-neutral-300 dark:border-neutral-700",
  rare: "border-blue-400 dark:border-blue-700",
  epic: "border-purple-400 dark:border-purple-700",
  legendary: "border-amber-400 dark:border-amber-700",
};

const RARITY_TEXT: Record<ArtifactRarity, string> = {
  common: "text-neutral-600 dark:text-neutral-400",
  rare: "text-blue-600 dark:text-blue-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-amber-600 dark:text-amber-400",
};

const RARITY_ORDER: ArtifactRarity[] = [
  "legendary",
  "epic",
  "rare",
  "common",
];

export default function ArtifactsInventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [artifacts, setArtifacts] = useState<InventoryArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ArtifactType>("all");
  const [usingId, setUsingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/artifacts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as InventoryResponse;
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to load artifacts";
        throw new Error(msg);
      }
      setArtifacts(data.artifacts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load artifacts");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    refresh();
  }, [authLoading, refresh]);

  const spendArtifact = useCallback(
    async (artifactId: string, name: string) => {
      if (!user) return;
      setUsingId(artifactId);
      setError(null);
      setFlash(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/game/artifact/use", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ artifactId }),
        });
        const data = await res.json();
        if (!data.success) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? "Use failed";
          throw new Error(msg);
        }
        setFlash(`${name} expended.`);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Use failed");
      } finally {
        setUsingId(null);
      }
    },
    [user, refresh]
  );

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

  const filtered =
    filter === "all"
      ? artifacts
      : artifacts.filter((a) => a.type === filter);

  // Group + sort by rarity for display.
  const grouped: Record<ArtifactRarity, InventoryArtifact[]> = {
    legendary: [],
    epic: [],
    rare: [],
    common: [],
  };
  for (const a of filtered) {
    grouped[a.rarity].push(a);
  }

  const counts = {
    all: artifacts.length,
    offense: artifacts.filter((a) => a.type === "offense").length,
    defense: artifacts.filter((a) => a.type === "defense").length,
    production: artifacts.filter((a) => a.type === "production").length,
    utility: artifacts.filter((a) => a.type === "utility").length,
  };

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Artifact inventory</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-6 text-sm leading-relaxed">
          <p>
            Artifacts are <strong>single-use, caste-agnostic, more powerful than
            spells</strong>. They drop on a small chance (~3%) every time you spend
            a turn — explore, build, attack, anything. Common items are useful;
            legendaries are rare gifts of the world. Use them wisely; once spent,
            they&apos;re gone.
          </p>
          <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            Use an artifact to expend it from your inventory. Effect bonuses
            (offense / defense / production multipliers) wire into combat and
            spell math in the next slice — for now, &quot;Use&quot; just retires
            the artifact so you can see the inventory drain coherently.
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {flash && (
          <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-400">
            {flash}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {(["all", "offense", "defense", "production", "utility"] as const).map(
            (t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize border ${
                  filter === t
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                {t} ({counts[t]})
              </button>
            )
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg">
            <p className="text-neutral-500 mb-1">
              {artifacts.length === 0
                ? "No artifacts found yet."
                : "No artifacts match this filter."}
            </p>
            {artifacts.length === 0 && (
              <p className="text-xs text-neutral-400">
                Spend turns exploring — eventually the world will leave one in
                your path.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {RARITY_ORDER.map((rarity) =>
              grouped[rarity].length === 0 ? null : (
                <section key={rarity}>
                  <h2
                    className={`text-sm font-semibold uppercase tracking-wide mb-3 ${RARITY_TEXT[rarity]}`}
                  >
                    {rarity} ({grouped[rarity].length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {grouped[rarity].map((a) => (
                      <div
                        key={a.id}
                        className={`border-2 rounded-lg p-4 bg-white dark:bg-neutral-900/30 ${
                          RARITY_COLORS[a.rarity]
                        } ${a.used ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-baseline justify-between mb-1">
                          <h3 className="font-semibold">
                            {a.definition?.name ?? a.definitionId}
                          </h3>
                          <span className="text-xs text-neutral-500 capitalize ml-2">
                            {a.type}
                          </span>
                        </div>
                        {a.definition && (
                          <>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                              {a.definition.description}
                            </p>
                            <p className="text-xs italic text-neutral-500 mb-2">
                              {a.definition.flavorOnFind}
                            </p>
                            <div className="text-xs text-neutral-500 mb-3">
                              Strength <strong>{a.definition.baseStrength}</strong>
                              {" · "}
                              Found turn {a.foundAtTurn}
                              {a.used && " · USED"}
                            </div>
                            {!a.used && (
                              <button
                                onClick={() =>
                                  spendArtifact(
                                    a.id,
                                    a.definition?.name ?? a.definitionId
                                  )
                                }
                                disabled={usingId !== null}
                                className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-400 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                              >
                                {usingId === a.id ? "Using…" : "Use artifact"}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
