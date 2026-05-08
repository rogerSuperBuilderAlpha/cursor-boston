/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { buildThreatPriorityPlan } from "@/app/game/recruit/_lib/threat-priority-plan";

describe("buildThreatPriorityPlan", () => {
  it("returns empty for empty input", () => {
    expect(buildThreatPriorityPlan([], 10)).toEqual([]);
  });

  it("returns empty for zero or negative cycles", () => {
    expect(buildThreatPriorityPlan(["a", "b"], 0)).toEqual([]);
    expect(buildThreatPriorityPlan(["a", "b"], -3)).toEqual([]);
  });

  it("routes everything to the only tile when N=1", () => {
    expect(buildThreatPriorityPlan(["a"], 7)).toEqual([
      { tileId: "a", cycles: 7 },
    ]);
  });

  it("conserves the total cycle count", () => {
    const out = buildThreatPriorityPlan(["a", "b", "c", "d"], 20);
    const sum = out.reduce((s, p) => s + p.cycles, 0);
    expect(sum).toBe(20);
  });

  it("front-loads to the most-threatened tile (linear weights)", () => {
    // With N=3, weights are [3,2,1] (sum 6). 12 cycles → [6,4,2].
    const out = buildThreatPriorityPlan(["top", "mid", "bot"], 12);
    expect(out).toEqual([
      { tileId: "top", cycles: 6 },
      { tileId: "mid", cycles: 4 },
      { tileId: "bot", cycles: 2 },
    ]);
  });

  it("filters out zero-cycle entries", () => {
    // 1 cycle across 3 tiles — only the top gets it.
    const out = buildThreatPriorityPlan(["top", "mid", "bot"], 1);
    expect(out).toEqual([{ tileId: "top", cycles: 1 }]);
  });

  it("assigns remainder cycles top-down when uneven", () => {
    // 5 cycles, N=3 weights [3,2,1] sum 6.
    // base: floor(5*3/6)=2, floor(5*2/6)=1, floor(5*1/6)=0 = 3 assigned.
    // 2 leftover → tiles[0]=3, tiles[1]=2.
    const out = buildThreatPriorityPlan(["top", "mid", "bot"], 5);
    expect(out).toEqual([
      { tileId: "top", cycles: 3 },
      { tileId: "mid", cycles: 2 },
    ]);
  });

  it("never gives a non-top tile more cycles than the top", () => {
    for (const total of [3, 7, 13, 50]) {
      const out = buildThreatPriorityPlan(["a", "b", "c", "d"], total);
      const topCycles =
        out.find((p) => p.tileId === "a")?.cycles ?? 0;
      for (const p of out) expect(p.cycles).toBeLessThanOrEqual(topCycles);
    }
  });
});
