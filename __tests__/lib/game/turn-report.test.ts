/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  buildArmDefenseReport,
  buildAttackReport,
  buildBuildReport,
  buildDistributeReport,
  buildExploreReport,
  buildProduceReport,
} from "@/lib/game/turn-report";
import { makeSeededRng } from "@/lib/game/combat";
import { ALL_ARTIFACTS } from "@/lib/game/content/artifacts";
import {
  ATTACK_CAPTURED_CLOSERS,
  ATTACK_MIDDLES,
  ATTACK_OPENINGS,
  BUILD_NARRATIVES,
  DISTRIBUTE_NARRATIVES,
  EXPLORE_NARRATIVES,
  SPELL_ARM_NARRATIVES,
  SPELL_PRODUCE_NARRATIVES,
} from "@/lib/game/content/narratives";
import type { CombatResult, UnitStack } from "@/lib/game/types";

describe("buildExploreReport", () => {
  const tile = { tileId: "3_-2", type: "unassigned" as const };

  it("produces a non-empty narrative line from the explore content", () => {
    const report = buildExploreReport(7, tile, null, makeSeededRng("seed:a"));
    expect(report.action).toBe("explore");
    expect(report.cost).toBe(1);
    expect(report.turnIndex).toBe(7);
    expect(report.narrative).toHaveLength(1);
    expect(EXPLORE_NARRATIVES).toContain(report.narrative[0]);
    expect(report.summary).toContain(tile.tileId);
    expect(report.outcome).toEqual({ tileId: tile.tileId, tileType: tile.type });
    expect(report.artifactFound).toBeUndefined();
  });

  it("appends the artifact flavor when one was found", () => {
    const artifact = ALL_ARTIFACTS[0];
    const report = buildExploreReport(
      12,
      tile,
      artifact,
      makeSeededRng("seed:b")
    );
    expect(report.narrative).toHaveLength(2);
    expect(report.narrative[1]).toBe(artifact.flavorOnFind);
    expect(report.summary).toContain(artifact.name);
    expect(report.artifactFound).toEqual({
      definitionId: artifact.id,
      name: artifact.name,
      rarity: artifact.rarity,
      type: artifact.type,
    });
  });

  it("is deterministic for the same seed", () => {
    const a = buildExploreReport(3, tile, null, makeSeededRng("same-seed"));
    const b = buildExploreReport(3, tile, null, makeSeededRng("same-seed"));
    expect(a).toEqual(b);
  });

  it("produces different narratives for different seeds (over many trials)", () => {
    const lines = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const r = buildExploreReport(i, tile, null, makeSeededRng(`vary:${i}`));
      lines.add(r.narrative[0]);
    }
    // With 60 lines and 50 trials, we expect substantial variety.
    expect(lines.size).toBeGreaterThan(10);
  });
});

describe("buildBuildReport", () => {
  it("includes unit type and count in the summary and outcome", () => {
    const report = buildBuildReport({
      turnIndex: 42,
      cost: 5,
      tileId: "1_2",
      unitType: "ground",
      unitsBuilt: 10,
      artifactFound: null,
      rng: makeSeededRng("build:test"),
    });
    expect(report.action).toBe("build");
    expect(report.cost).toBe(5);
    expect(report.summary).toContain("10");
    expect(report.summary).toContain("ground");
    expect(report.summary).toContain("1_2");
    expect(BUILD_NARRATIVES).toContain(report.narrative[0]);
    expect(report.outcome).toEqual({
      tileId: "1_2",
      unitType: "ground",
      unitsBuilt: 10,
    });
  });
});

describe("buildDistributeReport", () => {
  it("emits the new type in the summary and outcome", () => {
    const report = buildDistributeReport({
      turnIndex: 10,
      tileId: "0_3",
      newType: "military",
      artifactFound: null,
      rng: makeSeededRng("dist:test"),
    });
    expect(report.action).toBe("distribute");
    expect(report.cost).toBe(1);
    expect(report.summary).toContain("military");
    expect(DISTRIBUTE_NARRATIVES).toContain(report.narrative[0]);
  });
});

