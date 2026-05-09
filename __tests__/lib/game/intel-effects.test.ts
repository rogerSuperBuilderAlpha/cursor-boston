/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  INTEL_EFFECT_DURATION_CASTER_TURNS,
  deleteIntelEffectsInTx,
  readAttackContextEffects,
  recordDefenseDisarmInTx,
  recordIntelEffectInTx,
  recordPreCastOffenseInTx,
  recordSiegeDebuffInTx,
} from "@/lib/game/intel-effects";
import {
  SIEGE_DEBUFF_MAX_MAGNITUDE,
  type IntelEffect,
} from "@/lib/game/types";

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
      delete: jest.fn(),
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

describe("recordSiegeDebuffInTx", () => {
  function makeFakeTx() {
    const sets: Array<{ data: IntelEffect }> = [];
    const tx = {
      set: jest.fn((_ref: unknown, data: IntelEffect) => {
        sets.push({ data });
      }),
      delete: jest.fn(),
    };
    const db = { collection: jest.fn(() => ({ doc: jest.fn(() => ({})) })) };
    return { tx, db, sets };
  }

  it("clamps magnitude to SIEGE_DEBUFF_MAX_MAGNITUDE", () => {
    const { tx, db, sets } = makeFakeTx();
    recordSiegeDebuffInTx({
      tx: tx as never,
      db: db as never,
      attackerId: "atk",
      targetTileId: "0_0",
      magnitude: 0.99,
      attackerTurnsSpentTotal: 100,
      now: new Date(),
    });
    expect(sets[0].data.magnitude).toBe(SIEGE_DEBUFF_MAX_MAGNITUDE);
    expect(sets[0].data.kind).toBe("siege-debuff");
    expect(sets[0].data.expiresAtCasterTurn).toBe(105);
  });

  it("clamps negative magnitude to 0", () => {
    const { tx, db, sets } = makeFakeTx();
    recordSiegeDebuffInTx({
      tx: tx as never,
      db: db as never,
      attackerId: "atk",
      targetTileId: "0_0",
      magnitude: -0.5,
      attackerTurnsSpentTotal: 0,
      now: new Date(),
    });
    expect(sets[0].data.magnitude).toBe(0);
  });
});

describe("recordPreCastOffenseInTx + recordDefenseDisarmInTx", () => {
  function makeFakeTx() {
    const sets: Array<{ data: IntelEffect }> = [];
    const tx = {
      set: jest.fn((_ref: unknown, data: IntelEffect) => {
        sets.push({ data });
      }),
      delete: jest.fn(),
    };
    const db = { collection: jest.fn(() => ({ doc: jest.fn(() => ({})) })) };
    return { tx, db, sets };
  }

  it("pre-cast offense persists realized power as magnitude", () => {
    const { tx, db, sets } = makeFakeTx();
    recordPreCastOffenseInTx({
      tx: tx as never,
      db: db as never,
      attackerId: "atk",
      targetTileId: "0_0",
      realizedPower: 250,
      attackerTurnsSpentTotal: 10,
      now: new Date(),
    });
    expect(sets[0].data.kind).toBe("pre-cast-offense-spell");
    expect(sets[0].data.magnitude).toBe(250);
    expect(sets[0].data.targetTileId).toBe("0_0");
  });

  it("disarm clamps fraction to [0, 1]", () => {
    const { tx, db, sets } = makeFakeTx();
    recordDefenseDisarmInTx({
      tx: tx as never,
      db: db as never,
      attackerId: "atk",
      targetTileId: "0_0",
      disarmFraction: 1.5,
      attackerTurnsSpentTotal: 10,
      now: new Date(),
    });
    expect(sets[0].data.kind).toBe("defense-disarm");
    expect(sets[0].data.magnitude).toBe(1);
  });
});

