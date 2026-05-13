/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { MapTile } from "@/lib/game/types";
import {
  CASTE_BORDER,
  FOREIGN_FILL,
  HEX_SIZE,
  TYPE_FILL,
  TYPE_STROKE,
  TYPE_TEXT,
} from "../_lib/constants";
import { axialToPixel, hexPoints } from "../_lib/hex-math";
import type { OwnerSummary } from "../_lib/types";

interface Props {
  tile: MapTile;
  isOwn: boolean;
  matched: boolean;
  owner: OwnerSummary | null;
  onHoverEnter: (t: MapTile) => void;
  onHoverLeave: (t: MapTile) => void;
  onClick: (t: MapTile) => void;
}

/**
 * Single hex render — polygon + decorations (own tile id, unit count,
 * armed-spell dot, foreign-tile shield indicator). Foreign tiles use a
 * near-white fill + thick caste-colored border so they read as "not
 * yours" in one glance, even on a busy map. Type info is preserved via
 * an inner colored dot.
 */
export function TileHexagon({
  tile: t,
  isOwn,
  matched,
  owner,
  onHoverEnter,
  onHoverLeave,
  onClick,
}: Props) {
  const { x, y } = axialToPixel(t.q, t.r);
  const isForeign = !!t.ownerId && !isOwn;
  const fill = isForeign ? FOREIGN_FILL : TYPE_FILL[t.type];
  const stroke = isOwn
    ? TYPE_STROKE[t.type]
    : owner?.caste
      ? CASTE_BORDER[owner.caste]
      : "#737373";
  const strokeWidth = isOwn ? 1.5 : isForeign ? 3.5 : 2.25;
  const text = TYPE_TEXT[t.type];
  const armed = !!t.armedDefenseSpellId;
  // BASE+SUPER: hex visual intensity reflects total defender force, not
  // just recruited units. An undefended military tile with 45 BASE should
  // look as armed as one with 45 SUPER.
  const totalUnits =
    t.units.ground +
    t.units.siege +
    t.units.air +
    (t.baseUnits?.ground ?? 0) +
    (t.baseUnits?.siege ?? 0) +
    (t.baseUnits?.air ?? 0);
  // Filter dimming still applies, but the muddy 0.6 wash on foreign tiles
  // is gone — the bright fill carries the visual weight on its own.
  const opacity = matched ? 1 : 0.12;
  return (
    <g
      opacity={opacity}
      onMouseEnter={() => onHoverEnter(t)}
      onMouseLeave={() => onHoverLeave(t)}
      onClick={() => onClick(t)}
      style={{ cursor: t.ownerId ? "pointer" : "default" }}
    >
      <polygon
        points={hexPoints(x, y)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* Inner type-dot on foreign tiles preserves the tactical info
          (military / food / magic) that the white fill would otherwise hide. */}
      {isForeign &&
        (t.type === "military" || t.type === "food" || t.type === "magic") && (
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
}
