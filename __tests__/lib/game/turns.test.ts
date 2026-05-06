/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  PRODUCTION_SPELL_DURATION_TURNS,
  SHIELD_DURATION_WEEKS,
  SHIELD_TURN_THRESHOLD,
  WEEKLY_TURN_GRANT,
  applyWeeklyGrant,
  canSpendTurns,
  effectiveUnitCap,
  isShieldActive,
  isUnderdog,
  newPlayer,
  nextPhase,
  priorWeekRangeUtc,
  pruneExpiredProductionSpells,
  shouldGrantWeeklyTurns,
  spendTurns,
  weekStartIsoForRollover,
} from "@/lib/game/turns";
import type { GamePlayer } from "@/lib/game/types";

describe("weekStartIsoForRollover", () => {
  it("returns the most recent Sunday 05:00 UTC date for a Wednesday", () => {
    // Wed 2026-05-06 12:00 UTC → most recent Sunday is 2026-05-03
    const w = weekStartIsoForRollover(new Date("2026-05-06T12:00:00.000Z"));
    expect(w).toBe("2026-05-03");
  });

  it("returns today for Sunday after 05:00 UTC", () => {
    // Sun 2026-05-03 06:00 UTC → today
    const w = weekStartIsoForRollover(new Date("2026-05-03T06:00:00.000Z"));
    expect(w).toBe("2026-05-03");
  });

  it("returns last Sunday for Sunday before 05:00 UTC", () => {
    // Sun 2026-05-03 02:00 UTC → last Sunday is 2026-04-26
    const w = weekStartIsoForRollover(new Date("2026-05-03T02:00:00.000Z"));
    expect(w).toBe("2026-04-26");
  });
});

describe("priorWeekRangeUtc", () => {
  it("returns a 7-day window ending at weekStart 05:00 UTC", () => {
    const r = priorWeekRangeUtc("2026-05-03");
    expect(r.end.toISOString()).toBe("2026-05-03T05:00:00.000Z");
    expect(r.start.toISOString()).toBe("2026-04-26T05:00:00.000Z");
  });
});

describe("newPlayer", () => {
  it("starts at phase=explore with 100 turns and shield active", () => {
    const created = new Date("2026-05-01T12:00:00.000Z");
    const p = newPlayer("user-1", created);
    expect(p.userId).toBe("user-1");
    expect(p.phase).toBe("explore");
    expect(p.caste).toBeNull();
    expect(p.turnsRemaining).toBe(WEEKLY_TURN_GRANT);
    expect(p.turnsSpentTotal).toBe(0);
    expect(p.tilesExplored).toBe(0);
    expect(p.shieldDropAtTurn).toBe(SHIELD_TURN_THRESHOLD);
    expect(isShieldActive(p, created)).toBe(true);
  });
});

describe("spendTurns", () => {
  it("debits turnsRemaining and credits turnsSpentTotal", () => {
    const p = newPlayer("u", new Date("2026-05-01T00:00:00.000Z"));
    const after = spendTurns(p, 30);
    expect(after.turnsRemaining).toBe(70);
    expect(after.turnsSpentTotal).toBe(30);
  });

  it("throws when over-spending", () => {
    const p = newPlayer("u", new Date("2026-05-01T00:00:00.000Z"));
    expect(() => spendTurns(p, 200)).toThrow();
  });

  it("rejects negative spending", () => {
    const p = newPlayer("u", new Date("2026-05-01T00:00:00.000Z"));
    expect(() => spendTurns(p, -1)).toThrow();
  });
});

describe("canSpendTurns", () => {
  it("returns true when player has enough", () => {
    const p = newPlayer("u", new Date("2026-05-01T00:00:00.000Z"));
    expect(canSpendTurns(p, 100)).toBe(true);
    expect(canSpendTurns(p, 101)).toBe(false);
  });
});

