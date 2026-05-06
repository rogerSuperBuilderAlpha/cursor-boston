/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { buildExploreReport } from "@/lib/game/turn-report";
import { makeSeededRng } from "@/lib/game/combat";
import { ALL_ARTIFACTS } from "@/lib/game/content/artifacts";
import { EXPLORE_NARRATIVES } from "@/lib/game/content/narratives";

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
