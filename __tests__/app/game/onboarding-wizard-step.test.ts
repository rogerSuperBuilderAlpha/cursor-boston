/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { pickCurrentStep } from "@/app/game/_components/onboarding/use-onboarding-wizard";
import type { GamePlayer, Caste } from "@/lib/game/types";
import type {
  ArmyTotals,
  LandCounts,
} from "@/app/game/_lib/dashboard-types";

function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: "u1",
    displayName: "Tester",
    caste: null,
    turnsRemaining: 300,
    turnsSpentTotal: 0,
    phase: "explore",
    tilesExplored: 0,
    shieldUntil: new Date(0),
    shieldDropAtTurn: 100,
    productionSpellsActive: [],
    stats: {
      attacksWon: 0,
      attacksLost: 0,
      tilesHeld: 100,
      unitsAlive: 0,
    },
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } satisfies GamePlayer;
}

function makeCounts(overrides: Partial<LandCounts> = {}): LandCounts {
  return {
    military: 0,
    food: 0,
    magic: 0,
    unassigned: 0,
    total: 0,
    ...overrides,
  };
}

function makeArmy(overrides: Partial<ArmyTotals> = {}): ArmyTotals {
  return {
    ground: 0,
    siege: 0,
    air: 0,
    total: 0,
    ...overrides,
  };
}

describe("pickCurrentStep", () => {
  it("phase=explore → 'explore' regardless of other state", () => {
    expect(
      pickCurrentStep(
        makePlayer({ phase: "explore" }),
        makeCounts(),
        makeArmy()
      )
    ).toBe("explore");
  });

  it("phase=distribute with unassigned > 0 → 'distribute'", () => {
    expect(
      pickCurrentStep(
        makePlayer({ phase: "distribute" }),
        makeCounts({ unassigned: 25, total: 100 }),
        makeArmy()
      )
    ).toBe("distribute");
  });

  it("phase=distribute, unassigned=0, caste=null → 'caste'", () => {
    expect(
      pickCurrentStep(
        makePlayer({ phase: "distribute" }),
        makeCounts({ military: 33, food: 33, magic: 34, total: 100 }),
        makeArmy()
      )
    ).toBe("caste");
  });

  it("phase=play, caste=set, no army, has military tile → 'recruit'", () => {
    const caste: Caste = "black";
    expect(
      pickCurrentStep(
        makePlayer({ phase: "play", caste }),
        makeCounts({ military: 33, food: 33, magic: 34, total: 100 }),
        makeArmy({ ground: 0, total: 0 })
      )
    ).toBe("recruit");
  });

  it("phase=play, caste=set, army > 0 → 'done' (graduated)", () => {
    const caste: Caste = "red";
    expect(
      pickCurrentStep(
        makePlayer({ phase: "play", caste }),
        makeCounts({ military: 33, food: 33, magic: 34, total: 100 }),
        makeArmy({ ground: 10, total: 10 })
      )
    ).toBe("done");
  });

  it("phase=play, no military tile, no army → 'done' (no recruit possible)", () => {
    const caste: Caste = "blue";
    expect(
      pickCurrentStep(
        makePlayer({ phase: "play", caste }),
        makeCounts({ military: 0, food: 50, magic: 50, total: 100 }),
        makeArmy({ total: 0 })
      )
    ).toBe("done");
  });

  it("legacy distribute spawn (caste null, all assigned) advances to 'caste'", () => {
    // Migration path: existing players in 'distribute' phase with the old
    // 25-tile spawn that already had everything assigned. Wizard should
    // pick up at the caste step rather than re-firing distribute.
    expect(
      pickCurrentStep(
        makePlayer({ phase: "distribute", caste: null }),
        makeCounts({ military: 8, food: 9, magic: 8, total: 25 }),
        makeArmy()
      )
    ).toBe("caste");
  });
});
