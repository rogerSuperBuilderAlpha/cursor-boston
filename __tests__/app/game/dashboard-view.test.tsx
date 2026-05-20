/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/DashboardView.tsx`
 * was at 48% branches (13 uncovered). The component composes ~20 sub-cards
 * via useMemo derivations + conditional rendering. Every sub-component is
 * mocked out so this suite exercises only DashboardView's own logic:
 *   - counts / army / unitCap / threats / shieldStatus / recommended useMemo
 *   - `error &&` banner branch
 *   - `eligibility &&` banner branch
 *   - `isAdmin &&` admin block + Grant button wiring
 *   - `phase === "play"` branches for ExploreFrontier + FarExpedition
 *   - `(phase === "distribute" || "play") && counts.unassigned > 0` branch
 *   - `phase === "play" && tiles.some(military/food/magic)` branch for BulkUnassign
 *   - onRenameStart / onRenameSubmit (rename happy + no-change paths)
 *   - onRenameCancel
 */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

// ──────────────── Sub-component mocks (replace with prop-readouts) ────────────────
const mockOnboarding = jest.fn();
jest.mock("@/app/game/_components/onboarding/OnboardingWizard", () => ({
  OnboardingWizard: (props: Record<string, unknown>) => {
    mockOnboarding(props);
    return <div data-testid="onboarding-wizard" />;
  },
}));

jest.mock("@/app/game/_components/dashboard/DashboardHeader", () => ({
  DashboardHeader: (props: {
    renaming: boolean;
    renameInput: string;
    onRenameStart: () => void;
    onRenameChange: (s: string) => void;
    onRenameCancel: () => void;
    onRenameSubmit: () => void;
  }) => (
    <div data-testid="dashboard-header">
      <span>renaming:{String(props.renaming)}</span>
      <button data-testid="rename-start" onClick={props.onRenameStart}>start</button>
      <button data-testid="rename-cancel" onClick={props.onRenameCancel}>cancel</button>
      <button data-testid="rename-submit" onClick={props.onRenameSubmit}>submit</button>
      <input
        data-testid="rename-input"
        value={props.renameInput}
        onChange={(e) => props.onRenameChange(e.target.value)}
      />
    </div>
  ),
}));

jest.mock("@/app/game/_components/dashboard/EligibilityBanner", () => ({
  EligibilityBanner: () => <div data-testid="eligibility-banner" />,
}));

jest.mock("@/app/game/_components/dashboard/HeroCard", () => ({
  HeroCard: (props: { turnsRemaining: number; turnsSpent: number }) => (
    <div data-testid="hero-card">
      turns:{props.turnsRemaining}/{props.turnsSpent}
    </div>
  ),
}));

jest.mock("@/app/game/_components/dashboard/RecommendedAction", () => ({
  RecommendedAction: (props: { rec: { title: string }; phase: string }) => (
    <div data-testid="recommended">
      rec:{props.rec.title} phase:{props.phase}
    </div>
  ),
}));

jest.mock("@/app/game/_components/dashboard/LandsCard", () => ({
  LandsCard: (props: { counts: { total: number; military: number; food: number; magic: number; unassigned: number } }) => (
    <div data-testid="lands-card">
      total:{props.counts.total} mil:{props.counts.military} food:{props.counts.food} magic:{props.counts.magic} un:{props.counts.unassigned}
    </div>
  ),
}));

jest.mock("@/app/game/_components/dashboard/ArmyCard", () => ({
  ArmyCard: (props: { army: { total: number; ground: number; siege: number; air: number }; cap: number }) => (
    <div data-testid="army-card">
      army-total:{props.army.total} ground:{props.army.ground} siege:{props.army.siege} air:{props.army.air} cap:{props.cap}
    </div>
  ),
}));

jest.mock("@/app/game/_components/dashboard/ThreatCard", () => ({
  ThreatCard: (props: { threats: { unshieldedNeighbors: number }; shielded: boolean }) => (
    <div data-testid="threat-card">
      threats:{props.threats.unshieldedNeighbors} shielded:{String(props.shielded)}
    </div>
  ),
}));

jest.mock("@/app/game/_components/dashboard/ShieldCard", () => ({
  ShieldCard: (props: { shield: { shielded: boolean } }) => (
    <div data-testid="shield-card">
      shielded:{String(props.shield.shielded)}
    </div>
  ),
}));

jest.mock("@/app/game/_components/dashboard/SealsPanel", () => ({
  SealsPanel: () => <div data-testid="seals-panel" />,
}));

jest.mock("@/app/game/_components/dashboard/ExploreFrontier", () => ({
  ExploreFrontier: (props: { onExplore: () => void }) => (
    <button data-testid="explore-frontier" onClick={props.onExplore}>explore</button>
  ),
}));

jest.mock("@/app/game/_components/dashboard/FarExpedition", () => ({
  FarExpedition: (props: { onLaunch: () => void }) => (
    <button data-testid="far-expedition" onClick={props.onLaunch}>far</button>
  ),
}));

jest.mock("@/app/game/_components/dashboard/BulkDistribute", () => ({
  BulkDistribute: (props: { unassignedCount: number; onRun: () => void }) => (
    <button data-testid="bulk-distribute" onClick={props.onRun}>
      bd:{props.unassignedCount}
    </button>
  ),
}));

jest.mock("@/app/game/_components/dashboard/BulkUnassign", () => ({
  BulkUnassign: (props: { onRun: (s: string, n: number) => void }) => (
    <button data-testid="bulk-unassign" onClick={() => props.onRun("military", 5)}>bu</button>
  ),
}));

jest.mock("@/app/game/_components/dashboard/MiniMap", () => ({
  MiniMap: () => <div data-testid="mini-map" />,
}));

jest.mock("@/app/game/_components/dashboard/NavGrid", () => ({
  NavGrid: (props: { phase: string }) => <div data-testid="nav-grid">{props.phase}</div>,
}));

jest.mock("@/app/game/_components/dashboard/DashboardReports", () => ({
  DashboardReports: () => <div data-testid="reports" />,
}));

jest.mock("@/app/game/_components/dashboard/CasteChangeCard", () => ({
  CasteChangeCard: () => <div data-testid="caste-change" />,
}));

jest.mock("@/app/game/_components/dashboard/CommunityPanel", () => ({
  CommunityPanel: (props: { isAdmin: boolean }) => (
    <div data-testid="community-panel">admin:{String(props.isAdmin)}</div>
  ),
}));

jest.mock("@/app/game/_components/dashboard/DesignersWantedCard", () => ({
  DesignersWantedCard: () => <div data-testid="designers" />,
}));

jest.mock("@/app/game/_components/dashboard/HeroesRosterCard", () => ({
  HeroesRosterCard: () => <div data-testid="heroes-roster" />,
}));

jest.mock("@/app/game/_components/dashboard/SummonableUnitsCard", () => ({
  SummonableUnitsCard: () => <div data-testid="summonable" />,
}));

// Pure-function imports — keep the real implementations so we exercise the
// useMemo wiring in DashboardView faithfully.
jest.mock("@/lib/game/turns", () => {
  const actual = jest.requireActual("@/lib/game/turns");
  return {
    ...actual,
    effectiveUnitCap: jest.fn(() => 999),
  };
});
jest.mock("@/app/game/_lib/dashboard-helpers", () => ({
  countUnshieldedNeighbors: jest.fn(() => ({
    unshieldedNeighbors: 2,
    totalForeignNeighbors: 3,
    topNeighborNames: ["A", "B"],
  })),
  deriveShieldStatus: jest.fn(() => ({
    shielded: true,
    daysLeft: 1,
    turnsLeft: 5,
    bottleneck: "time",
  })),
}));
jest.mock("@/app/game/_lib/recommend", () => ({
  recommendNext: jest.fn(() => ({
    title: "Do thing",
    body: "now",
    ctaLabel: "Go",
    tone: "primary",
  })),
}));

import { DashboardView } from "@/app/game/_components/dashboard/DashboardView";

// ──────────────── Fixture builders ────────────────
function tile(
  over: Partial<{
    tileId: string;
    type: "military" | "food" | "magic" | "unassigned";
    ground: number;
    siege: number;
    air: number;
  }> = {}
) {
  return {
    tileId: over.tileId ?? "1_0",
    type: over.type ?? "unassigned",
    units: {
      ground: over.ground ?? 0,
      siege: over.siege ?? 0,
      air: over.air ?? 0,
    },
  } as never;
}

function makePlayer(over: Partial<{ phase: string; displayName: string; turnsRemaining: number; userId: string }> = {}) {
  return {
    userId: over.userId ?? "u1",
    displayName: over.displayName ?? "P1",
    caste: "red",
    turnsRemaining: over.turnsRemaining ?? 10,
    turnsSpentTotal: 5,
    phase: over.phase ?? "play",
    tilesExplored: 0,
    shieldUntil: new Date(),
    shieldDropAtTurn: 0,
    productionSpellsActive: [],
    stats: {
      tilesHeld: 0,
      attacksWon: 0,
      attacksLost: 0,
      unitsAlive: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never;
}

function makeData(over: Partial<Record<string, unknown>> = {}) {
  const base = {
    user: { uid: "u1" },
    tiles: [],
    worldTiles: [],
    worldOwners: new Map(),
    eligibility: null,
    isAdmin: false,
    error: null,
    renaming: false,
    renameInput: "",
    setRenaming: jest.fn(),
    setRenameInput: jest.fn(),
    exploring: false,
    exploreCount: 1,
    setExploreCount: jest.fn(),
    exploreProgress: null,
    handleFrontierExplore: jest.fn(),
    distributing: false,
    distributeType: "military",
    setDistributeType: jest.fn(),
    distributeCount: 10,
    setDistributeCount: jest.fn(),
    distributeProgress: null,
    handleBulkDistribute: jest.fn(),
    handleSetName: jest.fn(),
    handleAdminGrant: jest.fn(),
    handleFarExpedition: jest.fn(),
    recentReports: [],
    refresh: jest.fn(),
    worldMeta: null,
    topLeaders: [],
    ...over,
  };
  return base as never;
}

describe("DashboardView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("derives land-type counts via useMemo and forwards them to LandsCard", () => {
    const tiles = [
      tile({ tileId: "1_0", type: "military" }),
      tile({ tileId: "1_1", type: "military" }),
      tile({ tileId: "1_2", type: "food" }),
      tile({ tileId: "1_3", type: "magic" }),
      tile({ tileId: "1_4", type: "unassigned" }),
    ];
    render(<DashboardView player={makePlayer()} data={makeData({ tiles })} />);
    expect(screen.getByTestId("lands-card")).toHaveTextContent(
      "total:5 mil:2 food:1 magic:1 un:1"
    );
  });

  it("derives army totals (ground+siege+air) via useMemo and forwards to ArmyCard", () => {
    const tiles = [
      tile({ tileId: "1_0", ground: 5, siege: 2, air: 1 }),
      tile({ tileId: "1_1", ground: 3, siege: 0, air: 4 }),
    ];
    render(<DashboardView player={makePlayer()} data={makeData({ tiles })} />);
    expect(screen.getByTestId("army-card")).toHaveTextContent(
      "army-total:15 ground:8 siege:2 air:5 cap:999"
    );
  });

  it("renders the error banner when data.error is set", () => {
    render(
      <DashboardView player={makePlayer()} data={makeData({ error: "boom" })} />
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("does NOT render an error banner when error is null", () => {
    render(<DashboardView player={makePlayer()} data={makeData()} />);
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("renders the EligibilityBanner when eligibility is set", () => {
    render(
      <DashboardView
        player={makePlayer()}
        data={makeData({ eligibility: { githubLogin: "x", mergedPrCountThisWeek: 2, nextRolloverIso: "2026-01-01" } })}
      />
    );
    expect(screen.getByTestId("eligibility-banner")).toBeInTheDocument();
  });

  it("does NOT render EligibilityBanner when eligibility is null", () => {
    render(<DashboardView player={makePlayer()} data={makeData()} />);
    expect(screen.queryByTestId("eligibility-banner")).not.toBeInTheDocument();
  });

  it("renders the admin grant button when isAdmin=true and wires onClick", () => {
    const handleAdminGrant = jest.fn();
    render(
      <DashboardView
        player={makePlayer()}
        data={makeData({ isAdmin: true, handleAdminGrant })}
      />
    );
    const btn = screen.getByRole("button", { name: /Grant 100 turns/ });
    fireEvent.click(btn);
    expect(handleAdminGrant).toHaveBeenCalled();
  });

  it("does NOT render the admin block when isAdmin=false", () => {
    render(<DashboardView player={makePlayer()} data={makeData()} />);
    expect(screen.queryByRole("button", { name: /Grant 100 turns/ })).toBeNull();
  });

  it("renders ExploreFrontier + FarExpedition when phase === 'play'", () => {
    render(<DashboardView player={makePlayer({ phase: "play" })} data={makeData()} />);
    expect(screen.getByTestId("explore-frontier")).toBeInTheDocument();
    expect(screen.getByTestId("far-expedition")).toBeInTheDocument();
  });

  it("does NOT render ExploreFrontier/FarExpedition when phase !== 'play'", () => {
    render(<DashboardView player={makePlayer({ phase: "distribute" })} data={makeData()} />);
    expect(screen.queryByTestId("explore-frontier")).toBeNull();
    expect(screen.queryByTestId("far-expedition")).toBeNull();
  });

  it("renders BulkDistribute when phase='play' AND counts.unassigned > 0", () => {
    const tiles = [tile({ type: "unassigned" })];
    render(
      <DashboardView player={makePlayer({ phase: "play" })} data={makeData({ tiles })} />
    );
    expect(screen.getByTestId("bulk-distribute")).toBeInTheDocument();
  });

  it("renders BulkDistribute when phase='distribute' AND counts.unassigned > 0", () => {
    const tiles = [tile({ type: "unassigned" })];
    render(
      <DashboardView
        player={makePlayer({ phase: "distribute" })}
        data={makeData({ tiles })}
      />
    );
    expect(screen.getByTestId("bulk-distribute")).toBeInTheDocument();
  });

  it("does NOT render BulkDistribute when counts.unassigned === 0", () => {
    render(<DashboardView player={makePlayer({ phase: "play" })} data={makeData()} />);
    expect(screen.queryByTestId("bulk-distribute")).toBeNull();
  });

  it("renders BulkUnassign when phase='play' AND a non-unassigned tile exists", () => {
    const tiles = [tile({ type: "military" })];
    render(
      <DashboardView player={makePlayer({ phase: "play" })} data={makeData({ tiles })} />
    );
    expect(screen.getByTestId("bulk-unassign")).toBeInTheDocument();
  });

  it("does NOT render BulkUnassign when no assigned tiles exist", () => {
    render(<DashboardView player={makePlayer({ phase: "play" })} data={makeData()} />);
    expect(screen.queryByTestId("bulk-unassign")).toBeNull();
  });

  it("does NOT render BulkUnassign when phase !== 'play'", () => {
    const tiles = [tile({ type: "military" })];
    render(
      <DashboardView
        player={makePlayer({ phase: "distribute" })}
        data={makeData({ tiles })}
      />
    );
    expect(screen.queryByTestId("bulk-unassign")).toBeNull();
  });

  it("BulkDistribute onRun forwards to handleBulkDistribute with the unassigned filter", () => {
    const handleBulkDistribute = jest.fn();
    const tiles = [tile({ type: "unassigned" })];
    render(
      <DashboardView
        player={makePlayer({ phase: "play" })}
        data={makeData({ tiles, handleBulkDistribute })}
      />
    );
    fireEvent.click(screen.getByTestId("bulk-distribute"));
    expect(handleBulkDistribute).toHaveBeenCalledWith(
      "military",
      10,
      expect.any(Function),
      "unassigned"
    );
    // The source filter should match unassigned tiles only.
    const call = handleBulkDistribute.mock.calls[0];
    const filter = call[2] as (t: { type: string }) => boolean;
    expect(filter({ type: "unassigned" })).toBe(true);
    expect(filter({ type: "military" })).toBe(false);
  });

  it("BulkUnassign onRun forwards 'unassigned' as target and the source label", () => {
    const handleBulkDistribute = jest.fn();
    const tiles = [tile({ type: "military" })];
    render(
      <DashboardView
        player={makePlayer({ phase: "play" })}
        data={makeData({ tiles, handleBulkDistribute })}
      />
    );
    fireEvent.click(screen.getByTestId("bulk-unassign"));
    expect(handleBulkDistribute).toHaveBeenCalledWith(
      "unassigned",
      5,
      expect.any(Function),
      "military"
    );
    const filter = handleBulkDistribute.mock.calls[0][2] as (t: { type: string }) => boolean;
    expect(filter({ type: "military" })).toBe(true);
    expect(filter({ type: "food" })).toBe(false);
  });

  it("ExploreFrontier onExplore forwards exploreCount to handleFrontierExplore", () => {
    const handleFrontierExplore = jest.fn();
    render(
      <DashboardView
        player={makePlayer({ phase: "play" })}
        data={makeData({ exploreCount: 7, handleFrontierExplore })}
      />
    );
    fireEvent.click(screen.getByTestId("explore-frontier"));
    expect(handleFrontierExplore).toHaveBeenCalledWith(7);
  });

  it("FarExpedition onLaunch invokes handleFarExpedition", () => {
    const handleFarExpedition = jest.fn();
    render(
      <DashboardView
        player={makePlayer({ phase: "play" })}
        data={makeData({ handleFarExpedition })}
      />
    );
    fireEvent.click(screen.getByTestId("far-expedition"));
    expect(handleFarExpedition).toHaveBeenCalled();
  });

  it("rename start handler seeds the rename input from player.displayName and toggles renaming on", () => {
    const setRenameInput = jest.fn();
    const setRenaming = jest.fn();
    render(
      <DashboardView
        player={makePlayer({ displayName: "Tim" })}
        data={makeData({ setRenameInput, setRenaming })}
      />
    );
    fireEvent.click(screen.getByTestId("rename-start"));
    expect(setRenameInput).toHaveBeenCalledWith("Tim");
    expect(setRenaming).toHaveBeenCalledWith(true);
  });

  it("rename cancel handler turns renaming off", () => {
    const setRenaming = jest.fn();
    render(<DashboardView player={makePlayer()} data={makeData({ setRenaming })} />);
    fireEvent.click(screen.getByTestId("rename-cancel"));
    expect(setRenaming).toHaveBeenCalledWith(false);
  });

  it("rename submit calls handleSetName with trimmed input then closes the editor", async () => {
    const handleSetName = jest.fn().mockResolvedValue(undefined);
    const setRenaming = jest.fn();
    render(
      <DashboardView
        player={makePlayer({ displayName: "Old" })}
        data={makeData({ renameInput: "  New  ", handleSetName, setRenaming })}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("rename-submit"));
    });
    expect(handleSetName).toHaveBeenCalledWith("New");
    expect(setRenaming).toHaveBeenCalledWith(false);
  });

  it("rename submit is a no-op for handleSetName when the trimmed name is empty", async () => {
    const handleSetName = jest.fn().mockResolvedValue(undefined);
    const setRenaming = jest.fn();
    render(
      <DashboardView
        player={makePlayer({ displayName: "Old" })}
        data={makeData({ renameInput: "   ", handleSetName, setRenaming })}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("rename-submit"));
    });
    expect(handleSetName).not.toHaveBeenCalled();
    // Still closes the editor.
    expect(setRenaming).toHaveBeenCalledWith(false);
  });

  it("rename submit is a no-op for handleSetName when name is unchanged", async () => {
    const handleSetName = jest.fn().mockResolvedValue(undefined);
    const setRenaming = jest.fn();
    render(
      <DashboardView
        player={makePlayer({ displayName: "Same" })}
        data={makeData({ renameInput: "Same", handleSetName, setRenaming })}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("rename-submit"));
    });
    expect(handleSetName).not.toHaveBeenCalled();
    expect(setRenaming).toHaveBeenCalledWith(false);
  });

  it("forwards isAdmin into CommunityPanel", () => {
    render(
      <DashboardView player={makePlayer()} data={makeData({ isAdmin: true })} />
    );
    expect(screen.getByTestId("community-panel")).toHaveTextContent("admin:true");
  });

  it("forwards shieldStatus.shielded into ThreatCard + ShieldCard", () => {
    render(<DashboardView player={makePlayer()} data={makeData()} />);
    expect(screen.getByTestId("threat-card")).toHaveTextContent("shielded:true");
    expect(screen.getByTestId("shield-card")).toHaveTextContent("shielded:true");
  });

  it("forwards phase into NavGrid + RecommendedAction", () => {
    render(
      <DashboardView player={makePlayer({ phase: "distribute" })} data={makeData()} />
    );
    expect(screen.getByTestId("nav-grid")).toHaveTextContent("distribute");
    expect(screen.getByTestId("recommended")).toHaveTextContent("phase:distribute");
  });

  it("always renders the static panels (Onboarding, Seals, Caste, Designers, Heroes, Summonable, Reports, MiniMap)", () => {
    render(<DashboardView player={makePlayer()} data={makeData()} />);
    expect(screen.getByTestId("onboarding-wizard")).toBeInTheDocument();
    expect(screen.getByTestId("seals-panel")).toBeInTheDocument();
    expect(screen.getByTestId("caste-change")).toBeInTheDocument();
    expect(screen.getByTestId("designers")).toBeInTheDocument();
    expect(screen.getByTestId("heroes-roster")).toBeInTheDocument();
    expect(screen.getByTestId("summonable")).toBeInTheDocument();
    expect(screen.getByTestId("reports")).toBeInTheDocument();
    expect(screen.getByTestId("mini-map")).toBeInTheDocument();
  });
});
