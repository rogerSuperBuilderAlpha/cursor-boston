/**
 * @jest-environment node
 *
 * Tests for the heroEvent payload-builder namespace + viewerWasOwner.
 * The InTx writer helpers (upsertHeroInTx, markHeroDeceasedInTx, etc.)
 * each take a Transaction; we exercise them via a fake-tx so we can
 * assert their argument shape without standing up a real Firestore.
 */
import type { Firestore, Transaction } from "firebase-admin/firestore";
import {
  HEROES_COLLECTION,
  HERO_EVENTS_SUBCOLLECTION,
  appendHeroEventInTx,
  clearHeroForArmageddonInTx,
  heroEvent,
  heroEventsCollection,
  markHeroDeceasedInTx,
  transferHeroOwnerInTx,
  upsertHeroInTx,
  viewerWasOwner,
} from "@/lib/game/hero-registry";
import type { GameHero } from "@/lib/game/types";

function fakeRef(): unknown {
  return { __fakeRef: true };
}

function fakeDb() {
  const collectionCalls: string[] = [];
  const docCalls: string[] = [];
  const db = {
    collection: (name: string) => {
      collectionCalls.push(name);
      return {
        doc: (id: string) => {
          docCalls.push(`${name}/${id}`);
          return {
            __fakeRef: true,
            collection: (sub: string) => {
              collectionCalls.push(`${name}/${id}/${sub}`);
              return {
                doc: (eid: string) => {
                  docCalls.push(`${name}/${id}/${sub}/${eid}`);
                  return { __fakeRef: true };
                },
                where: () => ({
                  limit: () => ({
                    get: async () => ({ empty: false }),
                  }),
                }),
              };
            },
          };
        },
      };
    },
  } as unknown as Firestore;
  return { db, collectionCalls, docCalls };
}

function fakeTx() {
  const sets: Array<{ ref: unknown; data: Record<string, unknown>; opts?: unknown }> = [];
  const tx = {
    set: (ref: unknown, data: Record<string, unknown>, opts?: unknown) => {
      sets.push({ ref, data, opts });
    },
  } as unknown as Transaction;
  return { tx, sets };
}

describe("hero-registry — constants + ref helpers", () => {
  it("exposes collection + subcollection names", () => {
    expect(HEROES_COLLECTION).toBe("game_heroes");
    expect(HERO_EVENTS_SUBCOLLECTION).toBe("events");
  });

  it("heroEventsCollection points at game_heroes/{id}/events", () => {
    const { db, collectionCalls } = fakeDb();
    heroEventsCollection(db, "h-1");
    expect(collectionCalls).toContain("game_heroes");
    expect(collectionCalls).toContain("game_heroes/h-1/events");
  });
});