describe("isShieldActive", () => {
  it("is active right after creation", () => {
    const created = new Date("2026-05-01T00:00:00.000Z");
    const p = newPlayer("u", created);
    expect(isShieldActive(p, created)).toBe(true);
  });

  it("drops only after BOTH the time window has elapsed AND 300 turns have been spent", () => {
    const created = new Date("2026-05-01T00:00:00.000Z");
    const after3Weeks = new Date(
      created.getTime() + (SHIELD_DURATION_WEEKS * 7 + 1) * 24 * 60 * 60 * 1000
    );
    const p1 = newPlayer("u", created);
    // 3 weeks passed but only 100 turns spent → still shielded
    const stillShielded: GamePlayer = { ...p1, turnsSpentTotal: 100 };
    expect(isShieldActive(stillShielded, after3Weeks)).toBe(true);
    // 300 turns spent but only 1 week passed → still shielded
    const oneWeekLater = new Date(
      created.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    const stillShielded2: GamePlayer = { ...p1, turnsSpentTotal: 350 };
    expect(isShieldActive(stillShielded2, oneWeekLater)).toBe(true);
    // BOTH conditions satisfied → drops
    const dropped: GamePlayer = { ...p1, turnsSpentTotal: 350 };
    expect(isShieldActive(dropped, after3Weeks)).toBe(false);
  });
});

describe("isUnderdog", () => {
  it("true when defender < 0.5x attacker", () => {
    expect(isUnderdog(1000, 400)).toBe(true);
    expect(isUnderdog(1000, 499)).toBe(true);
  });

  it("false when defender >= 0.5x attacker", () => {
    expect(isUnderdog(1000, 500)).toBe(false);
    expect(isUnderdog(1000, 1000)).toBe(false);
  });

  it("false for empty attacker army (avoid divide-by-zero)", () => {
    expect(isUnderdog(0, 0)).toBe(false);
  });
});

describe("shouldGrantWeeklyTurns + applyWeeklyGrant", () => {
  function p() {
    return newPlayer("u", new Date("2026-04-01T00:00:00.000Z"));
  }

  it("grants when PR merged and no prior grant for this week", () => {
    expect(shouldGrantWeeklyTurns(p(), true, "2026-05-03")).toBe(true);
  });

  it("does not grant when no PR was merged", () => {
    expect(shouldGrantWeeklyTurns(p(), false, "2026-05-03")).toBe(false);
  });

  it("is idempotent on lastWeeklyGrantWeekStart match", () => {
    const granted = applyWeeklyGrant(p(), "2026-05-03");
    expect(shouldGrantWeeklyTurns(granted, true, "2026-05-03")).toBe(false);
    expect(shouldGrantWeeklyTurns(granted, true, "2026-05-10")).toBe(true);
  });

  it("applyWeeklyGrant resets turnsRemaining to 100 (no rollover)", () => {
    const partial: GamePlayer = { ...p(), turnsRemaining: 30 };
    const granted = applyWeeklyGrant(partial, "2026-05-03");
    expect(granted.turnsRemaining).toBe(WEEKLY_TURN_GRANT);
    expect(granted.lastWeeklyGrantWeekStart).toBe("2026-05-03");
  });
});

describe("nextPhase", () => {
  it("explore → distribute when tilesExplored hits 100", () => {
    const p: GamePlayer = { ...newPlayer("u"), tilesExplored: 100 };
    expect(nextPhase(p)).toBe("distribute");
  });

  it("stays in explore below 100", () => {
    const p: GamePlayer = { ...newPlayer("u"), tilesExplored: 99 };
    expect(nextPhase(p)).toBe("explore");
  });

  it("caste → play when caste is set", () => {
    const p: GamePlayer = {
      ...newPlayer("u"),
      phase: "caste",
      caste: "red",
    };
    expect(nextPhase(p)).toBe("play");
  });

  it("preserves the current phase otherwise", () => {
    const p: GamePlayer = { ...newPlayer("u"), phase: "distribute" };
    expect(nextPhase(p)).toBe("distribute");
  });
});

describe("pruneExpiredProductionSpells", () => {
  it("returns an empty array when given an empty array", () => {
    expect(pruneExpiredProductionSpells([], 100)).toEqual([]);
  });

  it("keeps spells whose expiresAtTurn is strictly greater than the cutoff", () => {
    const result = pruneExpiredProductionSpells(
      [
        { spellId: "still-active", expiresAtTurn: 200 },
        { spellId: "expired", expiresAtTurn: 90 },
        { spellId: "borderline", expiresAtTurn: 100 },
      ],
      100
    );
    expect(result).toEqual([
      { spellId: "still-active", expiresAtTurn: 200 },
    ]);
  });

  it("does not mutate the input", () => {
    const input = [
      { spellId: "a", expiresAtTurn: 50 },
      { spellId: "b", expiresAtTurn: 200 },
    ];
    const before = JSON.stringify(input);
    pruneExpiredProductionSpells(input, 100);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("effectiveUnitCap", () => {
  it("returns base cap from food lands when no production spells active", () => {
    const p = newPlayer("u");
    expect(effectiveUnitCap(p, 10, 0)).toBe(50);
    expect(effectiveUnitCap(p, 50, 0)).toBe(250);
  });

  it("adds production spell bonus when an active spell is in the list", () => {
    const created = new Date("2026-05-01T00:00:00.000Z");
    const base = newPlayer("u", created);
    const withSpell: GamePlayer = {
      ...base,
      caste: "blue",
      turnsSpentTotal: 50,
      productionSpellsActive: [
        {
          spellId: "blue-production-arcane-surge",
          expiresAtTurn: 50 + PRODUCTION_SPELL_DURATION_TURNS,
        },
      ],
    };
    const without = effectiveUnitCap({ ...withSpell, productionSpellsActive: [] }, 20, 30);
    const withBonus = effectiveUnitCap(withSpell, 20, 30);
    expect(withBonus).toBeGreaterThan(without);
  });

  it("ignores expired production spells", () => {
    const base = newPlayer("u");
    const expired: GamePlayer = {
      ...base,
      caste: "blue",
      turnsSpentTotal: 200,
      productionSpellsActive: [
        { spellId: "blue-production-arcane-surge", expiresAtTurn: 100 },
      ],
    };
    expect(effectiveUnitCap(expired, 20, 30)).toBe(
      effectiveUnitCap({ ...expired, productionSpellsActive: [] }, 20, 30)
    );
  });
});
