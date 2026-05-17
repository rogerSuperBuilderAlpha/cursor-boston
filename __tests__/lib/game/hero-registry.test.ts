/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { heroEvent } from "@/lib/game/hero-registry";

describe("heroEvent builders", () => {
  it("emerged() carries the hero's tile + owner", () => {
    const ev = heroEvent.emerged(
      { tileId: "q3_r3", ownerId: "owner-a" },
      2
    );
    expect(ev.kind).toBe("emerged");
    expect(ev.tileId).toBe("q3_r3");
    expect(ev.ownerIdAtTime).toBe("owner-a");
    expect(ev.seasonNumber).toBe(2);
  });

  it("engagedAttacker() records target + outcome", () => {
    const ev = heroEvent.engagedAttacker({
      tileId: "q0_r0",
      ownerIdAtTime: "owner-a",
      defenderId: "owner-b",
      targetTileId: "q1_r0",
      outcome: "captured",
      seasonNumber: 1,
    });
    expect(ev.kind).toBe("engaged_attacker");
    expect(ev.outcome).toBe("captured");
    expect(ev.targetTileId).toBe("q1_r0");
    expect(ev.defenderId).toBe("owner-b");
  });

  it("engagedDefender() records the attacker id", () => {
    const ev = heroEvent.engagedDefender({
      tileId: "q5_r5",
      ownerIdAtTime: "owner-a",
      attackerId: "owner-b",
      outcome: "repelled",
      seasonNumber: 1,
    });
    expect(ev.kind).toBe("engaged_defender");
    expect(ev.attackerId).toBe("owner-b");
    expect(ev.outcome).toBe("repelled");
  });

  it("slain() carries the attacker id", () => {
    const ev = heroEvent.slain({
      tileId: "q5_r5",
      ownerIdAtTime: "owner-a",
      attackerId: "owner-b",
      seasonNumber: 1,
    });
    expect(ev.kind).toBe("slain");
    expect(ev.attackerId).toBe("owner-b");
  });

  it("defected() attributes ownerIdAtTime to the FROM owner (events belong to that tenure)", () => {
    const ev = heroEvent.defected({
      tileId: "q5_r5",
      fromOwnerId: "owner-a",
      toOwnerId: "owner-b",
      seasonNumber: 1,
    });
    expect(ev.kind).toBe("defected");
    expect(ev.ownerIdAtTime).toBe("owner-a");
    expect(ev.fromOwnerId).toBe("owner-a");
    expect(ev.toOwnerId).toBe("owner-b");
  });

  it("movedOnCapture() records source + destination tiles", () => {
    const ev = heroEvent.movedOnCapture({
      tileId: "q1_r0",
      fromTileId: "q0_r0",
      ownerIdAtTime: "owner-a",
      seasonNumber: 1,
    });
    expect(ev.kind).toBe("moved_on_capture");
    expect(ev.tileId).toBe("q1_r0");
    expect(ev.fromTileId).toBe("q0_r0");
  });

  it("spellCast() records the spell + target", () => {
    const ev = heroEvent.spellCast({
      tileId: "q0_r0",
      ownerIdAtTime: "owner-a",
      spellId: "white-defense-t3",
      targetTileId: "q1_r0",
      seasonNumber: 1,
    });
    expect(ev.kind).toBe("spell_cast");
    expect(ev.spellId).toBe("white-defense-t3");
    expect(ev.targetTileId).toBe("q1_r0");
  });

  it("recruited() records type + count", () => {
    const ev = heroEvent.recruited({
      tileId: "q0_r0",
      ownerIdAtTime: "owner-a",
      unitType: "ground",
      unitsBuilt: 50,
      seasonNumber: 1,
    });
    expect(ev.kind).toBe("recruited");
    expect(ev.unitType).toBe("ground");
    expect(ev.unitsBuilt).toBe(50);
  });

  it("specialUnitSummoned() records the definition id", () => {
    const ev = heroEvent.specialUnitSummoned({
      tileId: "q0_r0",
      ownerIdAtTime: "owner-a",
      specialUnitDefId: "white-knight-broken-lance",
      seasonNumber: 1,
    });
    expect(ev.kind).toBe("special_unit_summoned");
    expect(ev.specialUnitDefId).toBe("white-knight-broken-lance");
  });

  it("seasonEnded() allows a null ownerIdAtTime for in-limbo heroes", () => {
    const ev = heroEvent.seasonEnded({
      tileId: "q0_r0",
      ownerIdAtTime: null,
      seasonNumber: 3,
    });
    expect(ev.kind).toBe("season_ended");
    expect(ev.ownerIdAtTime).toBeNull();
    expect(ev.seasonNumber).toBe(3);
  });
});
