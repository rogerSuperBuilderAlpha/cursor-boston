/**
 * @jest-environment node
 */
import {
  ARMAGEDDON_TILE_GATE,
  ARMAGEDDON_TURN_COST,
  BASE_SUCCESS,
  SEAL_COUNT,
  SUCCESS_HARD_CAP,
  TOP_BY_TILES_SNAPSHOT_COUNT,
  WINNER_COUNT,
  computeArmageddonSuccessChanceFromMultiplier,
  computeLotteryTickets,
} from "@/lib/game/content/armageddon";

describe("game/content/armageddon", () => {
  describe("constants", () => {
    it("ARMAGEDDON_TILE_GATE = 10,000 (unlock gate)", () => {
      expect(ARMAGEDDON_TILE_GATE).toBe(10_000);
    });

    it("ARMAGEDDON_TURN_COST = 100 (per cast)", () => {
      expect(ARMAGEDDON_TURN_COST).toBe(100);
    });

    it("BASE_SUCCESS, SUCCESS_HARD_CAP form a sensible probability range", () => {
      expect(BASE_SUCCESS).toBeGreaterThan(0);
      expect(BASE_SUCCESS).toBeLessThan(1);
      expect(SUCCESS_HARD_CAP).toBeGreaterThan(BASE_SUCCESS);
      expect(SUCCESS_HARD_CAP).toBeLessThanOrEqual(1);
    });

    it("SEAL_COUNT = 7 (biblical), WINNER_COUNT = 10, SNAPSHOT = 50", () => {
      expect(SEAL_COUNT).toBe(7);
      expect(WINNER_COUNT).toBe(10);
      expect(TOP_BY_TILES_SNAPSHOT_COUNT).toBe(50);
    });
  });

  describe("computeArmageddonSuccessChanceFromMultiplier", () => {
    it("returns BASE_SUCCESS when multiplier = 1", () => {
      expect(computeArmageddonSuccessChanceFromMultiplier(1)).toBe(BASE_SUCCESS);
    });

    it("scales linearly with multiplier below the hard cap", () => {
      expect(computeArmageddonSuccessChanceFromMultiplier(2)).toBeCloseTo(BASE_SUCCESS * 2, 10);
      expect(computeArmageddonSuccessChanceFromMultiplier(3)).toBeCloseTo(BASE_SUCCESS * 3, 10);
    });

    it("clamps at SUCCESS_HARD_CAP for very large multipliers", () => {
      expect(computeArmageddonSuccessChanceFromMultiplier(1000)).toBe(SUCCESS_HARD_CAP);
    });

    it("returns 0 when multiplier is 0", () => {
      expect(computeArmageddonSuccessChanceFromMultiplier(0)).toBe(0);
    });
  });

  describe("computeLotteryTickets", () => {
    it("returns 0 when tilesHeld is 0 or negative", () => {
      expect(computeLotteryTickets(0, 5)).toBe(0);
      expect(computeLotteryTickets(-10, 5)).toBe(0);
    });

    it("returns tilesHeld with no seals broken (multiplier = 1)", () => {
      expect(computeLotteryTickets(1000, 0)).toBe(1000);
    });

    it("scales by (1 + sealsBroken)", () => {
      expect(computeLotteryTickets(1000, 1)).toBe(2000);
      expect(computeLotteryTickets(1000, 3)).toBe(4000);
      expect(computeLotteryTickets(1000, 6)).toBe(7000);
    });

    it("treats negative sealsBroken as 0 (defensive)", () => {
      expect(computeLotteryTickets(1000, -1)).toBe(1000);
    });
  });
});
