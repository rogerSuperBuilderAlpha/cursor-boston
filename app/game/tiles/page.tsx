/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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

// Pixel size of a single hex (radius from center to corner).
const HEX_SIZE = 28;
const SQRT3 = Math.sqrt(3);
// Outer-edge padding around the bounding box, in pixels.
const VIEWPORT_PADDING = HEX_SIZE * 1.5;

// Pointy-top axial → pixel.
function axialToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * SQRT3 * (q + r / 2),
    y: HEX_SIZE * (3 / 2) * r,
  };
}

// Six vertices of a pointy-top hex centered at (cx, cy), as "x,y x,y …".
function hexPoints(cx: number, cy: number): string {
  const dx = (HEX_SIZE * SQRT3) / 2;
  const dy = HEX_SIZE / 2;
  return [
    [cx, cy - HEX_SIZE],
    [cx + dx, cy - dy],
    [cx + dx, cy + dy],
    [cx, cy + HEX_SIZE],
    [cx - dx, cy + dy],
    [cx - dx, cy - dy],
  ]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

// Tailwind-resolved colors for each land type. Keep the saturation low enough
// that the field-report blue badge inside a tile still reads.
const TYPE_FILL: Record<LandType, string> = {
  unrevealed: "#262626",
  unassigned: "#525252",
  military: "#dc2626",
  food: "#16a34a",
  magic: "#2563eb",
};

const TYPE_STROKE: Record<LandType, string> = {
  unrevealed: "#404040",
  unassigned: "#737373",
  military: "#fca5a5",
  food: "#86efac",
  magic: "#93c5fd",
};

const TYPE_TEXT: Record<LandType, string> = {
  unrevealed: "#a3a3a3",
  unassigned: "#fafafa",
  military: "#fff",
  food: "#fff",
  magic: "#fff",
};

export default function TilesMapPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tiles, setTiles] = useState<GameTile[]>([]);
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LandType | "all">("all");
  const [hovered, setHovered] = useState<GameTile | null>(null);

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

  // Compute the SVG viewBox once per tile-set change. Memoize so re-renders
  // (filter, hover) don't re-run the math.
  const viewBox = useMemo(() => {
    if (tiles.length === 0) return null;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const t of tiles) {
      const { x, y } = axialToPixel(t.q, t.r);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const x = minX - VIEWPORT_PADDING;
    const y = minY - VIEWPORT_PADDING;
    const width = maxX - minX + 2 * VIEWPORT_PADDING;
    const height = maxY - minY + 2 * VIEWPORT_PADDING;
    return { x, y, width, height };
  }, [tiles]);

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

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">Your territory</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed">
          <p>
            Your lands rendered in hex space. Hover for details, click to
            manage. The filter chips below dim non-matching tiles so you can
            see your territory composition at a glance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
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

        {tiles.length === 0 ? (
          <p className="text-center text-neutral-500 py-12">
            You don&apos;t own any tiles yet.
          </p>
        ) : (
          <div className="relative">
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-50 dark:bg-neutral-950">
              {viewBox && (
                <svg
                  viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                  className="w-full h-auto"
                  style={{
                    maxHeight: "70vh",
                    minHeight: "400px",
                  }}
                >
                  {tiles.map((t) => {
                    const { x, y } = axialToPixel(t.q, t.r);
                    const matched =
                      filter === "all" || t.type === filter;
                    const fill = TYPE_FILL[t.type];
                    const stroke = TYPE_STROKE[t.type];
                    const text = TYPE_TEXT[t.type];
                    const armed = !!t.armedDefenseSpellId;
                    const totalUnits =
                      t.units.ground + t.units.siege + t.units.air;
                    return (
                      <g
                        key={t.tileId}
                        opacity={matched ? 1 : 0.18}
                        onMouseEnter={() => setHovered(t)}
                        onMouseLeave={() =>
                          setHovered((cur) =>
                            cur?.tileId === t.tileId ? null : cur
                          )
                        }
                        onClick={() =>
                          router.push(
                            `/game/tiles/${encodeURIComponent(t.tileId)}`
                          )
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <polygon
                          points={hexPoints(x, y)}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={1.5}
                        />
                        {/* Tile id, small */}
                        <text
                          x={x}
                          y={y - 6}
                          textAnchor="middle"
                          fontSize={9}
                          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                          fill={text}
                          opacity={0.85}
                          style={{ pointerEvents: "none" }}
                        >
                          {t.tileId}
                        </text>
                        {/* Unit count if any */}
                        {totalUnits > 0 && (
                          <text
                            x={x}
                            y={y + 8}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={600}
                            fill={text}
                            style={{ pointerEvents: "none" }}
                          >
                            {totalUnits}
                          </text>
                        )}
                        {/* Defense armed marker */}
                        {armed && (
                          <circle
                            cx={x + HEX_SIZE * 0.55}
                            cy={y - HEX_SIZE * 0.55}
                            r={4}
                            fill="#60a5fa"
                            stroke="#fff"
                            strokeWidth={1}
                            style={{ pointerEvents: "none" }}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            {/* Hover info card, anchored bottom-right */}
            {hovered && (
              <div className="absolute bottom-3 right-3 max-w-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-xs shadow-lg pointer-events-none">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-mono font-semibold">
                    {hovered.tileId}
                  </span>
                  <span className="capitalize text-neutral-500">
                    {hovered.type}
                  </span>
                </div>
                <div className="text-neutral-600 dark:text-neutral-400">
                  G {hovered.units.ground} · S {hovered.units.siege} · A{" "}
                  {hovered.units.air}
                </div>
                {hovered.armedDefenseSpellId && (
                  <div className="text-blue-600 dark:text-blue-400 mt-1">
                    Armed: {hovered.armedDefenseSpellId}
                  </div>
                )}
                <div className="text-neutral-500 mt-1 italic">
                  click to manage →
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-neutral-500">
          <Legend type="military" />
          <Legend type="food" />
          <Legend type="magic" />
          <Legend type="unassigned" />
          <Legend type="unrevealed" />
          <span className="inline-flex items-center gap-1.5 ml-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: "#60a5fa" }}
            />
            defense armed
          </span>
        </div>
      </div>
    </div>
  );
}

function Legend({ type }: { type: LandType }) {
  return (
    <span className="inline-flex items-center gap-1.5 capitalize">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={{
          background: TYPE_FILL[type],
          border: `1px solid ${TYPE_STROKE[type]}`,
        }}
      />
      {type}
    </span>
  );
}