describe("hero-registry — InTx writers", () => {
  const baseHero: GameHero = {
    id: "h-1",
    name: "Aria",
    class: "warrior",
    specialty: "siege",
    caste: "red",
    ownerId: "u-owner",
    tileId: "tile-1",
    stamina: 5,
    staminaMax: 10,
    emergedAtTurn: 10,
  } as unknown as GameHero;

  describe("upsertHeroInTx", () => {
    it("writes a merge: true patch with the hero fields", () => {
      const { db } = fakeDb();
      const { tx, sets } = fakeTx();
      upsertHeroInTx({ tx, db, hero: baseHero, seasonNumber: 3, now: new Date("2026-01-01") });
      expect(sets).toHaveLength(1);
      expect(sets[0].opts).toEqual({ merge: true });
      const data = sets[0].data;
      expect(data.id).toBe("h-1");
      expect(data.currentOwnerId).toBe("u-owner");
      expect(data.currentTileId).toBe("tile-1");
      expect(data.emergedSeasonNumber).toBe(3);
      expect(data.isDeceased).toBe(false);
      expect(data.awaitingResurrection).toBe(false);
    });
  });

  describe("appendHeroEventInTx", () => {
    it("writes the event under the hero's events subcollection and returns the id", () => {
      const { db } = fakeDb();
      const { tx, sets } = fakeTx();
      const id = appendHeroEventInTx({
        tx,
        db,
        heroId: "h-1",
        event: heroEvent.emerged({ tileId: "t-1", ownerId: "u-1" } as GameHero, 1),
        now: new Date("2026-01-01"),
      });
      expect(typeof id).toBe("string");
      // Two sets: the event doc, then the parent hero's lastEventAt bump.
      expect(sets.length).toBeGreaterThanOrEqual(1);
      const eventWrite = sets[0];
      const ev = eventWrite.data;
      expect(ev.id).toBe(id);
      expect(ev.kind).toBe("emerged");
      expect(ev.tileId).toBe("t-1");
    });

    it("strips undefined optional fields from the event payload", () => {
      const { db } = fakeDb();
      const { tx, sets } = fakeTx();
      appendHeroEventInTx({
        tx,
        db,
        heroId: "h-1",
        event: heroEvent.emerged({ tileId: "t-1", ownerId: "u-1" } as GameHero, 1),
        now: new Date(),
      });
      const ev = sets[0].data;
      // emerged events have no attackerId / defenderId / outcome
      expect("attackerId" in ev).toBe(false);
      expect("defenderId" in ev).toBe(false);
      expect("outcome" in ev).toBe(false);
    });
  });

  describe("markHeroDeceasedInTx", () => {
    it("sets deceased flags and clears location fields", () => {
      const { db } = fakeDb();
      const { tx, sets } = fakeTx();
      markHeroDeceasedInTx({
        tx,
        db,
        heroId: "h-1",
        deceasedTileId: "tile-9",
        now: new Date("2026-01-01"),
      });
      const d = sets[0].data;
      expect(d.isDeceased).toBe(true);
      expect(d.awaitingResurrection).toBe(false);
      expect(d.deceasedTileId).toBe("tile-9");
      expect(d.currentTileId).toBeNull();
      expect(d.currentOwnerId).toBeNull();
      expect(d.stamina).toBe(0);
    });
  });

  describe("transferHeroOwnerInTx", () => {
    it("patches ownerId, tileId and stamina with merge: true", () => {
      const { db } = fakeDb();
      const { tx, sets } = fakeTx();
      transferHeroOwnerInTx({
        tx,
        db,
        heroId: "h-1",
        newOwnerId: "u-new",
        newTileId: "tile-new",
        newStamina: 7,
        now: new Date(),
      });
      expect(sets[0].opts).toEqual({ merge: true });
      expect(sets[0].data.currentOwnerId).toBe("u-new");
      expect(sets[0].data.currentTileId).toBe("tile-new");
      expect(sets[0].data.stamina).toBe(7);
    });
  });

  describe("clearHeroForArmageddonInTx", () => {
    it("flips alive heroes to limbo (awaitingResurrection)", () => {
      const { db } = fakeDb();
      const { tx, sets } = fakeTx();
      clearHeroForArmageddonInTx({
        tx,
        db,
        heroId: "h-1",
        seasonNumber: 4,
        wasAlive: true,
        tileIdAtSeasonEnd: "tile-9",
        ownerIdAtSeasonEnd: "u-9",
        now: new Date(),
      });
      expect(sets[0].data.awaitingResurrection).toBe(true);
      expect(sets[0].data.currentOwnerId).toBeNull();
      expect(sets[0].data.currentTileId).toBeNull();
    });

    it("is a no-op for deceased heroes (no tx.set)", () => {
      const { db } = fakeDb();
      const { tx, sets } = fakeTx();
      clearHeroForArmageddonInTx({
        tx,
        db,
        heroId: "h-1",
        seasonNumber: 4,
        wasAlive: false,
        tileIdAtSeasonEnd: "tile-9",
        ownerIdAtSeasonEnd: "u-9",
        now: new Date(),
      });
      expect(sets).toHaveLength(0);
    });
  });
});