describe("deleteIntelEffectsInTx", () => {
  it("issues a tx.delete per id", () => {
    const deleted: unknown[] = [];
    const tx = {
      set: jest.fn(),
      delete: jest.fn((ref: unknown) => {
        deleted.push(ref);
      }),
    };
    const docs = new Map<string, { __id: string }>();
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn((id: string) => {
          if (!docs.has(id)) docs.set(id, { __id: id });
          return docs.get(id);
        }),
      })),
    };
    deleteIntelEffectsInTx({
      tx: tx as never,
      db: db as never,
      effectIds: ["a", "b", "c"],
    });
    expect(deleted).toHaveLength(3);
    expect(deleted.map((d) => (d as { __id: string }).__id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("is a no-op for an empty list", () => {
    const tx = { set: jest.fn(), delete: jest.fn() };
    const db = { collection: jest.fn() };
    deleteIntelEffectsInTx({
      tx: tx as never,
      db: db as never,
      effectIds: [],
    });
    expect(tx.delete).not.toHaveBeenCalled();
  });
});

describe("readAttackContextEffects", () => {
  /**
   * Fake Firestore that returns a configurable doc set for each kind,
   * matched by the `kind` clause in the where() chain.
   */
  function makeDb(snaps: {
    forge?: IntelEffect[];
    alert?: IntelEffect[];
    siege?: IntelEffect[];
    preCast?: IntelEffect[];
    disarm?: IntelEffect[];
  }) {
    function makeQuery(): {
      where: jest.Mock;
      get: jest.Mock;
      _kind: string | null;
    } {
      const q: {
        where: jest.Mock;
        get: jest.Mock;
        _kind: string | null;
      } = {
        _kind: null,
        where: jest.fn((field: string, _op: string, value: unknown) => {
          if (field === "kind") q._kind = value as string;
          return q;
        }),
        get: jest.fn(() => {
          const docs = (() => {
            switch (q._kind) {
              case "forge-sight-offense":
                return snaps.forge ?? [];
              case "alert-vs-caster":
                return snaps.alert ?? [];
              case "siege-debuff":
                return snaps.siege ?? [];
              case "pre-cast-offense-spell":
                return snaps.preCast ?? [];
              case "defense-disarm":
                return snaps.disarm ?? [];
              default:
                return [];
            }
          })();
          return Promise.resolve({
            docs: docs.map((d) => ({ id: d.id, data: () => d })),
          });
        }),
      };
      return q;
    }
    return {
      collection: jest.fn(() => makeQuery()),
    } as unknown;
  }

  function effect(overrides: Partial<IntelEffect> & { id: string }): IntelEffect {
    return {
      kind: "alert-vs-caster",
      ownerId: "x",
      casterId: "y",
      magnitude: 0.1,
      expiresAtCasterTurn: 100,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("returns zeros and no consume ids when no effects match", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({}) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    expect(out.forgeSightOffenseBonus).toBe(0);
    expect(out.alertVsCasterDefenseBonus).toBe(0);
    expect(out.siegeDebuffMagnitude).toBe(0);
    expect(out.preCastOffenseBonus).toBe(0);
    expect(out.defenseDisarmFraction).toBe(0);
    expect(out.consumeEffectIds).toEqual([]);
  });

  it("sums forge-sight magnitudes only when target tile + caster + expiry match", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        forge: [
          effect({
            id: "f1",
            kind: "forge-sight-offense",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.1,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "f2",
            kind: "forge-sight-offense",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "9_9",
            magnitude: 0.5,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "f3",
            kind: "forge-sight-offense",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.5,
            expiresAtCasterTurn: 40,
          }),
        ],
      }) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    expect(out.forgeSightOffenseBonus).toBeCloseTo(0.1, 5);
  });

  it("sums alert-vs-caster magnitudes only when caster + expiry match", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        alert: [
          effect({
            id: "a1",
            kind: "alert-vs-caster",
            ownerId: "def",
            casterId: "atk",
            magnitude: 0.2,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "a2",
            kind: "alert-vs-caster",
            ownerId: "def",
            casterId: "someone-else",
            magnitude: 0.3,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "a3",
            kind: "alert-vs-caster",
            ownerId: "def",
            casterId: "atk",
            magnitude: 0.1,
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

  it("siege-debuff sums and is clamped to SIEGE_DEBUFF_MAX_MAGNITUDE", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        siege: [
          effect({
            id: "s1",
            kind: "siege-debuff",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.10,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "s2",
            kind: "siege-debuff",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.10,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "s3",
            kind: "siege-debuff",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.20,
            expiresAtCasterTurn: 60,
          }),
        ],
      }) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    // Raw sum is 0.40, clamped to SIEGE_DEBUFF_MAX_MAGNITUDE (0.30).
    expect(out.siegeDebuffMagnitude).toBeCloseTo(SIEGE_DEBUFF_MAX_MAGNITUDE, 5);
    // Siege is TTL-only, never consumed.
    expect(out.consumeEffectIds).toEqual([]);
  });

  it("siege filters by targetTileId and expiry", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        siege: [
          effect({
            id: "s1",
            kind: "siege-debuff",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.10,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "s2",
            kind: "siege-debuff",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "1_1", // wrong tile
            magnitude: 0.10,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "s3",
            kind: "siege-debuff",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.10,
            expiresAtCasterTurn: 30, // expired
          }),
        ],
      }) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    expect(out.siegeDebuffMagnitude).toBeCloseTo(0.10, 5);
  });

  it("pre-cast offense sums realized power and lists consume ids", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        preCast: [
          effect({
            id: "p1",
            kind: "pre-cast-offense-spell",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 100,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "p2",
            kind: "pre-cast-offense-spell",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 50,
            expiresAtCasterTurn: 60,
          }),
        ],
      }) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    expect(out.preCastOffenseBonus).toBe(150);
    expect(out.consumeEffectIds.sort()).toEqual(["p1", "p2"]);
  });

  it("multiple disarm effects combine multiplicatively (1 - prod(1 - m_i))", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        disarm: [
          effect({
            id: "d1",
            kind: "defense-disarm",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.5,
            expiresAtCasterTurn: 60,
          }),
          effect({
            id: "d2",
            kind: "defense-disarm",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.5,
            expiresAtCasterTurn: 60,
          }),
        ],
      }) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    // 1 - (1-0.5)*(1-0.5) = 0.75
    expect(out.defenseDisarmFraction).toBeCloseTo(0.75, 5);
    expect(out.consumeEffectIds.sort()).toEqual(["d1", "d2"]);
  });

  it("combines all five kinds in a single result + lists single-use consume ids", async () => {
    const out = await readAttackContextEffects({
      db: makeDb({
        forge: [
          effect({
            id: "f",
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
            id: "a",
            kind: "alert-vs-caster",
            ownerId: "def",
            casterId: "atk",
            magnitude: 0.2,
            expiresAtCasterTurn: 60,
          }),
        ],
        siege: [
          effect({
            id: "s",
            kind: "siege-debuff",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.1,
            expiresAtCasterTurn: 60,
          }),
        ],
        preCast: [
          effect({
            id: "p",
            kind: "pre-cast-offense-spell",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 75,
            expiresAtCasterTurn: 60,
          }),
        ],
        disarm: [
          effect({
            id: "d",
            kind: "defense-disarm",
            ownerId: "atk",
            casterId: "atk",
            targetTileId: "0_0",
            magnitude: 0.4,
            expiresAtCasterTurn: 60,
          }),
        ],
      }) as never,
      attackerId: "atk",
      attackerTurnsSpentTotal: 50,
      defenderId: "def",
      defenderTileId: "0_0",
    });
    expect(out.forgeSightOffenseBonus).toBeCloseTo(0.1, 5);
    expect(out.alertVsCasterDefenseBonus).toBeCloseTo(0.2, 5);
    expect(out.siegeDebuffMagnitude).toBeCloseTo(0.1, 5);
    expect(out.preCastOffenseBonus).toBe(75);
    expect(out.defenseDisarmFraction).toBeCloseTo(0.4, 5);
    // Only single-use kinds (pre-cast, disarm) are consumed; siege and
    // alert/forge survive.
    expect(out.consumeEffectIds.sort()).toEqual(["d", "p"]);
  });
});
