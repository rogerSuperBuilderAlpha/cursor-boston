/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  INTEL_EFFECT_DURATION_CASTER_TURNS,
  readAttackContextEffects,
  recordIntelEffectInTx,
} from "@/lib/game/intel-effects";
import type { IntelEffect } from "@/lib/game/types";

describe("INTEL_EFFECT_DURATION_CASTER_TURNS", () => {
  it("is 5 — the canonical lifetime for spy debuffs and Forge Sight", () => {
    // Pinned because data-server.ts and the spell descriptions reference '5
    // turns' explicitly. Changing this value requires updating the user-
    // facing copy in lib/game/content/spells/{black,green,red}/intel.ts.
    expect(INTEL_EFFECT_DURATION_CASTER_TURNS).toBe(5);
  });
});

describe("recordIntelEffectInTx", () => {
  function makeFakeTx() {
    const sets: Array<{ ref: unknown; data: IntelEffect }> = [];
    const tx = {
      set: jest.fn((ref: unknown, data: IntelEffect) => {
        sets.push({ ref, data });
      }),
    };
    const docRef = { __ref: "doc" };
    const collectionFn = jest.fn(() => ({ doc: jest.fn(() => docRef) }));
    const db = { collection: collectionFn };
    return { tx, db, sets, collectionFn };
  }

  it("writes an alert-vs-caster effect with magnitude and expiry", () => {
    const { tx, db, sets } = makeFakeTx();
    const now = new Date("2026-05-08T00:00:00Z");
    const effect = recordIntelEffectInTx({
      tx: tx as never,
      db: db as never,
      kind: "alert-vs-caster",
      ownerId: "defender-1",
      casterId: "attacker-1",
      magnitude: 0.2,
      casterTurnsSpentTotalAtCast: 100,
      now,
    });
    expect(sets).toHaveLength(1);
    expect(effect.kind).toBe("alert-vs-caster");
    expect(effect.ownerId).toBe("defender-1");
    expect(effect.casterId).toBe("attacker-1");
    expect(effect.magnitude).toBeCloseTo(0.2, 5);
    expect(effect.expiresAtCasterTurn).toBe(105);
    expect(effect.targetTileId).toBeUndefined();
    expect(effect.id).toMatch(/[0-9a-f]{8}-/);
  });

  it("writes a forge-sight-offense effect with targetTileId", () => {
    const { tx, sets, db } = makeFakeTx();
    const now = new Date("2026-05-08T00:00:00Z");
    recordIntelEffectInTx({
      tx: tx as never,
      db: db as never,
      kind: "forge-sight-offense",
      ownerId: "attacker-1",
      casterId: "attacker-1",
      targetTileId: "5_-3",
      magnitude: 0.1,
      casterTurnsSpentTotalAtCast: 50,
      now,
    });
    expect(sets).toHaveLength(1);
    expect(sets[0].data.targetTileId).toBe("5_-3");
    expect(sets[0].data.expiresAtCasterTurn).toBe(55);
  });
});

describe("readAttackContextEffects", () => {
  /**
   * Fake Firestore that records every `where(field, op, value)` call on each
   * collection() and returns a configurable doc set when .get() resolves.
   */
  function makeDb(snaps: {
    forge?: IntelEffect[];
    alert?: IntelEffect[];
  }): unknown {
    function makeQuery(docs: IntelEffect[]) {
      const wrapped = docs.map((d) => ({ data: () => d }));
      const q: {
        where: jest.Mock;
        get: jest.Mock;
      } = {
        where: jest.fn(() => q),
        get: jest.fn(() => Promise.resolve({ docs: wrapped })),
      };
      return q;
    }
    let collectionCallNo = 0;
    return {
      collection: jest.fn(() => {
        // The function under test runs the two queries in parallel via
        // Promise.all([forgeQuery, alertQuery]). Both call db.collection()
        // for COLLECTION at module load — alternate the answers.
        const idx = collectionCallNo++;
        if (idx % 2 === 0) return makeQuery(snaps.forge ?? []);
        return makeQuery(snaps.alert ?? []);
      }),
    };
  }

  function effect(overrides: Partial<IntelEffect>): IntelEffect {
    return {
      id: "e",
      kind: "alert-vs-caster",
      ownerId: "x",
      casterId: "y",
      magnitude: 0.1,
      expiresAtCasterTurn: 100,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("returns zeros when no effects match", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({}) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    expect(out.forgeSightOffenseBonus).toBe(0);
    expect(out.alertVsCasterDefenseBonus).toBe(0);
  });

  it("sums forge-sight magnitudes only when target tile + caster + expiry match", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        forge: [
          effect({
            kind: "forge-sight-offense",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.1,
            expiresAtCasterTurn: 60, // 50 < 60 → active
          }),
          effect({
            kind: "forge-sight-offense",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "9_9", // wrong target — filtered out
            magnitude: 0.5,
            expiresAtCasterTurn: 60,
          }),
          effect({
            kind: "forge-sight-offense",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.5,
            expiresAtCasterTurn: 40, // expired (50 >= 40) → filtered
          }),
        ],
      }) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    expect(out.forgeSightOffenseBonus).toBeCloseTo(0.1, 5);
    expect(out.alertVsCasterDefenseBonus).toBe(0);
  });

  it("sums alert-vs-caster magnitudes only when caster + expiry match", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        alert: [
          effect({
            kind: "alert-vs-caster",
            ownerId: "def",
            casterId: "atk",
            magnitude: 0.2,
            expiresAtCasterTurn: 60,
          }),
          effect({
            kind: "alert-vs-caster",
            ownerId: "def",
            casterId: "someone-else", // not this attacker — filtered
            magnitude: 0.3,
            expiresAtCasterTurn: 60,
          }),
          effect({
            kind: "alert-vs-caster",
            ownerId: "def",
            casterId: "atk",
            magnitude: 0.1, // expired
            expiresAtCasterTurn: 30,
          }),
        ],
      }) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    expect(out.alertVsCasterDefenseBonus).toBeCloseTo(0.2, 5);
  });

  it("combines forge-sight and alert into a single result object", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        forge: [
          effect({
            kind: "forge-sight-offense",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.1,
            expiresAtCasterTurn: 60,
          }),
        ],
        alert: [
          effect({
            kind: "alert-vs-caster",
            ownerId: "def",
            casterId: "atk",
            magnitude: 0.2,
            expiresAtCasterTurn: 60,
          }),
        ],
      }) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    expect(out).toEqual({
      forgeSightOffenseBonus: 0.1,
      alertVsCasterDefenseBonus: 0.2,
    });
  });
});