describe("hero-registry — heroEvent payload builders", () => {
  it("emerged carries kind + tileId + ownerIdAtTime + seasonNumber", () => {
    const ev = heroEvent.emerged({ tileId: "t", ownerId: "o" } as GameHero, 5);
    expect(ev).toMatchObject({
      kind: "emerged",
      tileId: "t",
      ownerIdAtTime: "o",
      seasonNumber: 5,
    });
  });

  it("engagedAttacker carries combat-specific fields", () => {
    const ev = heroEvent.engagedAttacker({
      tileId: "t",
      ownerIdAtTime: "o",
      defenderId: "d",
      targetTileId: "tt",
      outcome: "victory",
      seasonNumber: 1,
    });
    expect(ev).toMatchObject({
      kind: "engaged_attacker",
      defenderId: "d",
      targetTileId: "tt",
      outcome: "victory",
    });
  });

  it("engagedDefender carries attackerId + outcome", () => {
    const ev = heroEvent.engagedDefender({
      tileId: "t",
      ownerIdAtTime: "o",
      attackerId: "a",
      outcome: "loss",
      seasonNumber: 1,
    });
    expect(ev).toMatchObject({
      kind: "engaged_defender",
      attackerId: "a",
      outcome: "loss",
    });
  });

  it("slain carries attackerId", () => {
    const ev = heroEvent.slain({
      tileId: "t",
      ownerIdAtTime: "o",
      attackerId: "a",
      seasonNumber: 1,
    });
    expect(ev).toMatchObject({ kind: "slain", attackerId: "a" });
  });

  it("defected sets ownerIdAtTime = fromOwnerId", () => {
    const ev = heroEvent.defected({
      tileId: "t",
      fromOwnerId: "f",
      toOwnerId: "to",
      seasonNumber: 1,
    });
    expect(ev.ownerIdAtTime).toBe("f");
    expect(ev).toMatchObject({ kind: "defected", fromOwnerId: "f", toOwnerId: "to" });
  });

  it("movedOnCapture carries fromTileId", () => {
    const ev = heroEvent.movedOnCapture({
      tileId: "to",
      fromTileId: "from",
      ownerIdAtTime: "o",
      seasonNumber: 1,
    });
    expect(ev).toMatchObject({ kind: "moved_on_capture", fromTileId: "from" });
  });

  it("spellCast carries spellId + targetTileId", () => {
    const ev = heroEvent.spellCast({
      tileId: "t",
      ownerIdAtTime: "o",
      spellId: "fireball",
      targetTileId: "tt",
      seasonNumber: 1,
    });
    expect(ev).toMatchObject({ kind: "spell_cast", spellId: "fireball", targetTileId: "tt" });
  });

  it("recruited carries unitType + unitsBuilt", () => {
    const ev = heroEvent.recruited({
      tileId: "t",
      ownerIdAtTime: "o",
      unitType: "ground" as unknown as ReturnType<typeof heroEvent.recruited>["unitType"],
      unitsBuilt: 25,
      seasonNumber: 1,
    });
    expect(ev).toMatchObject({ kind: "recruited", unitsBuilt: 25 });
  });

  it("specialUnitSummoned carries specialUnitDefId", () => {
    const ev = heroEvent.specialUnitSummoned({
      tileId: "t",
      ownerIdAtTime: "o",
      specialUnitDefId: "dragon",
      seasonNumber: 1,
    });
    expect(ev).toMatchObject({ kind: "special_unit_summoned", specialUnitDefId: "dragon" });
  });

  it("seasonEnded accepts a null ownerIdAtTime (deceased heroes)", () => {
    const ev = heroEvent.seasonEnded({ tileId: "t", ownerIdAtTime: null, seasonNumber: 1 });
    expect(ev).toMatchObject({ kind: "season_ended", ownerIdAtTime: null });
  });
});

describe("hero-registry — viewerWasOwner", () => {
  it("returns true when at least one event has ownerIdAtTime == viewer", async () => {
    const db = {
      collection: () => ({
        doc: () => ({
          collection: () => ({
            where: () => ({
              limit: () => ({
                get: async () => ({ empty: false }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as Firestore;
    expect(await viewerWasOwner(db, "h-1", "u-1")).toBe(true);
  });

  it("returns false when the query returns no events", async () => {
    const db = {
      collection: () => ({
        doc: () => ({
          collection: () => ({
            where: () => ({
              limit: () => ({
                get: async () => ({ empty: true }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as Firestore;
    expect(await viewerWasOwner(db, "h-1", "u-1")).toBe(false);
  });
});
