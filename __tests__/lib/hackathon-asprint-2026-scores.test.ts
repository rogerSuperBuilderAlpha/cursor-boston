/**
 * @jest-environment node
 */

import { computeHackASprint2026RawScore } from "@/lib/hackathon-asprint-2026-scores";

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
