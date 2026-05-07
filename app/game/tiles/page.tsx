/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Caste, GamePlayer, MapTile, LandType } from "@/lib/game/types";

interface PlayerResponse {
  success: boolean;
  player: GamePlayer | null;
  tiles: MapTile[];
  error?: string;
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

type ScopeFilter = "everyone" | "mine" | "foreign";

const HEX_SIZE = 28;
const SQRT3 = Math.sqrt(3);
const VIEWPORT_PADDING = HEX_SIZE * 1.5;

const MIN_SCALE = 0.3;
const MAX_SCALE = 6;
// SVG viewBox is fixed; pan/zoom is applied via inner <g> transform. These
// constants drive the "fit to content" math when the user clicks recenter.
const VIEWBOX_W = 1200;
const VIEWBOX_H = 800;
// Leave a small breathing room around the fit so the outermost tiles aren't
// clipped at the edge.
const FIT_MARGIN = 0.95;
const ZOOM_STEP = 1.15;

function axialToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * SQRT3 * (q + r / 2),
    y: HEX_SIZE * (3 / 2) * r,
  };
}

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

/**
 * Compute pan/zoom values that fit `tiles` inside the SVG viewBox with a
 * small margin. Returns `null` if `tiles` is empty.
 *
 * The viewBox is centered at (0, 0) with extent VIEWBOX_W × VIEWBOX_H. After
 * applying `scale * translate(tx, ty)` to the inner <g>, an axial-pixel
 * point `(x, y)` maps to SVG `(scale * (x + tx), scale * (y + ty))`. We
 * pick `tx, ty` to center the bbox at the origin and `scale` so the bbox
 * fits.
 */
function fitTilesToViewport(
  tiles: ReadonlyArray<MapTile>
): { scale: number; tx: number; ty: number } | null {
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
  const w = maxX - minX + 2 * VIEWPORT_PADDING;
  const h = maxY - minY + 2 * VIEWPORT_PADDING;
  const fit = Math.min(VIEWBOX_W / w, VIEWBOX_H / h) * FIT_MARGIN;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit));
  return {
    scale,
    tx: -(minX + maxX) / 2,
    ty: -(minY + maxY) / 2,
  };
}

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

// Foreign-tile fill — high luminance so it pops against own tiles' saturated
// type fills and against the dark map background. The caste-colored border
// at width 3.5 carries the faction info; an inner colored dot retains type
// info ("that white-bordered tile is a military land").
const FOREIGN_FILL = "#f8fafc";

// Caste-keyed border accent for foreign tiles. Picked to match the in-game
// palette (white = stone, blue = sky, black = bone, red = ember, green = moss).
const CASTE_BORDER: Record<Caste, string> = {
  white: "#e5e7eb",
  blue: "#60a5fa",
  black: "#a78bfa",
  red: "#f87171",
  green: "#4ade80",
};

