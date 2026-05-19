/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  buildArmDefenseReport,
  buildAttackReport,
  buildBuildReport,
  buildCastSpellReport,
  buildDistributeReport,
  buildExploreReport,
  buildFlyoverReport,
  buildProduceReport,
  buildSiegeReport,
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
      supplyMultiplier: 1,
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

  describe("heroes (May 2026)", () => {
    const baseHero = {
      id: "hero-1",
      name: "Sir Test",
      class: "military" as const,
      specialty: "ground" as const,
    };

    it("stamps heroEmerged onto outcome and adds an emergence line", () => {
      const report = buildAttackReport({
        turnIndex: 100,
        cost: 1,
        targetTileId: "5_-2",
        unitsSent: sent,
        combat: makeCombat("captured"),
        artifactFound: null,
        rng: makeSeededRng("atk:hero-emerge"),
        heroEmerged: {
          id: "hero-2",
          ownerId: "user-a",
          tileId: "5_-2",
          class: "military",
          specialty: "raid",
          name: "Dame Raid",
          caste: "white",
          stamina: 100,
          staminaMax: 100,
          emergedAtTurn: 100,
          lastEngagedAtTurn: 100,
        },
      });
      const outcome = report.outcome as { heroEmerged?: { name: string } };
      expect(outcome.heroEmerged?.name).toBe("Dame Raid");
      expect(report.narrative.some((l) => l.includes("Dame Raid"))).toBe(true);
    });

    it("spare action changes the summary to 'Wore down hero'", () => {
      const report = buildAttackReport({
        turnIndex: 100,
        cost: 1,
        targetTileId: "5_-2",
        unitsSent: sent,
        combat: makeCombat("captured"),
        artifactFound: null,
        rng: makeSeededRng("atk:hero-spare"),
        heroAction: "spare",
      });
      expect(report.summary).toContain("Wore down");
      const outcome = report.outcome as { heroAction?: string };
      expect(outcome.heroAction).toBe("spare");
    });

    it("heroDefected swaps the summary + narrative to mention defection", () => {
      const report = buildAttackReport({
        turnIndex: 100,
        cost: 1,
        targetTileId: "5_-2",
        unitsSent: sent,
        combat: makeCombat("captured"),
        artifactFound: null,
        rng: makeSeededRng("atk:hero-defect"),
        heroAction: "convert",
        heroDefected: baseHero,
      });
      expect(report.summary).toContain("Hero defected");
      expect(
        report.narrative.some((l) => l.includes("defected"))
      ).toBe(true);
    });

    it("heroSlain adds a narrative line about the kill", () => {
      const report = buildAttackReport({
        turnIndex: 100,
        cost: 1,
        targetTileId: "5_-2",
        unitsSent: sent,
        combat: makeCombat("captured"),
        artifactFound: null,
        rng: makeSeededRng("atk:hero-slain"),
        heroAction: "kill",
        heroSlain: baseHero,
      });
      expect(
        report.narrative.some((l) => l.includes("fell with the tile"))
      ).toBe(true);
      const outcome = report.outcome as { heroSlain?: { name: string } };
      expect(outcome.heroSlain?.name).toBe("Sir Test");
    });
  });
});

describe("buildSiegeReport", () => {
  it("includes the targetTileId and magnitude percentage in the summary", () => {
    const report = buildSiegeReport({
      turnIndex: 30,
      cost: 1,
      targetTileId: "7_-3",
      magnitudeApplied: 0.25,
      totalMagnitudeAfter: 0.5,
      rng: makeSeededRng("siege:1"),
    });
    expect(report.action).toBe("siege");
    expect(report.cost).toBe(1);
    expect(report.summary).toContain("7_-3");
    expect(report.summary).toContain("25%");
    expect(report.narrative).toHaveLength(1);
    expect(report.outcome).toEqual({
      targetTileId: "7_-3",
      magnitudeApplied: 0.25,
      totalMagnitudeAfter: 0.5,
    });
  });
});

