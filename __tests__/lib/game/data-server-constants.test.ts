/**
 * @jest-environment node
 *
 * Wave 1a chunk 1 of the Silver coverage backlog — pure constants + the
 * one pure helper in lib/game/data-server.ts:184-360.
 *
 * Covered exports: ATTACK_TURN_COST, SPELL_TURN_COST, BUILD_UNITS_TURN_COST,
 * SIEGE_TURN_COST, FAR_EXPEDITION_TURN_COST, BUILD_UNITS_PER_TURN,
 * BUILD_UNITS_PER_TURN_BY_LAND, unitsPerTurnForLand.
 */
import {
  ATTACK_TURN_COST,
  BUILD_UNITS_PER_TURN,
  BUILD_UNITS_PER_TURN_BY_LAND,
  BUILD_UNITS_TURN_COST,
  FAR_EXPEDITION_TURN_COST,
  SIEGE_TURN_COST,
  SPELL_TURN_COST,
  unitsPerTurnForLand,
} from "@/lib/game/data-server";

describe("lib/game/data-server — turn-cost constants", () => {
  it("ATTACK_TURN_COST = 1 (attacks are cheap, one per turn)", () => {
    expect(ATTACK_TURN_COST).toBe(1);
  });

  it("SPELL_TURN_COST = 5", () => {
    expect(SPELL_TURN_COST).toBe(5);
  });

  it("BUILD_UNITS_TURN_COST = 5", () => {
    expect(BUILD_UNITS_TURN_COST).toBe(5);
  });

  it("SIEGE_TURN_COST = 5", () => {
    expect(SIEGE_TURN_COST).toBe(5);
  });

  it("FAR_EXPEDITION_TURN_COST = 2 (≈ 2× normal explore)", () => {
    expect(FAR_EXPEDITION_TURN_COST).toBe(2);
  });

  it("each turn-cost is a positive integer", () => {
    for (const c of [
      ATTACK_TURN_COST,
      SPELL_TURN_COST,
      BUILD_UNITS_TURN_COST,
      SIEGE_TURN_COST,
      FAR_EXPEDITION_TURN_COST,
    ]) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThan(0);
    }
  });
});

describe("lib/game/data-server — recruit-rate table", () => {
  it("BUILD_UNITS_PER_TURN = 10 (military baseline)", () => {
    expect(BUILD_UNITS_PER_TURN).toBe(10);
  });

  it("BUILD_UNITS_PER_TURN_BY_LAND covers every LandType", () => {
    expect(Object.keys(BUILD_UNITS_PER_TURN_BY_LAND).sort()).toEqual(
      ["food", "magic", "military", "unassigned", "unrevealed"],
    );
  });

  it("unrevealed + unassigned tiles recruit zero units", () => {
    expect(BUILD_UNITS_PER_TURN_BY_LAND.unrevealed).toBe(0);
    expect(BUILD_UNITS_PER_TURN_BY_LAND.unassigned).toBe(0);
  });

  it("military recruits at the baseline 10/turn", () => {
    expect(BUILD_UNITS_PER_TURN_BY_LAND.military).toBe(10);
    // Production rate matches the exported baseline.
    expect(BUILD_UNITS_PER_TURN_BY_LAND.military).toBe(BUILD_UNITS_PER_TURN);
  });

  it("food + magic recruit at half the military rate (mechanics rework May 2026)", () => {
    expect(BUILD_UNITS_PER_TURN_BY_LAND.food).toBe(5);
    expect(BUILD_UNITS_PER_TURN_BY_LAND.magic).toBe(5);
    expect(BUILD_UNITS_PER_TURN_BY_LAND.food).toBe(BUILD_UNITS_PER_TURN / 2);
    expect(BUILD_UNITS_PER_TURN_BY_LAND.magic).toBe(BUILD_UNITS_PER_TURN / 2);
  });

  it("every entry is a non-negative integer", () => {
    for (const v of Object.values(BUILD_UNITS_PER_TURN_BY_LAND)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("lib/game/data-server — unitsPerTurnForLand", () => {
  it("returns the table value for every known land type", () => {
    expect(unitsPerTurnForLand("military")).toBe(10);
    expect(unitsPerTurnForLand("food")).toBe(5);
    expect(unitsPerTurnForLand("magic")).toBe(5);
    expect(unitsPerTurnForLand("unrevealed")).toBe(0);
    expect(unitsPerTurnForLand("unassigned")).toBe(0);
  });

  it("returns 0 for an unknown land type (defensive fallback)", () => {
    expect(unitsPerTurnForLand("mystery" as unknown as Parameters<typeof unitsPerTurnForLand>[0])).toBe(0);
  });

  it("matches BUILD_UNITS_PER_TURN_BY_LAND for every documented key", () => {
    for (const [k, v] of Object.entries(BUILD_UNITS_PER_TURN_BY_LAND)) {
      expect(unitsPerTurnForLand(k as Parameters<typeof unitsPerTurnForLand>[0])).toBe(v);
    }
  });
});
