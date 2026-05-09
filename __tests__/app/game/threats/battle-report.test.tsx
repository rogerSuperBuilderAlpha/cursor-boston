/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { BattleReport } from "@/app/game/threats/_components/BattleReport";
import type {
  CombatResult,
  GameTile,
  TurnReport,
  UnitStack,
} from "@/lib/game/types";

// jsdom helpers ------------------------------------------------------------

function stack(g: number, s: number, a: number): UnitStack {
  return { ground: g, siege: s, air: a };
}

function makeCombat(over: Partial<CombatResult> = {}): CombatResult {
  return {
    outcome: "captured",
    unitsDeployed: stack(10, 5, 0),
    unitsClampedFromCapacity: 0,
    attackPower: 320,
    defensePower: 180,
    attackerLosses: stack(3, 1, 0),
    defenderLosses: stack(40, 15, 15),
    underdogApplied: false,
    supplyMultiplier: 1,
    rng: { attackerRoll: 1.05, defenderRoll: 0.94 },
    appliedSpells: { offenseId: null, defenseId: null },
    ...over,
  };
}

function makeReport(over: Partial<TurnReport> = {}): TurnReport {
  return {
    turnIndex: 12,
    action: "attack",
    cost: 1,
    summary: "Captured -149_47",
    narrative: [
      "The captains rallied at dusk.",
      "Sent G10 S5 A0 (15 total). Lost G3 S1 A0; defenders lost G40 S15 A15.",
    ],
    outcome: { targetTileId: "-149_47" },
    ...over,
  };
}

