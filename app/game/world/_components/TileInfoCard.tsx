/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import type { Caste } from "@/lib/game/types";
import type { World3DTile } from "@/lib/game/world-snapshot-3d";
import { LAND_TYPE_LABEL } from "./world-constants";

interface TileInfoCardProps {
  tile: World3DTile;
  signedIn: boolean;
  onClose: () => void;
  casteColorHex: Record<Caste, number>;
  casteLabel: Record<Caste, string>;
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

export function TileInfoCard({
  tile,
  signedIn,
  onClose,
  casteColorHex,
  casteLabel,
}: TileInfoCardProps) {
  const ownerLabel = tile.ownerName
    ? tile.isNpc
      ? `${tile.ownerName} (NPC)`
      : tile.ownerName
    : "Unclaimed";

  const swatchColor = tile.caste
    ? hexToCss(casteColorHex[tile.caste])
    : "#6b6b6b";

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-24 sm:bottom-28 z-10 w-[min(420px,calc(100vw-2rem))] rounded-xl bg-neutral-900/90 backdrop-blur border border-neutral-700/60 shadow-2xl">
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-4 w-4 rounded-sm border border-neutral-700"
            style={{ backgroundColor: swatchColor }}
            aria-hidden
          />
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-400">
              Tile {tile.tileId}
            </div>
            <div className="text-sm font-medium">{ownerLabel}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-neutral-400 hover:text-neutral-100 px-2"
        >
          ×
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 pb-4 text-sm">
        <dt className="text-neutral-400">Caste</dt>
        <dd>{tile.caste ? casteLabel[tile.caste] : "—"}</dd>

        <dt className="text-neutral-400">Land</dt>
        <dd>{LAND_TYPE_LABEL[tile.type]}</dd>

        <dt className="text-neutral-400">Level</dt>
        <dd>{tile.level}</dd>

        <dt className="text-neutral-400">Reinforcements</dt>
        <dd>{tile.hasExtraForces ? "Yes" : "Base garrison only"}</dd>

        <dt className="text-neutral-400">Hero</dt>
        <dd>{tile.hasHero ? "Stationed" : "—"}</dd>

        {tile.ownerShielded && (
          <>
            <dt className="text-neutral-400">Shield</dt>
            <dd>Active</dd>
          </>
        )}
      </dl>

      {!signedIn && (
        <div className="border-t border-neutral-800 px-4 py-3 text-xs text-neutral-300">
          <Link
            href="/login"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Sign in
          </Link>{" "}
          to attack, recruit, and claim land of your own.
        </div>
      )}
    </div>
  );
}
