/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { parseBatchCount, runBatch } from "@/lib/game/api-batch";
import type { TurnReport } from "@/lib/game/types";

function fakeReport(idx: number): TurnReport {
  return {
    turnIndex: idx,
    action: "explore",
    cost: 1,
    summary: `step ${idx}`,
    narrative: [],
    outcome: {},
  };
}

describe("parseBatchCount", () => {
  it("returns 1 for undefined / null / non-numeric", () => {
    expect(parseBatchCount(undefined)).toBe(1);
    expect(parseBatchCount(null)).toBe(1);
    expect(parseBatchCount("abc")).toBe(1);
    expect(parseBatchCount(NaN)).toBe(1);
  });

  it("clamps to [1, max]", () => {
    expect(parseBatchCount(0)).toBe(1);
    expect(parseBatchCount(-5)).toBe(1);
    expect(parseBatchCount(150)).toBe(100);
    expect(parseBatchCount(150, 50)).toBe(50);
  });

  it("floors fractional inputs", () => {
    expect(parseBatchCount(3.7)).toBe(3);
    expect(parseBatchCount("5.4")).toBe(5);
  });

  it("passes through valid in-range values", () => {
    expect(parseBatchCount(1)).toBe(1);
    expect(parseBatchCount(50)).toBe(50);
    expect(parseBatchCount(100)).toBe(100);
  });
});

describe("runBatch", () => {
  it("runs the step `count` times and accumulates reports", async () => {
    let i = 0;
    const out = await runBatch(5, async () => ({
      report: fakeReport(i),
      result: i++,
    }));
    expect(out.reports).toHaveLength(5);
    expect(out.lastResult.result).toBe(4);
    expect(out.stoppedEarly).toBeUndefined();
  });

  it("propagates first-call failures (no stoppedEarly)", async () => {
    const err = new Error("boom");
    await expect(
      runBatch(5, async () => {
        throw err;
      })
    ).rejects.toBe(err);
  });

  it("stops cleanly after first success on subsequent failure", async () => {
    let i = 0;
    const out = await runBatch(5, async () => {
      if (i === 2) throw new Error("out of turns");
      const idx = i;
      i++;
      return { report: fakeReport(idx), result: idx };
    });
    expect(out.reports).toHaveLength(2);
    expect(out.lastResult.result).toBe(1);
    expect(out.stoppedEarly).toBe("out of turns");
  });

  it("count=1 runs exactly once", async () => {
    let calls = 0;
    const out = await runBatch(1, async () => {
      calls++;
      return { report: fakeReport(0), result: "only" };
    });
    expect(calls).toBe(1);
    expect(out.reports).toHaveLength(1);
    expect(out.lastResult.result).toBe("only");
  });
});
