/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { GamePlayer, LandType, MapTile } from "@/lib/game/types";
import { fitTilesToViewport } from "../_lib/hex-math";
import type { OwnerSummary, ViewMode } from "../_lib/types";
import type { PanZoom } from "../_lib/use-pan-zoom";
import { TileHexagon } from "./TileHexagon";
import { TileHoverCard } from "./TileHoverCard";
import { ZoomControls } from "./ZoomControls";

interface Props {
  player: GamePlayer;
  tiles: MapTile[];
  visibleTiles: MapTile[];
  ownersById: Map<string, OwnerSummary>;
  filter: LandType | "all";
  mode: ViewMode;
  panZoom: PanZoom;
  onTileClick: (t: MapTile) => void;
}

/**
 * The interactive SVG map: pannable/zoomable, with a hover card and
 * floating zoom controls. Owns:
 *   - the hover state (transient, no need to lift it),
 *   - the one-shot fit-to-content effect (re-fires when `mode` flips
 *     because the parent resets `panZoom.didFit`),
 *   - the per-tile click suppression for drags-that-ended-here.
 */
export function MapCanvas({
  player,
  tiles,
  visibleTiles,
  ownersById,
  filter,
  mode,
  panZoom,
  onTileClick,
}: Props) {
  const {
    scale,
    setScale,
    tx,
    setTx,
    ty,
    setTy,
    didFit,
    setDidFit,
    dragging,
    svgRef,
    handlePointerDown,
    lastDragMovedRef,
    zoomIn,
    zoomOut,
  } = panZoom;
  const [hovered, setHovered] = useState<MapTile | null>(null);

  // First-time fit: center the viewport on the player's own tiles so they
  // know where they are, and zoom so the *entire* kingdom fits. Runs once
  // when player + tiles are first available, or when the user clicks the
  // recenter (⌖) button (which flips didFit back). In world mode we fit
  // the whole world instead.
  useEffect(() => {
    if (didFit || tiles.length === 0) return;
    const fitTarget =
      mode === "world"
        ? tiles
        : tiles.filter((t) => t.ownerId === player.userId);
    const source = fitTarget.length > 0 ? fitTarget : tiles;
    const fit = fitTilesToViewport(source);
    if (fit) {
      setTx(fit.tx);
      setTy(fit.ty);
      setScale(fit.scale);
    }
    setDidFit(true);
  }, [
    didFit,
    player.userId,
    tiles,
    mode,
    setTx,
    setTy,
    setScale,
    setDidFit,
  ]);

  const handleHexClick = useCallback(
    (t: MapTile) => {
      // Suppress clicks that ended a drag. The threshold (5 px) tolerates
      // micro-movements during a real tap. lastDragMovedRef is reset before
      // each pointerdown.
      if (lastDragMovedRef.current > 5) {
        lastDragMovedRef.current = 0;
        return;
      }
      onTileClick(t);
    },
    [lastDragMovedRef, onTileClick]
  );

  const handleShowWorld = useCallback(() => {
    // Snap to a fit-zoom of the entire world. Useful when the recenter
    // ⌖ left you zoomed in on a small kingdom and the surrounding map
    // looks empty.
    const fit = fitTilesToViewport(tiles);
    if (fit) {
      setTx(fit.tx);
      setTy(fit.ty);
      setScale(fit.scale);
    }
  }, [tiles, setTx, setTy, setScale]);

  const hoveredOwner =
    hovered && hovered.ownerId ? ownersById.get(hovered.ownerId) ?? null : null;

  return (
    <div className="relative">
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-50 dark:bg-neutral-950">
        <svg
          ref={svgRef}
          onPointerDown={handlePointerDown}
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
          <g transform={`scale(${scale}) translate(${tx} ${ty})`}>
            {visibleTiles.map((t) => {
              const matched = filter === "all" || t.type === filter;
              const isOwn = t.ownerId === player.userId;
              const owner = t.ownerId
                ? ownersById.get(t.ownerId) ?? null
                : null;
              return (
                <TileHexagon
                  key={t.tileId}
                  tile={t}
                  isOwn={isOwn}
                  matched={matched}
                  owner={owner}
                  onHoverEnter={setHovered}
                  onHoverLeave={(tile) =>
                    setHovered((cur) =>
                      cur?.tileId === tile.tileId ? null : cur
                    )
                  }
                  onClick={handleHexClick}
                />
              );
            })}
          </g>
        </svg>
      </div>

      <ZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onRecenter={() => setDidFit(false)}
        onShowWorld={handleShowWorld}
      />

      {hovered && (
        <TileHoverCard
          hovered={hovered}
          hoveredOwner={hoveredOwner}
          isOwnTile={hovered.ownerId === player.userId}
        />
      )}
    </div>
  );
}