function makeTargetTile(units: UnitStack = stack(10, 5, 5)): GameTile {
  return {
    tileId: "-149_47",
    q: -149,
    r: 47,
    type: "military",
    ownerId: "foe",
    units,
    armedDefenseSpellId: null,
    capacity: 200,
    level: 1,
    upgradeIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as GameTile;
}

// tests --------------------------------------------------------------------

describe("BattleReport", () => {
  it("renders the Captured banner with target tile id and turn cost", () => {
    render(
      <BattleReport
        combat={makeCombat()}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Captured -149_47/i)).toBeInTheDocument();
    expect(screen.getByText(/1 turn spent/i)).toBeInTheDocument();
  });

  it("renders the Repelled banner for repelled outcomes", () => {
    render(
      <BattleReport
        combat={makeCombat({ outcome: "repelled" })}
        report={makeReport({ summary: "Repelled at -149_47" })}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Repelled at -149_47/i)).toBeInTheDocument();
  });

  it("renders the Stalemate banner for stalemate outcomes", () => {
    render(
      <BattleReport
        combat={makeCombat({ outcome: "stalemate" })}
        report={makeReport({ summary: "Stalemate at -149_47", cost: 6 })}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Stalemate at -149_47/i)).toBeInTheDocument();
    expect(screen.getByText(/6 turns spent/i)).toBeInTheDocument();
  });

  it("derives Defender-had from targetTile.units + losses for non-captured outcomes", () => {
    // Repelled / stalemate: targetTile.units is the defender's surviving
    // garrison after the swing, so pre-attack = surviving + lost.
    render(
      <BattleReport
        combat={makeCombat({ outcome: "repelled" })}
        report={makeReport({ summary: "Repelled at -149_47" })}
        targetTile={makeTargetTile(stack(10, 5, 5))}
        onDismiss={jest.fn()}
      />
    );
    // 10+40, 5+15, 5+15 = 50/20/20 (90 total).
    expect(screen.getByText(/G50 · S20 · A20/)).toBeInTheDocument();
    expect(screen.getByText(/\(90 total\)/)).toBeInTheDocument();
  });

  it("derives Defender-had from defenderLosses alone for captured outcomes", () => {
    // After a capture, targetTile.units holds the attacker's survivors
    // (the captured tile is now ours). The combat result records
    // defenderLosses = the defender's full pre-attack stack on capture,
    // so the wizard reads from there directly.
    render(
      <BattleReport
        combat={makeCombat({ outcome: "captured" })}
        report={makeReport()}
        // Attacker survivors live on the captured tile post-swing.
        targetTile={makeTargetTile(stack(7, 4, 0))}
        onDismiss={jest.fn()}
      />
    );
    // 40/15/15 → 70 total. NOT 47/19/15.
    // The same value renders twice in this case — once as "Defender had"
    // and once as "Defender lost" — since on a capture the defender
    // loses everything they had.
    expect(screen.getAllByText(/G40 · S15 · A15/).length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByText(/\(70 total\)/)).toBeInTheDocument();
  });

  it("renders You-sent stack from combat.unitsDeployed", () => {
    render(
      <BattleReport
        combat={makeCombat({ unitsDeployed: stack(7, 0, 8) })}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/G7 · S0 · A8/)).toBeInTheDocument();
    // The narrative line in makeReport() also contains "(15 total)" — both
    // the Forces section and the prose hit the matcher, so just assert at
    // least one occurrence.
    expect(screen.getAllByText(/\(15 total\)/).length).toBeGreaterThanOrEqual(
      1
    );
  });

  it("renders losses for both sides per unit type", () => {
    // Use a repelled outcome so the "Defender had" line is distinct from
    // the "Defender lost" line; with `captured` they'd render the same
    // stack (defender lost everything they had).
    render(
      <BattleReport
        combat={makeCombat({
          outcome: "repelled",
          attackerLosses: stack(3, 1, 0),
          defenderLosses: stack(40, 15, 15),
        })}
        report={makeReport({ summary: "Repelled at -149_47" })}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/G3 · S1 · A0/)).toBeInTheDocument();
    expect(screen.getByText(/G40 · S15 · A15/)).toBeInTheDocument();
    // Totals: attacker 4, defender 70
    expect(screen.getByText("(4)")).toBeInTheDocument();
    expect(screen.getByText("(70)")).toBeInTheDocument();
  });

  it("emits the underdog modifier line only when applied", () => {
    const { rerender } = render(
      <BattleReport
        combat={makeCombat({ underdogApplied: false })}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.queryByText(/Underdog bonus active/i)).not.toBeInTheDocument();

    rerender(
      <BattleReport
        combat={makeCombat({ underdogApplied: true })}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Underdog bonus active/i)).toBeInTheDocument();
  });

  it("emits supply mult line only when supplyMultiplier !== 1", () => {
    const { rerender } = render(
      <BattleReport
        combat={makeCombat({ supplyMultiplier: 1 })}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.queryByText(/Defender supply/i)).not.toBeInTheDocument();

    rerender(
      <BattleReport
        combat={makeCombat({ supplyMultiplier: 1.15 })}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Defender supply · ×1\.15/)).toBeInTheDocument();
  });

  it("renders applied offense + defense spell names when available", () => {
    render(
      <BattleReport
        combat={makeCombat({
          appliedSpells: {
            offenseId: "red-fire-1",
            defenseId: "blue-shield-1",
          },
        })}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    // We don't know exact spell names without looking them up; just assert
    // that BOTH offense + defense lines render with their tier markers.
    expect(screen.getByText(/Offense spell ·/)).toBeInTheDocument();
    expect(screen.getByText(/Defense spell triggered ·/)).toBeInTheDocument();
  });

  it("renders airIntel weakFace + defenseSpellTier modifier lines", () => {
    render(
      <BattleReport
        combat={makeCombat({
          airIntel: {
            sourcePassive: "red-forge-scouts",
            weakFace: "siege",
            defenseSpellTier: 3,
          },
        })}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Forge Sight · led with siege/)).toBeInTheDocument();
    expect(
      screen.getByText(/Hawks Eye · revealed defense-spell tier 3/)
    ).toBeInTheDocument();
  });

  it("renders capacity-clamped line only when units were dropped", () => {
    const { rerender } = render(
      <BattleReport
        combat={makeCombat({ unitsClampedFromCapacity: 0 })}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.queryByText(/Capacity dropped/)).not.toBeInTheDocument();
    rerender(
      <BattleReport
        combat={makeCombat({ unitsClampedFromCapacity: 7 })}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Capacity dropped 7 pre-combat/)).toBeInTheDocument();
  });

  it("always renders RNG and power lines", () => {
    render(
      <BattleReport
        combat={makeCombat()}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(
      screen.getByText(/RNG · attacker 1\.05× \/ defender 0\.94×/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Power · attack 320 vs defense 180/)
    ).toBeInTheDocument();
  });

  it("renders the joined narrative text", () => {
    render(
      <BattleReport
        combat={makeCombat()}
        report={makeReport({
          narrative: ["Line A", "Line B"],
        })}
        targetTile={makeTargetTile()}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Line A Line B/)).toBeInTheDocument();
  });

  it("dismisses via the close button", () => {
    const onDismiss = jest.fn();
    render(
      <BattleReport
        combat={makeCombat()}
        report={makeReport()}
        targetTile={makeTargetTile()}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
