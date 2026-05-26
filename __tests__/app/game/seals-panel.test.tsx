/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/SealsPanel.tsx`
 * was at 13.9% statements (37 uncovered). Covers null guard, broken/unbroken
 * seal grid, formatRelative branches, at-gate vs path-to-gate copy,
 * resolving banner, magic-hero contribution, contender list filtering.
 */

import "@/__tests__/app/_shared/page-test-setup";

import { render, screen } from "@testing-library/react";

import { SealsPanel } from "@/app/game/_components/dashboard/SealsPanel";

function makeMeta(over: Partial<{ sealsBroken: number; seasonNumber: number; armageddonState: string; seals: unknown[] }> = {}) {
  return {
    sealsBroken: 0,
    seasonNumber: 1,
    armageddonState: "active",
    seals: [],
    ...over,
  } as never;
}

describe("SealsPanel", () => {
  it("renders nothing when worldMeta is null", () => {
    const { container } = render(
      <SealsPanel
        worldMeta={null}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 7 seal slots with default unbroken state when seals is empty", () => {
    render(
      <SealsPanel
        worldMeta={makeMeta()}
        topLeaders={[]}
        playerTilesHeld={500}
        playerTiles={[]}
      />
    );
    expect(screen.getByText(/Season 1 — The Seven Seals/)).toBeInTheDocument();
    expect(screen.getByText("0 / 7 broken")).toBeInTheDocument();
    // Seven labeled tiles "#1" through "#7"
    for (let i = 1; i <= 7; i++) {
      expect(screen.getByText(`#${i}`)).toBeInTheDocument();
    }
  });

  it("renders the resolving banner when armageddonState=resolving", () => {
    render(
      <SealsPanel
        worldMeta={makeMeta({ armageddonState: "resolving" })}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    expect(screen.getByText(/Armageddon is upon us/)).toBeInTheDocument();
  });

  it("shows percentage-to-gate when player is below the gate", () => {
    render(
      <SealsPanel
        worldMeta={makeMeta()}
        topLeaders={[]}
        playerTilesHeld={2500}
        playerTiles={[]}
      />
    );
    expect(screen.getByText(/25\.0% to the gate/)).toBeInTheDocument();
  });

  it("shows '✦ At the gate' when player has reached the gate", () => {
    render(
      <SealsPanel
        worldMeta={makeMeta()}
        topLeaders={[]}
        playerTilesHeld={10_000}
        playerTiles={[]}
      />
    );
    expect(screen.getByText(/At the gate/)).toBeInTheDocument();
  });

  it("formats brokenAt 'just now' for sub-minute deltas", () => {
    const now = Date.now();
    const meta = makeMeta({
      sealsBroken: 1,
      seals: [
        {
          index: 0,
          broken: true,
          brokenBy: { displayName: "Ada", caste: "red" },
          brokenAt: new Date(now - 30_000),
        } as never,
      ],
    });
    render(
      <SealsPanel
        worldMeta={meta}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    // The tooltip is rendered via title attribute on the seal div.
    const broken = screen.getByTitle((title) =>
      title.includes("Broken by Ada (red)") && title.includes("just now")
    );
    expect(broken).toBeInTheDocument();
  });

  it("formats brokenAt minutes/hours/days correctly", () => {
    const now = Date.now();
    const meta = makeMeta({
      seals: [
        // 5m ago
        { index: 0, broken: true, brokenBy: { displayName: "M" }, brokenAt: new Date(now - 5 * 60_000) } as never,
        // 3h ago
        { index: 1, broken: true, brokenBy: { displayName: "H" }, brokenAt: new Date(now - 3 * 60 * 60_000) } as never,
        // 2d ago
        { index: 2, broken: true, brokenBy: { displayName: "D" }, brokenAt: new Date(now - 2 * 24 * 60 * 60_000) } as never,
      ],
    });
    render(
      <SealsPanel
        worldMeta={meta}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    expect(screen.getByTitle((t) => t.includes("Broken by M") && t.includes("5m ago"))).toBeInTheDocument();
    expect(screen.getByTitle((t) => t.includes("Broken by H") && t.includes("3h ago"))).toBeInTheDocument();
    expect(screen.getByTitle((t) => t.includes("Broken by D") && t.includes("2d ago"))).toBeInTheDocument();
  });

  it("accepts a Firestore-Timestamp-like value with toDate()", () => {
    const meta = makeMeta({
      seals: [
        {
          index: 0,
          broken: true,
          brokenBy: { displayName: "T" },
          brokenAt: { toDate: () => new Date(Date.now() - 30_000) },
        } as never,
      ],
    });
    render(
      <SealsPanel
        worldMeta={meta}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    expect(screen.getByTitle(/just now/)).toBeInTheDocument();
  });

  it("shows top-5 'path to the gate' when nobody is at the gate", () => {
    const topLeaders = [
      { userId: "u1", displayName: "Alice", caste: "red", tilesHeld: 5000 },
      { userId: "u2", displayName: "Bob", caste: null, tilesHeld: 4000 },
    ];
    render(
      <SealsPanel
        worldMeta={makeMeta()}
        topLeaders={topLeaders as never}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    expect(screen.getByText(/Top kingdoms — path to the gate/)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows 'at the gate' header when ≥1 kingdom is over the threshold", () => {
    const topLeaders = [
      { userId: "u1", displayName: "Alice", caste: "red", tilesHeld: 12_000 },
    ];
    render(
      <SealsPanel
        worldMeta={makeMeta()}
        topLeaders={topLeaders as never}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    expect(screen.getByText(/1 kingdom at the gate/)).toBeInTheDocument();
  });

  it("falls back '—' display name when missing on brokenBy", () => {
    const meta = makeMeta({
      seals: [
        {
          index: 0,
          broken: true,
          brokenBy: {},
          brokenAt: new Date(),
        } as never,
      ],
    });
    render(
      <SealsPanel
        worldMeta={meta}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    expect(screen.getByTitle(/Broken by —/)).toBeInTheDocument();
  });

  it("falls back to empty string display when brokenAt is undefined", () => {
    const meta = makeMeta({
      seals: [{ index: 0, broken: true, brokenBy: { displayName: "X" } } as never],
    });
    render(
      <SealsPanel
        worldMeta={meta}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    // Should not throw and the broken tile should be rendered
    expect(screen.getByTitle(/Broken by X/)).toBeInTheDocument();
  });

  it("renders unbroken seal title 'Seal N — unbroken'", () => {
    render(
      <SealsPanel
        worldMeta={makeMeta()}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={[]}
      />
    );
    expect(screen.getByTitle(/Seal 1 — unbroken/)).toBeInTheDocument();
  });

  it("renders the magic-hero contribution line when player has magic heroes", () => {
    const playerTiles = [
      { hero: { class: "magic", stamina: 100, specialty: "armageddon" } },
      { hero: { class: "magic", stamina: 50 } },
    ];
    render(
      <SealsPanel
        worldMeta={makeMeta()}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={playerTiles as never}
      />
    );
    expect(screen.getByText(/2 magic heroes/)).toBeInTheDocument();
  });

  it("does NOT render magic-hero line when player has 0 magic heroes", () => {
    const playerTiles = [
      { hero: { class: "warrior", stamina: 100 } },
    ];
    render(
      <SealsPanel
        worldMeta={makeMeta()}
        topLeaders={[]}
        playerTilesHeld={0}
        playerTiles={playerTiles as never}
      />
    );
    expect(screen.queryByText(/magic hero/i)).not.toBeInTheDocument();
  });
});
