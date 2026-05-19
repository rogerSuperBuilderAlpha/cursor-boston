/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { LandType } from "@/lib/game/types";
import { TYPE_FILL, TYPE_STROKE } from "../_lib/constants";

function LegendItem({ type }: { type: LandType }) {
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

export function MapLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-xs text-neutral-500">
      <LegendItem type="military" />
      <LegendItem type="food" />
      <LegendItem type="magic" />
      <LegendItem type="unassigned" />
      <LegendItem type="unrevealed" />
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
  );
}