describe("buildCastSpellReport", () => {
  it("siege variant: stamps magnitude in summary and outcome.siege", () => {
    const report = buildCastSpellReport({
      turnIndex: 5,
      cost: 1,
      spellId: "spell-1",
      spellName: "Siege Hex",
      spellType: "siege",
      targetTileId: "1_0",
      siege: { magnitudeApplied: 0.3, totalMagnitudeAfter: 0.6 },
      rng: makeSeededRng("cast:siege"),
    });
    expect(report.action).toBe("spell-cast");
    expect(report.summary).toContain("Siege Hex");
    expect(report.summary).toContain("1_0");
    expect(report.summary).toContain("30%");
    const outcome = report.outcome as Record<string, unknown>;
    expect(outcome.spellType).toBe("siege");
    expect(outcome.siege).toEqual({ magnitudeApplied: 0.3, totalMagnitudeAfter: 0.6 });
  });

  it("siege variant: defaults magnitude to 0 when payload missing", () => {
    const report = buildCastSpellReport({
      turnIndex: 5,
      cost: 1,
      spellId: "spell-1",
      spellName: "Siege Hex",
      spellType: "siege",
      targetTileId: "1_0",
      // No siege payload
      rng: makeSeededRng("cast:siege:miss"),
    });
    expect(report.summary).toContain("0%");
  });

  it("disarm variant: stamps fraction in summary and outcome.disarm", () => {
    const report = buildCastSpellReport({
      turnIndex: 5,
      cost: 1,
      spellId: "spell-2",
      spellName: "Wardbreak",
      spellType: "disarm",
      targetTileId: "2_0",
      disarm: { fractionApplied: 0.4 },
      rng: makeSeededRng("cast:disarm"),
    });
    expect(report.summary).toContain("Wardbreak");
    expect(report.summary).toContain("40%");
    expect(report.summary).toContain("disarm");
    const outcome = report.outcome as Record<string, unknown>;
    expect(outcome.spellType).toBe("disarm");
    expect(outcome.disarm).toEqual({ fractionApplied: 0.4 });
  });

  it("disarm variant: defaults fraction to 0 when payload missing", () => {
    const report = buildCastSpellReport({
      turnIndex: 5,
      cost: 1,
      spellId: "spell-2",
      spellName: "Wardbreak",
      spellType: "disarm",
      targetTileId: "2_0",
      rng: makeSeededRng("cast:disarm:miss"),
    });
    expect(report.summary).toContain("0%");
  });

  it("attrition variant: sums unitsKilled and stamps outcome.attrition", () => {
    const report = buildCastSpellReport({
      turnIndex: 5,
      cost: 1,
      spellId: "spell-3",
      spellName: "Plague Veil",
      spellType: "attrition",
      targetTileId: "3_0",
      attrition: { unitsKilled: { ground: 5, siege: 2, air: 1 } },
      rng: makeSeededRng("cast:attr"),
    });
    expect(report.summary).toContain("Plague Veil");
    expect(report.summary).toContain("8"); // 5 + 2 + 1
    expect(report.summary).toContain("defenders lost");
    const outcome = report.outcome as Record<string, unknown>;
    expect(outcome.spellType).toBe("attrition");
  });

  it("attrition variant: defaults total to 0 when payload missing", () => {
    const report = buildCastSpellReport({
      turnIndex: 5,
      cost: 1,
      spellId: "spell-3",
      spellName: "Plague Veil",
      spellType: "attrition",
      targetTileId: "3_0",
      rng: makeSeededRng("cast:attr:miss"),
    });
    expect(report.summary).toContain("0 defenders");
  });

  it("attaches heroEmerged when provided", () => {
    const report = buildCastSpellReport({
      turnIndex: 5,
      cost: 1,
      spellId: "spell-1",
      spellName: "Siege Hex",
      spellType: "siege",
      targetTileId: "1_0",
      siege: { magnitudeApplied: 0.3, totalMagnitudeAfter: 0.6 },
      rng: makeSeededRng("cast:hero"),
      heroEmerged: {
        id: "hero-9",
        name: "Spell Caster",
        class: "magical" as never,
        specialty: "ground" as never,
      } as never,
    });
    const outcome = report.outcome as Record<string, unknown>;
    expect(outcome.heroEmerged).toBeDefined();
  });
});

describe("buildFlyoverReport", () => {
  const flyoverCombat: CombatResult = {
    outcome: "repelled",
    unitsDeployed: { ground: 0, siege: 0, air: 20 },
    unitsClampedFromCapacity: 0,
    attackPower: 150,
    defensePower: 100,
    attackerLosses: { ground: 0, siege: 0, air: 6 },
    defenderLosses: { ground: 4, siege: 0, air: 0 },
    underdogApplied: false,
    supplyMultiplier: 1,
    rng: { attackerRoll: 1, defenderRoll: 1 },
    appliedSpells: { offenseId: null, defenseId: null },
  };

  it("returns a flyover report with both narrative lines and full outcome shape", () => {
    const sent: UnitStack = { ground: 0, siege: 0, air: 20 };
    const report = buildFlyoverReport({
      turnIndex: 22,
      cost: 1,
      targetTileId: "4_5",
      unitsSent: sent,
      combat: flyoverCombat,
      artifactFound: null,
      rng: makeSeededRng("fly:1"),
    });
    expect(report.action).toBe("flyover");
    expect(report.cost).toBe(1);
    expect(report.summary).toContain("Flyover");
    expect(report.summary).toContain("4_5");
    expect(report.narrative).toHaveLength(2);
    // Second narrative line documents the 2× penalty
    expect(report.narrative[1]).toContain("2×");
    const outcome = report.outcome as Record<string, unknown>;
    expect(outcome.result).toBe("repelled");
    expect(outcome.attackPower).toBe(150);
    expect(outcome.defensePower).toBe(100);
  });

  it("attaches artifact when one is found on the tile", () => {
    const artifact = ALL_ARTIFACTS[0];
    const sent: UnitStack = { ground: 0, siege: 0, air: 10 };
    const report = buildFlyoverReport({
      turnIndex: 22,
      cost: 1,
      targetTileId: "4_5",
      unitsSent: sent,
      combat: flyoverCombat,
      artifactFound: artifact,
      rng: makeSeededRng("fly:art"),
    });
    expect(report.artifactFound).toBeDefined();
    expect(report.artifactFound?.definitionId).toBe(artifact.id);
  });
});
