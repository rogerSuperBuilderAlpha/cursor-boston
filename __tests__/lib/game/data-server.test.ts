/**
 * @jest-environment node
 */

/**
 * Unit tests for the pure helpers and exported error classes in
 * lib/game/data-server.ts. The full server-mutation surface in this 4800-line
 * module is out of scope for a single PR; this batch covers the safe-to-test
 * pieces: constants, the one pure helper, the error-class constructors, and
 * the three simplest read functions (getPlayerServer, getOwnedTilesServer,
 * getTileServer).
 */

import {
  BUILD_UNITS_PER_TURN,
  BUILD_UNITS_PER_TURN_BY_LAND,
  unitsPerTurnForLand,
  ATTACK_TURN_COST,
  SPELL_TURN_COST,
  BUILD_UNITS_TURN_COST,
  SIEGE_TURN_COST,
  FAR_EXPEDITION_TURN_COST,
  GamePlayerNotFoundError,
  GamePlayerAlreadyExistsError,
  GameTileNotFoundError,
  GameInvalidPhaseError,
  GameInsufficientTurnsError,
  GameTileFullError,
  GameUnitCapExceededError,
  GameTileTypeError,
  GameInvalidSpellError,
  GameInvalidLandTypeError,
  GameInvalidCasteError,
  GameShieldedError,
  GameCasteChangeUnavailableError,
  GameInvalidNameError,
  getPlayerServer,
  getOwnedTilesServer,
  getTileServer,
} from "@/lib/game/data-server";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

const mockAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("turn-cost constants", () => {
  it("exports the documented turn-cost constants", () => {
    expect(ATTACK_TURN_COST).toBe(1);
    expect(SPELL_TURN_COST).toBe(5);
    expect(BUILD_UNITS_TURN_COST).toBe(5);
    expect(SIEGE_TURN_COST).toBe(5);
    expect(FAR_EXPEDITION_TURN_COST).toBe(2);
    expect(BUILD_UNITS_PER_TURN).toBe(10);
  });
});

describe("unitsPerTurnForLand", () => {
  it("returns 10 for military tiles (the documented military baseline)", () => {
    expect(unitsPerTurnForLand("military")).toBe(10);
  });

  it("returns 5 for food tiles (half military rate, May 2026 rework)", () => {
    expect(unitsPerTurnForLand("food")).toBe(5);
  });

  it("returns 5 for magic tiles (half military rate)", () => {
    expect(unitsPerTurnForLand("magic")).toBe(5);
  });

  it("returns 0 for unassigned tiles", () => {
    expect(unitsPerTurnForLand("unassigned")).toBe(0);
  });

  it("returns 0 for unrevealed tiles", () => {
    expect(unitsPerTurnForLand("unrevealed")).toBe(0);
  });

  it("returns 0 for unknown land types (defensive default)", () => {
    expect(unitsPerTurnForLand("nonsense" as any)).toBe(0);
  });

  it("exposes the per-land table that the helper reads", () => {
    expect(BUILD_UNITS_PER_TURN_BY_LAND).toEqual({
      unrevealed: 0,
      unassigned: 0,
      military: 10,
      food: 5,
      magic: 5,
    });
  });
});

describe("Game error classes — name and message", () => {
  it("GamePlayerNotFoundError carries the right name and message", () => {
    const e = new GamePlayerNotFoundError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("GamePlayerNotFoundError");
    expect(e.message).toBe("Game player not found");
  });

  it("GamePlayerAlreadyExistsError carries the right name and message", () => {
    const e = new GamePlayerAlreadyExistsError();
    expect(e.name).toBe("GamePlayerAlreadyExistsError");
    expect(e.message).toBe("Game player already exists");
  });

  it("GameTileNotFoundError carries the right name and message", () => {
    const e = new GameTileNotFoundError();
    expect(e.name).toBe("GameTileNotFoundError");
    expect(e.message).toBe("Tile not found");
  });

  it("GameInvalidPhaseError interpolates expected and actual phases", () => {
    const e = new GameInvalidPhaseError("explore", "distribute");
    expect(e.name).toBe("GameInvalidPhaseError");
    expect(e.message).toBe("Invalid phase: expected explore, got distribute");
  });

  it("GameInsufficientTurnsError interpolates required and have counts", () => {
    const e = new GameInsufficientTurnsError(5, 2);
    expect(e.message).toBe("Insufficient turns: need 5, have 2");
  });

  it("GameTileFullError exposes availableSpace and requested as instance fields", () => {
    const e = new GameTileFullError(3, 10);
    expect(e.availableSpace).toBe(3);
    expect(e.requested).toBe(10);
    expect(e.message).toContain("3");
    expect(e.message).toContain("10");
  });

  it("GameUnitCapExceededError exposes cap and currentTotal as instance fields", () => {
    const e = new GameUnitCapExceededError(100, 110);
    expect(e.cap).toBe(100);
    expect(e.currentTotal).toBe(110);
    expect(e.message).toContain("110/100");
  });

  it("GameTileTypeError interpolates expected and got", () => {
    const e = new GameTileTypeError("food", "military");
    expect(e.message).toBe("Tile must be food, got military");
  });

  it("GameInvalidSpellError takes a freeform reason", () => {
    const e = new GameInvalidSpellError("not enough mana");
    expect(e.message).toBe("Invalid spell: not enough mana");
  });

  it("GameInvalidLandTypeError takes a type string", () => {
    const e = new GameInvalidLandTypeError("zelda");
    expect(e.message).toContain("zelda");
  });

  it("GameInvalidCasteError takes a caste string", () => {
    const e = new GameInvalidCasteError("purple");
    expect(e.message).toContain("purple");
  });

  it("GameShieldedError takes 'attacker' or 'defender' side", () => {
    expect(new GameShieldedError("attacker").message).toContain("attacker");
    expect(new GameShieldedError("defender").message).toContain("defender");
  });

  it("GameCasteChangeUnavailableError takes a reason", () => {
    const e = new GameCasteChangeUnavailableError("week 0 lockout");
    expect(e.message).toContain("week 0 lockout");
  });

  it("GameInvalidNameError takes a reason", () => {
    const e = new GameInvalidNameError("too long");
    expect(e.message).toContain("too long");
  });
});