describe("buildArmDefenseReport", () => {
  it("includes spell name and tile in the summary", () => {
    const report = buildArmDefenseReport({
      turnIndex: 15,
      cost: 5,
      tileId: "2_1",
      spellId: "white-defense-aegis",
      spellName: "Aegis",
      artifactFound: null,
      rng: makeSeededRng("arm:test"),
    });
    expect(report.action).toBe("spell-arm");
    expect(report.summary).toContain("Aegis");
    expect(report.summary).toContain("2_1");
    expect(SPELL_ARM_NARRATIVES).toContain(report.narrative[0]);
  });
});

describe("buildProduceReport", () => {
  it("includes spell name and expiry in the summary", () => {
    const report = buildProduceReport({
      turnIndex: 20,
      cost: 5,
      spellId: "blue-production-foresight",
      spellName: "Foresight",
      expiresAtTurn: 120,
      artifactFound: null,
      rng: makeSeededRng("produce:test"),
    });
    expect(report.action).toBe("spell-produce");
    expect(report.summary).toContain("Foresight");
    expect(report.summary).toContain("120");
    expect(SPELL_PRODUCE_NARRATIVES).toContain(report.narrative[0]);
  });
});

describe("buildAttackReport", () => {
  function makeCombat(outcome: "captured" | "repelled" | "stalemate"): CombatResult {
    return {
      outcome,
      unitsDeployed: { ground: 50, siege: 0, air: 0 },
      unitsClampedFromCapacity: 0,
      attackPower: 600,
      defensePower: 400,
      attackerLosses: { ground: 23, siege: 0, air: 0 },
      defenderLosses: { ground: 41, siege: 0, air: 0 },
      underdogApplied: false,
      rng: { attackerRoll: 1, defenderRoll: 1 },
      appliedSpells: { offenseId: null, defenseId: null },
    };
  }

  const sent: UnitStack = { ground: 50, siege: 0, air: 0 };

  it("captured outcome uses a captured-closer fragment", () => {
    const report = buildAttackReport({
      turnIndex: 100,
      cost: 1,
      targetTileId: "5_-2",
      unitsSent: sent,
      combat: makeCombat("captured"),
      artifactFound: null,
      rng: makeSeededRng("atk:cap"),
    });
    expect(report.action).toBe("attack");
    expect(report.summary).toContain("Captured");
    expect(report.outcome.result).toBe("captured");
    // First narrative line stitches opening + middle + a captured closer.
    const line = report.narrative[0];
    const hasOpening = ATTACK_OPENINGS.some((o) => line.includes(o));
    const hasMiddle = ATTACK_MIDDLES.some((m) => line.includes(m));
    const hasCapturedCloser = ATTACK_CAPTURED_CLOSERS.some((c) =>
      line.includes(c)
    );
    expect(hasOpening).toBe(true);
    expect(hasMiddle).toBe(true);
    expect(hasCapturedCloser).toBe(true);
  });

  it("repelled outcome marks the report accordingly", () => {
    const report = buildAttackReport({
      turnIndex: 100,
      cost: 1,
      targetTileId: "5_-2",
      unitsSent: sent,
      combat: makeCombat("repelled"),
      artifactFound: null,
      rng: makeSeededRng("atk:rep"),
    });
    expect(report.summary).toContain("Repelled");
    expect(report.outcome.result).toBe("repelled");
  });

  it("includes casualty totals in the second narrative line", () => {
    const report = buildAttackReport({
      turnIndex: 100,
      cost: 1,
      targetTileId: "5_-2",
      unitsSent: sent,
      combat: makeCombat("captured"),
      artifactFound: null,
      rng: makeSeededRng("atk:cas"),
    });
    expect(report.narrative.length).toBeGreaterThanOrEqual(2);
    expect(report.narrative[1]).toContain("23");
    expect(report.narrative[1]).toContain("41");
  });

  it("attaches artifact when one is found", () => {
    const artifact = ALL_ARTIFACTS[0];
    const report = buildAttackReport({
      turnIndex: 100,
      cost: 1,
      targetTileId: "5_-2",
      unitsSent: sent,
      combat: makeCombat("captured"),
      artifactFound: artifact,
      rng: makeSeededRng("atk:art"),
    });
    expect(report.artifactFound).toBeDefined();
    expect(report.artifactFound?.definitionId).toBe(artifact.id);
  });
});
