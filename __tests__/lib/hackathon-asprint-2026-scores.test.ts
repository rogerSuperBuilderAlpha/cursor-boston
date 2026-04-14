/**
 * @jest-environment node
 */

import {
  computeAiRanksBySubmissionId,
  computeHackASprint2026RawScore,
} from "@/lib/hackathon-asprint-2026-scores";

describe("computeHackASprint2026RawScore", () => {
  it("returns null when nothing present", () => {
    expect(computeHackASprint2026RawScore(undefined, {})).toBe(null);
  });

  it("ceil average of judges and ai when both present", () => {
    expect(
      computeHackASprint2026RawScore(8, { a: 8, b: 10 })
    ).toBe(Math.ceil((9 + 8) / 2));
  });

  it("ceil judge average alone", () => {
    expect(computeHackASprint2026RawScore(null, { x: 7, y: 9 })).toBe(8);
  });

  it("ceil ai alone", () => {
    expect(computeHackASprint2026RawScore(7, {})).toBe(7);
  });
});

describe("computeAiRanksBySubmissionId", () => {
  it("returns empty map when no scores", () => {
    const m = new Map();
    m.set("a", null);
    m.set("b", null);
    expect(computeAiRanksBySubmissionId(["a", "b"], m).size).toBe(0);
  });

  it("ranks by score descending with ties sharing rank", () => {
    const ids = ["low", "mid", "hi", "tie"];
    const m = new Map();
    m.set("low", 3);
    m.set("mid", 6);
    m.set("hi", 10);
    m.set("tie", 10);
    const ranks = computeAiRanksBySubmissionId(ids, m);
    expect(ranks.get("hi")).toBe(1);
    expect(ranks.get("tie")).toBe(1);
    expect(ranks.get("mid")).toBe(3);
    expect(ranks.get("low")).toBe(4);
  });
});