export default function TilesMapPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tiles, setTiles] = useState<MapTile[]>([]);
  const [ownersById, setOwnersById] = useState<Map<string, OwnerSummary>>(
    new Map()
  );
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LandType | "all">("all");
  const [scope, setScope] = useState<ScopeFilter>("everyone");
  const [hovered, setHovered] = useState<MapTile | null>(null);

  // Pan/zoom state — applied as an SVG transform on the rendered group.
  // Initial values are recomputed from the world bounding box on first load.
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [didFit, setDidFit] = useState(false);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  );

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
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
      const playerData = (await playerRes.json()) as PlayerResponse;
      const worldData = (await worldRes.json()) as WorldResponse;
      if (playerData.success) setPlayer(playerData.player);
      if (worldData.success) {
        setTiles(worldData.tiles ?? []);
        const map = new Map<string, OwnerSummary>();
        for (const o of worldData.owners ?? []) map.set(o.userId, o);
        setOwnersById(map);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    refresh();
  }, [authLoading, refresh]);

  // First-time fit: center the viewport on the player's own tiles so they
  // know where they are, and zoom so the *entire* kingdom fits. Runs once
  // when player + tiles are first available, or when the user clicks the
  // recenter (⌖) button (which flips didFit back).
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot fit on data arrival */
  useEffect(() => {
    if (didFit || !player || tiles.length === 0) return;
    const own = tiles.filter((t) => t.ownerId === player.userId);
    const fit = own.length > 0 ? fitTilesToViewport(own) : fitTilesToViewport(tiles);
    if (fit) {
      setTx(fit.tx);
      setTy(fit.ty);
      setScale(fit.scale);
    }
    setDidFit(true);
  }, [didFit, player, tiles]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Wheel zoom around the cursor.
  //
  // Attached via `addEventListener({ passive: false })` in an effect below
  // — React's synthetic `onWheel` listener is passive by default, so
  // `e.preventDefault()` is silently dropped and the page scrolls behind
  // the map when the user tries to zoom. Stored in a ref so the effect's
  // attach/detach doesn't depend on the latest closure.
  const wheelStateRef = useRef({ scale, tx, ty });
  useEffect(() => {
    wheelStateRef.current = { scale, tx, ty };
  }, [scale, tx, ty]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const { scale: s, tx: ttx, ty: tty } = wheelStateRef.current;
      // macOS pinch-to-zoom on trackpads also fires wheel events with
      // ctrlKey=true; same handler covers both.
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor));
      if (next === s) return;
      const rect = svg.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const worldX = (cx - rect.width / 2) / s - ttx;
      const worldY = (cy - rect.height / 2) / s - tty;
      const newTx = (cx - rect.width / 2) / next - worldX;
      const newTy = (cy - rect.height / 2) / next - worldY;
      setScale(next);
      setTx(newTx);
      setTy(newTy);
    };
    svg.addEventListener("wheel", onWheelNative, { passive: false });
    return () => svg.removeEventListener("wheel", onWheelNative);
  }, []);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    [tx, ty]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (e.clientX - drag.x) / scale;
      const dy = (e.clientY - drag.y) / scale;
      setTx(drag.tx + dx);
      setTy(drag.ty + dy);
    },
    [scale]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      dragRef.current = null;
      setDragging(false);
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    []
  );

  const handleTileClick = useCallback(
    (t: MapTile) => {
      // Don't fire on the click that ended a drag — pointermove with no
      // movement still sets dragRef briefly, but click only fires when the
      // browser decides the pointer didn't move enough to be a drag.
      if (!player) return;
      if (t.ownerId === player.userId) {
        router.push(`/game/tiles/${encodeURIComponent(t.tileId)}`);
        return;
      }
      // Foreign tile — surface in hover card; no click-action wired yet.
    },
    [player, router]
  );

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

  const ownTiles = tiles.filter((t) => t.ownerId === player.userId);
  const visibleTiles = tiles.filter((t) => {
    if (scope === "mine" && t.ownerId !== player.userId) return false;
    if (scope === "foreign" && t.ownerId === player.userId) return false;
    return true;
  });

  const hoveredOwner = hovered && hovered.ownerId
    ? ownersById.get(hovered.ownerId) ?? null
    : null;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-3xl font-bold">World map</h1>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4 text-sm leading-relaxed">
          <p>
            Drag to pan, scroll to zoom. Your tiles render in full color with
            their land type; foreign tiles fade and pick up a caste-colored
            ring. Generals still under the new-player shield show a lock —
            they can&apos;t be attacked yet.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-xs uppercase tracking-wide text-neutral-500 self-center mr-1">
            Show
          </span>
          {(
            [
              { key: "everyone", label: `Everyone (${tiles.length})` },
              { key: "mine", label: `Mine (${ownTiles.length})` },
              {
                key: "foreign",
                label: `Foreign (${tiles.length - ownTiles.length})`,
              },
            ] as Array<{ key: ScopeFilter; label: string }>
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setScope(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                scope === opt.key
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
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
              {t} (
              {t === "all"
                ? visibleTiles.length
                : visibleTiles.filter((x) => x.type === t).length}
              )
            </button>
          ))}
        </div>

        {tiles.length === 0 ? (
          <p className="text-center text-neutral-500 py-12">
            The world is empty.
          </p>
        ) : (
          <div className="relative">
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-50 dark:bg-neutral-950">
              <svg
                ref={svgRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-auto block touch-none select-none"
                style={{
                  // viewBox stays anchored at -W/2..W/2 in SVG units; we apply
                  // pan/zoom via the inner <g> transform so coordinate math
                  // stays simple.
                  height: "70vh",
                  cursor: dragging ? "grabbing" : "grab",
                }}
                viewBox="-600 -400 1200 800"
                preserveAspectRatio="xMidYMid meet"
              >
                <g
                  transform={`scale(${scale}) translate(${tx} ${ty})`}
                >
                  {visibleTiles.map((t) => {
                    const { x, y } = axialToPixel(t.q, t.r);
                    const matched = filter === "all" || t.type === filter;
                    const isOwn = t.ownerId === player.userId;
                    const isForeign = !!t.ownerId && !isOwn;
                    const owner = t.ownerId
                      ? ownersById.get(t.ownerId) ?? null
                      : null;
                    // Foreign tiles use a near-white fill + thick caste-colored
                    // border so they read as "not yours" in one glance, even on
                    // a busy map. Type info is preserved via an inner colored
                    // dot rendered below the polygon.
                    const fill = isForeign ? FOREIGN_FILL : TYPE_FILL[t.type];
                    const stroke = isOwn
                      ? TYPE_STROKE[t.type]
                      : owner?.caste
                      ? CASTE_BORDER[owner.caste]
                      : "#737373";
                    const strokeWidth = isOwn ? 1.5 : isForeign ? 3.5 : 2.25;
                    const text = TYPE_TEXT[t.type];
                    const armed = !!t.armedDefenseSpellId;
                    const totalUnits =
                      t.units.ground + t.units.siege + t.units.air;
                    // Filter dimming still applies, but the muddy 0.6 wash on
                    // foreign tiles is gone — the bright fill carries the
                    // visual weight on its own.
                    const opacity = matched ? 1 : 0.12;
                    return (
                      <g
                        key={t.tileId}
                        opacity={opacity}
                        onMouseEnter={() => setHovered(t)}
                        onMouseLeave={() =>
                          setHovered((cur) =>
                            cur?.tileId === t.tileId ? null : cur
                          )
                        }
                        onClick={(e) => {
                          // Suppress click if a drag just ended this frame.
                          if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)
                            return;
                          handleTileClick(t);
                        }}
                        style={{
                          cursor: isOwn ? "pointer" : "default",
                        }}
                      >
                        <polygon
                          points={hexPoints(x, y)}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                        />
                        {/* Inner type-dot on foreign tiles preserves the
                            tactical info (military / food / magic) that the
                            white fill would otherwise hide. */}
                        {isForeign && (t.type === "military" || t.type === "food" || t.type === "magic") && (
                          <circle
                            cx={x}
                            cy={y}
                            r={5}
                            fill={TYPE_FILL[t.type]}
                            style={{ pointerEvents: "none" }}
                          />
                        )}
                        {isOwn && (
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
                        )}
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
                        {/* Shield indicator on foreign tiles */}
                        {!isOwn && owner?.shielded && (
                          <text
                            x={x - HEX_SIZE * 0.55}
                            y={y - HEX_SIZE * 0.4}
                            fontSize={11}
                            style={{ pointerEvents: "none" }}
                          >
                            🛡
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {/* Zoom controls */}
            <div className="absolute top-3 right-3 flex flex-col gap-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm">
              <button
                onClick={() =>
                  setScale((s) => Math.min(MAX_SCALE, s * ZOOM_STEP))
                }
                className="px-2.5 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-t-lg"
                title="Zoom in"
              >
                +
              </button>
              <button
                onClick={() =>
                  setScale((s) => Math.max(MIN_SCALE, s / ZOOM_STEP))
                }
                className="px-2.5 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-800"
                title="Zoom out"
              >
                −
              </button>
              <button
                onClick={() => {
                  setDidFit(false); // re-trigger the fit effect
                }}
                className="px-2.5 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-b-lg border-t border-neutral-200 dark:border-neutral-800"
                title="Recenter on your territory"
              >
                ⌖
              </button>
            </div>

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
                {hovered.ownerId && hovered.ownerId !== player.userId && (
                  <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="font-semibold">
                      {hoveredOwner?.displayName || "Unnamed general"}
                    </div>
                    <div className="text-neutral-500 capitalize">
                      {hoveredOwner?.caste ?? "no caste"}
                    </div>
                    {hoveredOwner?.shielded ? (
                      <div className="text-amber-600 dark:text-amber-400 mt-1">
                        🛡 Shielded — can&apos;t be attacked yet
                      </div>
                    ) : (
                      <div className="text-red-600 dark:text-red-400 mt-1">
                        Targetable
                      </div>
                    )}
                  </div>
                )}
                {hovered.ownerId === player.userId && (
                  <div className="text-neutral-500 mt-1 italic">
                    click to manage →
                  </div>
                )}
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
          <span className="inline-flex items-center gap-1.5 ml-2">
            🛡 shielded
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
