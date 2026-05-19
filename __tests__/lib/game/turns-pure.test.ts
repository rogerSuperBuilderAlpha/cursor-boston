/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #76 — pure helpers in lib/game/turns.ts.
 */
import {
  applyWeeklyGrant,
  canSpendTurns,
  currentEligibilityWindow,
  effectiveUnitCap,
  GENERAL_NAME_MAX,
  GENERAL_NAME_MIN,
  isShieldActive,
  isUnderdog,
  newPlayer,
  nextPhase,
  nextRolloverInstant,
  priorWeekRangeUtc,
  pruneExpiredProductionSpells,
  shouldGrantWeeklyTurns,
  spendTurns,
  STARTING_TURN_GRANT,
  validateGeneralName,
  weekStartIsoForRollover,
  WEEKLY_TURN_GRANT,
} from "@/lib/game/turns";
import type { GamePlayer } from "@/lib/game/types";

describe("lib/game/turns (pure)", () => {
  it("weekStartIsoForRollover returns yyyy-mm-dd on Sunday after 05:00 UTC", () => {
    const iso = weekStartIsoForRollover(new Date("2026-05-18T12:00:00.000Z"));
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("priorWeekRangeUtc spans seven days ending at rollover", () => {
    const { start, end } = priorWeekRangeUtc("2026-05-18");
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("nextRolloverInstant is in the future", () => {
    const now = new Date("2026-05-18T12:00:00.000Z");
    expect(nextRolloverInstant(now).getTime()).toBeGreaterThan(now.getTime());
  });

  it("currentEligibilityWindow returns start/end dates", () => {
    const w = currentEligibilityWindow(new Date("2026-05-18T12:00:00.000Z"));
    expect(w.start.getTime()).toBeLessThan(w.end.getTime());
  });

  describe("validateGeneralName", () => {
    it("accepts valid names", () => {
      expect(validateGeneralName("  Ada Lovelace  ")).toBe("Ada Lovelace");
    });

    it("rejects too-short names", () => {
      expect(() => validateGeneralName("ab")).toThrow(
        `at least ${GENERAL_NAME_MIN}`,
      );
    });

    it("rejects too-long names", () => {
      expect(() => validateGeneralName("x".repeat(GENERAL_NAME_MAX + 1))).toThrow(
        `at most ${GENERAL_NAME_MAX}`,
      );
    });
  });

  it("newPlayer seeds starting turns and explore phase", () => {
    const p = newPlayer("u1", new Date("2026-01-01T00:00:00.000Z"));
    expect(p.turnsRemaining).toBe(STARTING_TURN_GRANT);
    expect(p.phase).toBe("explore");
    expect(p.userId).toBe("u1");
  });

  it("spendTurns decrements the pool", () => {
    const p = newPlayer("u1");
    const after = spendTurns(p, 5);
    expect(after.turnsRemaining).toBe(p.turnsRemaining - 5);
    expect(after.turnsSpentTotal).toBe(5);
  });

  it("canSpendTurns reflects remaining turns", () => {
    const p = newPlayer("u1");
    expect(canSpendTurns(p, 1)).toBe(true);
    expect(canSpendTurns({ ...p, turnsRemaining: 0 }, 1)).toBe(false);
  });

  it("isShieldActive is true for fresh players", () => {
    const p = newPlayer("u1", new Date("2026-05-18T12:00:00.000Z"));
    expect(isShieldActive(p, new Date("2026-05-19T12:00:00.000Z"))).toBe(true);
  });

  it("isUnderdog compares unit counts", () => {
    expect(isUnderdog(100, 40)).toBe(true);
    expect(isUnderdog(10, 10)).toBe(false);
  });

  it("shouldGrantWeeklyTurns requires merge + fresh week", () => {
    const p = newPlayer("u1");
    const week = "2026-05-18";
    expect(shouldGrantWeeklyTurns(p, false, week)).toBe(false);
    expect(shouldGrantWeeklyTurns(p, true, week)).toBe(true);
    expect(
      shouldGrantWeeklyTurns(
        { ...p, lastWeeklyGrantWeekStart: week },
        true,
        week,
      ),
    ).toBe(false);
  });

  it("applyWeeklyGrant adds WEEKLY_TURN_GRANT", () => {
    const p = newPlayer("u1");
    const granted = applyWeeklyGrant(p, "2026-05-18");
    expect(granted.turnsRemaining).toBe(p.turnsRemaining + WEEKLY_TURN_GRANT);
  });

  it("nextPhase advances explore → distribute at 100 tiles", () => {
    const p: GamePlayer = {
      ...newPlayer("u1"),
      phase: "explore",
      tilesExplored: 100,
    };
    expect(nextPhase(p)).toBe("distribute");
  });

  it("pruneExpiredProductionSpells drops lapsed entries", () => {
    const out = pruneExpiredProductionSpells(
      [
        { spellId: "a", expiresAtTurn: 5 },
        { spellId: "b", expiresAtTurn: 20 },
      ],
      10,
    );
    expect(out).toHaveLength(1);
    expect(out[0].spellId).toBe("b");
  });

  it("effectiveUnitCap uses food lands and caste", () => {
    const p = { ...newPlayer("u1"), caste: "red" as const };
    expect(effectiveUnitCap(p, 10, 0)).toBeGreaterThan(0);
  });
});