describe("getPlayerServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildPlayerDb(opts: { exists: boolean; data?: any }) {
    const docRef = {
      get: jest.fn().mockResolvedValue({
        exists: opts.exists,
        data: () => opts.data,
      }),
    };
    const db: any = {
      collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })),
    };
    return { db };
  }

  it("returns the player data when the doc exists", async () => {
    const { db } = buildPlayerDb({
      exists: true,
      data: { userId: "u1", turnsRemaining: 10 },
    });
    mockAdminDb.mockReturnValue(db);
    const result = await getPlayerServer("u1");
    expect(result).toEqual({ userId: "u1", turnsRemaining: 10 });
  });

  it("returns null when the doc does not exist", async () => {
    const { db } = buildPlayerDb({ exists: false });
    mockAdminDb.mockReturnValue(db);
    const result = await getPlayerServer("u1");
    expect(result).toBeNull();
  });

  it("throws when Firebase Admin is not configured", async () => {
    mockAdminDb.mockReturnValue(null as any);
    await expect(getPlayerServer("u1")).rejects.toThrow("Firebase Admin");
  });
});

describe("getTileServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns tile data when the doc exists", async () => {
    const docRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ tileId: "t1", q: 0, r: 0, type: "military" }),
      }),
    };
    const db: any = {
      collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })),
    };
    mockAdminDb.mockReturnValue(db);
    const result = await getTileServer("t1");
    expect(result).toEqual({ tileId: "t1", q: 0, r: 0, type: "military" });
  });

  it("returns null when the tile does not exist", async () => {
    const docRef = {
      get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
    };
    const db: any = {
      collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })),
    };
    mockAdminDb.mockReturnValue(db);
    const result = await getTileServer("t1");
    expect(result).toBeNull();
  });
});

describe("getOwnedTilesServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // After the BASE+SUPER redesign, getOwnedTilesServer also fetches the
  // owner's player doc for lazy-regen and may fire-and-forget tile updates.
  // The mock builder below stubs both paths so the unit tests stay tight.
  function buildOwnedTilesMockDb(tileDocs: Array<{ data: () => unknown }>) {
    const get = jest.fn().mockResolvedValue({ docs: tileDocs });
    const where = jest.fn().mockReturnValue({ get });
    const tileDoc = jest.fn(() => ({ update: jest.fn().mockResolvedValue(undefined) }));
    const playerDoc = jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
    }));
    const collection = jest.fn((name: string) => {
      if (name === "game_players") return { doc: playerDoc };
      return { where, doc: tileDoc };
    });
    return { db: { collection } as any, where };
  }

  it("returns an empty array when the player owns no tiles", async () => {
    const { db, where } = buildOwnedTilesMockDb([]);
    mockAdminDb.mockReturnValue(db);
    const result = await getOwnedTilesServer("u1");
    expect(result).toEqual([]);
    expect(where).toHaveBeenCalledWith("ownerId", "==", "u1");
  });

  it("returns mapped tile data for each owned tile", async () => {
    const docs = [
      { data: () => ({ tileId: "t1", ownerId: "u1", q: 0, r: 0, type: "military" }) },
      { data: () => ({ tileId: "t2", ownerId: "u1", q: 1, r: 0, type: "food" }) },
    ];
    const { db } = buildOwnedTilesMockDb(docs);
    mockAdminDb.mockReturnValue(db);
    const result = await getOwnedTilesServer("u1");
    expect(result).toHaveLength(2);
    expect(result[0].tileId).toBe("t1");
    expect(result[1].tileId).toBe("t2");
  });
});
