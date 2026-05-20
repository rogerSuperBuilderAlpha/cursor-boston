/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/recruit/_components/PlanPreview.tsx`
 * (7.7% / 12 uncovered branches). Covers null-when-empty, 'Routing to'
 * vs 'Auto-routing units' headers, tile-known vs tile-unknown units
 * computation, most-threatened tag (first entry, auto-route, >1 plan),
 * single-tile no-tag.
 */

import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/game/recruit/_lib/constants", () => ({
  unitsPerCycleForLand: (type: string) =>
    type === "military" ? 5 : type === "food" ? 3 : type === "magic" ? 2 : 0,
}));

import { PlanPreview } from "@/app/game/recruit/_components/PlanPreview";

function makeTilesById(tiles: Array<{ tileId: string; type: string }>) {
  return new Map(tiles.map((t) => [t.tileId, t as never]));
}

describe("PlanPreview", () => {
  it("renders null when plan is empty", () => {
    const { container } = render(
      <PlanPreview plan={[]} selectedTileId="" tilesById={new Map()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows 'Routing to' header when a tile is selected", () => {
    render(
      <PlanPreview
        plan={[{ tileId: "t1", cycles: 2 }]}
        selectedTileId="t1"
        tilesById={makeTilesById([{ tileId: "t1", type: "military" }])}
      />
    );
    expect(screen.getByText("Routing to")).toBeInTheDocument();
  });

  it("shows 'Auto-routing units' header when no tile is selected", () => {
    render(
      <PlanPreview
        plan={[{ tileId: "t1", cycles: 2 }]}
        selectedTileId=""
        tilesById={makeTilesById([{ tileId: "t1", type: "military" }])}
      />
    );
    expect(screen.getByText("Auto-routing units")).toBeInTheDocument();
  });

  it("computes units = cycles * perCycle for known tile type", () => {
    render(
      <PlanPreview
        plan={[{ tileId: "t1", cycles: 4 }]}
        selectedTileId="t1"
        tilesById={makeTilesById([{ tileId: "t1", type: "military" }])}
      />
    );
    // military → 5 per cycle, 4 cycles → +20
    expect(screen.getByText(/t1 \+20/)).toBeInTheDocument();
    expect(screen.getByText(/military/)).toBeInTheDocument();
  });

  it("falls back to 0 units when tile is unknown (not in tilesById)", () => {
    render(
      <PlanPreview
        plan={[{ tileId: "ghost", cycles: 4 }]}
        selectedTileId=""
        tilesById={new Map()}
      />
    );
    expect(screen.getByText(/ghost \+0/)).toBeInTheDocument();
  });

  it("shows [most-threatened] tag on first entry when auto-routing with multiple", () => {
    render(
      <PlanPreview
        plan={[
          { tileId: "t1", cycles: 2 },
          { tileId: "t2", cycles: 1 },
        ]}
        selectedTileId=""
        tilesById={makeTilesById([
          { tileId: "t1", type: "military" },
          { tileId: "t2", type: "food" },
        ])}
      />
    );
    expect(screen.getByText(/most-threatened/)).toBeInTheDocument();
  });

  it("does NOT show [most-threatened] when only a single tile is in the plan", () => {
    render(
      <PlanPreview
        plan={[{ tileId: "t1", cycles: 2 }]}
        selectedTileId=""
        tilesById={makeTilesById([{ tileId: "t1", type: "food" }])}
      />
    );
    expect(screen.queryByText(/most-threatened/)).not.toBeInTheDocument();
  });

  it("does NOT show [most-threatened] when a tile is selected", () => {
    render(
      <PlanPreview
        plan={[
          { tileId: "t1", cycles: 2 },
          { tileId: "t2", cycles: 1 },
        ]}
        selectedTileId="t1"
        tilesById={makeTilesById([
          { tileId: "t1", type: "military" },
          { tileId: "t2", type: "food" },
        ])}
      />
    );
    expect(screen.queryByText(/most-threatened/)).not.toBeInTheDocument();
  });
});
