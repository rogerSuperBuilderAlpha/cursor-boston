/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/tiles/_components/MapCanvas.tsx`
 * was at 12.8% statements (34 uncovered). Covers fit-to-content effect
 * (kingdom mode + world mode + empty fallback), drag-suppressed click
 * gating, ShowWorld handler, hover enter/leave, ZoomControls callbacks,
 * onTileClick happy path.
 */

import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen } from "@testing-library/react";

const mockFit = jest.fn(() => ({ tx: 10, ty: 20, scale: 1.5 }));

jest.mock("@/app/game/tiles/_lib/hex-math", () => ({
  fitTilesToViewport: (...args: unknown[]) => mockFit(...args),
}));

jest.mock("@/app/game/tiles/_components/TileHexagon", () => ({
  TileHexagon: ({ tile, onHoverEnter, onHoverLeave, onClick }: {
    tile: { tileId: string };
    onHoverEnter: (t: { tileId: string }) => void;
    onHoverLeave: (t: { tileId: string }) => void;
    onClick: (t: { tileId: string }) => void;
  }) => (
    <g
      data-testid={`hex-${tile.tileId}`}
      onMouseEnter={() => onHoverEnter(tile)}
      onMouseLeave={() => onHoverLeave(tile)}
      onClick={() => onClick(tile)}
    />
  ),
}));

jest.mock("@/app/game/tiles/_components/TileHoverCard", () => ({
  TileHoverCard: ({ hovered }: { hovered: { tileId: string } }) => (
    <div data-testid="hover-card">{hovered.tileId}</div>
  ),
}));

jest.mock("@/app/game/tiles/_components/ZoomControls", () => ({
  ZoomControls: ({
    onZoomIn,
    onZoomOut,
    onRecenter,
    onShowWorld,
  }: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onRecenter: () => void;
    onShowWorld: () => void;
  }) => (
    <div>
      <button onClick={onZoomIn}>zoom-in</button>
      <button onClick={onZoomOut}>zoom-out</button>
      <button onClick={onRecenter}>recenter</button>
      <button onClick={onShowWorld}>show-world</button>
    </div>
  ),
}));

import { MapCanvas } from "@/app/game/tiles/_components/MapCanvas";

function makePanZoom(over: Partial<Record<string, unknown>> = {}) {
  return {
    scale: 1,
    setScale: jest.fn(),
    tx: 0,
    setTx: jest.fn(),
    ty: 0,
    setTy: jest.fn(),
    didFit: false,
    setDidFit: jest.fn(),
    dragging: false,
    svgRef: { current: null },
    handlePointerDown: jest.fn(),
    lastDragMovedRef: { current: 0 },
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    ...over,
  } as never;
}

const player = { userId: "u1" } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockFit.mockReturnValue({ tx: 10, ty: 20, scale: 1.5 });
});

describe("MapCanvas", () => {
  it("renders SVG container and ZoomControls", () => {
    const panZoom = makePanZoom();
    render(
      <MapCanvas
        player={player}
        tiles={[]}
        visibleTiles={[]}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    expect(screen.getByText("zoom-in")).toBeInTheDocument();
    expect(screen.getByText("recenter")).toBeInTheDocument();
    expect(screen.getByText("show-world")).toBeInTheDocument();
  });

  it("fits to player tiles on first render in kingdom mode", () => {
    const panZoom = makePanZoom();
    const tiles = [
      { tileId: "t1", ownerId: "u1", type: "forest" },
      { tileId: "t2", ownerId: "other", type: "forest" },
    ];
    render(
      <MapCanvas
        player={player}
        tiles={tiles as never}
        visibleTiles={tiles as never}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    expect(mockFit).toHaveBeenCalled();
    expect(panZoom.setTx).toHaveBeenCalledWith(10);
    expect(panZoom.setTy).toHaveBeenCalledWith(20);
    expect(panZoom.setScale).toHaveBeenCalledWith(1.5);
    expect(panZoom.setDidFit).toHaveBeenCalledWith(true);
  });

  it("fits to all tiles in world mode", () => {
    const panZoom = makePanZoom();
    const tiles = [
      { tileId: "t1", ownerId: "u1", type: "forest" },
      { tileId: "t2", ownerId: "other", type: "forest" },
    ];
    render(
      <MapCanvas
        player={player}
        tiles={tiles as never}
        visibleTiles={tiles as never}
        ownersById={new Map()}
        filter="all"
        mode="world"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    expect(mockFit).toHaveBeenCalledWith(tiles);
  });

  it("falls back to all-tiles fit when player has no owned tiles", () => {
    const panZoom = makePanZoom();
    const tiles = [
      { tileId: "t1", ownerId: "other", type: "forest" },
    ];
    render(
      <MapCanvas
        player={player}
        tiles={tiles as never}
        visibleTiles={tiles as never}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    expect(mockFit).toHaveBeenCalledWith(tiles);
  });

  it("does NOT fit when didFit=true", () => {
    const panZoom = makePanZoom({ didFit: true });
    render(
      <MapCanvas
        player={player}
        tiles={[{ tileId: "t1", ownerId: "u1" }] as never}
        visibleTiles={[]}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    expect(mockFit).not.toHaveBeenCalled();
  });

  it("does NOT fit when tiles is empty", () => {
    const panZoom = makePanZoom();
    render(
      <MapCanvas
        player={player}
        tiles={[]}
        visibleTiles={[]}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    expect(mockFit).not.toHaveBeenCalled();
  });

  it("does NOT apply transform when fitTilesToViewport returns null", () => {
    mockFit.mockReturnValueOnce(null as never);
    const panZoom = makePanZoom();
    const tiles = [{ tileId: "t1", ownerId: "u1" }];
    render(
      <MapCanvas
        player={player}
        tiles={tiles as never}
        visibleTiles={tiles as never}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    expect(panZoom.setTx).not.toHaveBeenCalled();
    expect(panZoom.setDidFit).toHaveBeenCalledWith(true);
  });

  it("calls onTileClick when hex is clicked (no drag)", () => {
    const panZoom = makePanZoom({ didFit: true });
    const onTileClick = jest.fn();
    render(
      <MapCanvas
        player={player}
        tiles={[]}
        visibleTiles={[{ tileId: "t1", ownerId: "u1" }] as never}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={onTileClick}
      />
    );
    fireEvent.click(screen.getByTestId("hex-t1"));
    expect(onTileClick).toHaveBeenCalledWith(expect.objectContaining({ tileId: "t1" }));
  });

  it("suppresses click when lastDragMovedRef.current > 5", () => {
    const panZoom = makePanZoom({
      didFit: true,
      lastDragMovedRef: { current: 10 },
    });
    const onTileClick = jest.fn();
    render(
      <MapCanvas
        player={player}
        tiles={[]}
        visibleTiles={[{ tileId: "t1", ownerId: "u1" }] as never}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={onTileClick}
      />
    );
    fireEvent.click(screen.getByTestId("hex-t1"));
    expect(onTileClick).not.toHaveBeenCalled();
    expect(panZoom.lastDragMovedRef.current).toBe(0);
  });

  it("renders TileHoverCard when a tile is hovered", () => {
    const panZoom = makePanZoom({ didFit: true });
    const owners = new Map([
      ["u1", { userId: "u1", displayName: "Me" }],
    ]);
    render(
      <MapCanvas
        player={player}
        tiles={[]}
        visibleTiles={[{ tileId: "t1", ownerId: "u1" }] as never}
        ownersById={owners as never}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    fireEvent.mouseEnter(screen.getByTestId("hex-t1"));
    expect(screen.getByTestId("hover-card")).toBeInTheDocument();
  });

  it("hides hover card on hover leave for the SAME tile", () => {
    const panZoom = makePanZoom({ didFit: true });
    render(
      <MapCanvas
        player={player}
        tiles={[]}
        visibleTiles={[{ tileId: "t1", ownerId: "u1" }] as never}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    fireEvent.mouseEnter(screen.getByTestId("hex-t1"));
    fireEvent.mouseLeave(screen.getByTestId("hex-t1"));
    expect(screen.queryByTestId("hover-card")).not.toBeInTheDocument();
  });

  it("ZoomControls recenter button flips didFit=false", () => {
    const panZoom = makePanZoom({ didFit: true });
    render(
      <MapCanvas
        player={player}
        tiles={[]}
        visibleTiles={[]}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText("recenter"));
    expect(panZoom.setDidFit).toHaveBeenCalledWith(false);
  });

  it("ZoomControls show-world button calls fitTilesToViewport with all tiles", () => {
    const panZoom = makePanZoom({ didFit: true });
    const tiles = [{ tileId: "t1", ownerId: "u1" }];
    render(
      <MapCanvas
        player={player}
        tiles={tiles as never}
        visibleTiles={[]}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    mockFit.mockClear();
    fireEvent.click(screen.getByText("show-world"));
    expect(mockFit).toHaveBeenCalledWith(tiles);
    expect(panZoom.setTx).toHaveBeenCalledWith(10);
  });

  it("show-world handler is a no-op when fitTilesToViewport returns null", () => {
    const panZoom = makePanZoom({ didFit: true });
    render(
      <MapCanvas
        player={player}
        tiles={[{ tileId: "t1" }] as never}
        visibleTiles={[]}
        ownersById={new Map()}
        filter="all"
        mode="kingdom"
        panZoom={panZoom}
        onTileClick={jest.fn()}
      />
    );
    panZoom.setTx.mockClear();
    mockFit.mockReturnValueOnce(null as never);
    fireEvent.click(screen.getByText("show-world"));
    expect(panZoom.setTx).not.toHaveBeenCalled();
  });
});
