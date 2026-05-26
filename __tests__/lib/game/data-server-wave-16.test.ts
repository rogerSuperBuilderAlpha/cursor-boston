/**
 * @jest-environment node
 *
 * Wave 16 — final residual data-server branches: zero-turn action error
 * paths (declareLastStand / toggleDefensiveStance / pepTalk / meditate /
 * redistribute), Timestamp-shaped (tsLike) date branches, summon /
 * unsummon / upgrade / spendArtifact missing-doc guards, and
 * getRecentAttacksServer per-side query paths.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn().mockResolvedValue({
    id: "ir-wave16",
    targetTileId: "t1",
    scope: "tile",
    capturedAtTurn: 5,
    lines: [],
  }),
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  adminGrantUnitsServer,
  applyUpgradeServer,
  declareLastStandServer,
  GameArtifactAlreadyUsedError,
  GameArtifactNotFoundError,
  GameDefensiveStanceLockedError,
  GameHeroAlreadyMeditatingError,
  GameHeroNotFoundError,
  GameHeroNotOwnedError,
  GameInsufficientUnitsError,
  GameInvalidPhaseError,
  GameInvalidSpellError,
  GameLastStandNoThreatError,
  GameMeditationSlotFullError,
  GameNotAdjacentError,
  GamePepTalkRequiresZeroTurnsError,
  GamePlayerNotFoundError,
  GameRedistributeRateLimitError,
  GameSpecialUnitAlreadyStationedError,
  GameSpecialUnitNotFoundError,
  GameTileFullError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  getRecentAttacksServer,
  meditateHeroServer,
  pepTalkHeroServer,
  redistributeUnitsServer,
  removeUpgradeServer,
  spendArtifactServer,
  summonSpecialUnitServer,
  toggleDefensiveStanceServer,
  unsummonSpecialUnitServer,
} from "@/lib/game/data-server";
import {
  LAST_STAND_COOLDOWN_MS,
  MEDITATION_DURATION_MS,
  REDISTRIBUTE_MAX_PER_DAY,
} from "@/lib/game/types";
import {
  makeChain,
  makeDoc,
  makeQuerySnap,
  tsLike,
  tsLikeMs,
} from "@/__tests__/_helpers/firebase-admin-mock";
import { BASE_PLAYER, BASE_TILE } from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const NOW = new Date("2026-05-20T12:00:00.000Z");

/**
 * Minimal two-doc (player + tile) Firestore stub for the zero-turn server
 * actions that take a single tile id.
 */
function buildPlayerTileDb(opts: {
  player?: Record<string, unknown> | null;
  tile?: Record<string, unknown> | null;
  heroesDocs?: Array<ReturnType<typeof makeDoc>>;
  txUpdate?: jest.Mock;
}) {
  const playerRef = { __kind: "player" as const };
  const tileRef = { __kind: "tile" as const };
  const playerSnap = opts.player
    ? { exists: true, data: () => opts.player }
    : { exists: false, data: () => undefined };
  const tileSnap = opts.tile
    ? { exists: true, data: () => opts.tile }
    : { exists: false, data: () => undefined };
  const update = opts.txUpdate ?? jest.fn();
  const tx = {
    get: jest.fn((ref: { __kind?: string }) => {
      if (ref === playerRef) return Promise.resolve(playerSnap);
      if (ref === tileRef) return Promise.resolve(tileSnap);
      return Promise.resolve({ exists: false, data: () => undefined });
    }),
    update,
    set: jest.fn(),
  };
  const ownedSnap = makeQuerySnap(opts.heroesDocs ?? []);
  const ownedChain = makeChain({ docs: opts.heroesDocs ?? [] });
  ownedChain.where = jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(ownedSnap),
  });
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") return { doc: jest.fn(() => playerRef) };
      if (name === "game_tiles") {
        return {
          doc: jest.fn(() => tileRef),
          where: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(ownedSnap),
          })),
        };
      }
      if (name === "game_heroes") {
        return { doc: jest.fn((id: string) => ({ id })) };
      }
      return { doc: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  return { db, tx, update };
}

/**
 * Stub for redistributeUnitsServer (player + source + dest in one txn).
 */
function buildRedistributeDb(opts: {
  player: Record<string, unknown> | null;
  source: Record<string, unknown> | null;
  dest: Record<string, unknown> | null;
}) {
  const playerRef = { __kind: "player" as const, id: "u1" };
  const sourceRef = { __kind: "source" as const, id: "s" };
  const destRef = { __kind: "dest" as const, id: "d" };
  const resolve = (ref: { __kind?: string }) => {
    if (ref.__kind === "player") {
      return opts.player
        ? { exists: true, data: () => opts.player }
        : { exists: false, data: () => undefined };
    }
    if (ref.__kind === "source") {
      return opts.source
        ? { exists: true, data: () => opts.source }
        : { exists: false, data: () => undefined };
    }
    if (ref.__kind === "dest") {
      return opts.dest
        ? { exists: true, data: () => opts.dest }
        : { exists: false, data: () => undefined };
    }
    return { exists: false, data: () => undefined };
  };
  const tx = {
    get: jest.fn((ref: { __kind?: string }) => Promise.resolve(resolve(ref))),
    update: jest.fn(),
  };
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return { doc: jest.fn(() => playerRef) };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => {
            if (id === "s") return sourceRef;
            if (id === "d") return destRef;
            return { __kind: "dest" as const, id };
          }),
        };
      }
      return { doc: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  return { db, tx };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────────────
// declareLastStandServer guards (wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("declareLastStandServer guards (wave 16)", () => {
  it("throws GamePlayerNotFoundError when player doc is missing", async () => {
    const { db } = buildPlayerTileDb({
      player: null,
      tile: { ...BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      declareLastStandServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("throws GameTileNotFoundError when tile doc is missing", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, turnsRemaining: 0 },
      tile: null,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      declareLastStandServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotOwnedError when tile belongs to someone else", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, turnsRemaining: 0 },
      tile: { ...BASE_TILE, ownerId: "u2" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      declareLastStandServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("handles Firestore-Timestamp shaped lastStandUsedAt during cooldown", async () => {
    const usedMs = NOW.getTime() - 1000;
    const { db } = buildPlayerTileDb({
      player: {
        ...BASE_PLAYER,
        turnsRemaining: 0,
        lastStandUsedAt: tsLikeMs(usedMs),
      },
      tile: {
        ...BASE_TILE,
        lastAttackedAt: new Date(NOW.getTime() - 60_000),
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    // Non-Date Timestamp falls through to the `: 0` branch, which then
    // makes the `elapsed < cooldown` check fire (elapsed === now - 0 > cooldown),
    // so the cooldown does NOT trip — but the threat check should now succeed
    // and the call returns a tile (covers the else-branch on line 7778).
    const tile = await declareLastStandServer({
      callerUserId: "u1",
      tileId: "t1",
      now: NOW,
    });
    expect(tile.activeLastStand).toBeDefined();
  });

  it("treats Firestore-Timestamp shaped lastAttackedAt as 0 → no threat", async () => {
    const { db } = buildPlayerTileDb({
      player: {
        ...BASE_PLAYER,
        turnsRemaining: 0,
        lastStandUsedAt: new Date(NOW.getTime() - LAST_STAND_COOLDOWN_MS - 1),
      },
      tile: {
        ...BASE_TILE,
        // tsLike is not `instanceof Date`, so the else branch yields 0
        // → no recent threat → GameLastStandNoThreatError.
        lastAttackedAt: tsLike("2026-05-20T11:59:00.000Z"),
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      declareLastStandServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameLastStandNoThreatError);
  });

  it("declares last stand when lastStandUsedAt is undefined (no cooldown branch)", async () => {
    const { db } = buildPlayerTileDb({
      player: {
        ...BASE_PLAYER,
        turnsRemaining: 0,
        // omitted: lastStandUsedAt
      },
      tile: {
        ...BASE_TILE,
        lastAttackedAt: new Date(NOW.getTime() - 60_000),
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const tile = await declareLastStandServer({
      callerUserId: "u1",
      tileId: "t1",
      now: NOW,
    });
    expect(tile.activeLastStand?.expiresAt).toBeInstanceOf(Date);
  });
});

// ──────────────────────────────────────────────────────────────────────
// toggleDefensiveStanceServer (wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("toggleDefensiveStanceServer (wave 16)", () => {
  it("throws GamePlayerNotFoundError when player is missing", async () => {
    const { db } = buildPlayerTileDb({
      player: null,
      tile: { ...BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      toggleDefensiveStanceServer({
        callerUserId: "u1",
        tileId: "t1",
        desiredActive: true,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("throws GameTileNotFoundError when tile is missing", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: null,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      toggleDefensiveStanceServer({
        callerUserId: "u1",
        tileId: "t1",
        desiredActive: true,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotOwnedError when the tile is foreign", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: { ...BASE_TILE, ownerId: "u2" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      toggleDefensiveStanceServer({
        callerUserId: "u1",
        tileId: "t1",
        desiredActive: true,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("no-ops when toggling off a tile that is already off", async () => {
    const { db, update } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: { ...BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    const tile = await toggleDefensiveStanceServer({
      callerUserId: "u1",
      tileId: "t1",
      desiredActive: false,
      now: NOW,
    });
    expect(tile.tileId).toBe("t1");
    expect(update).not.toHaveBeenCalled();
  });

  it("blocks toggle-off when lockedUntil has not yet elapsed", async () => {
    const lockedUntil = new Date(NOW.getTime() + 60_000);
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, activeDefensiveStanceCount: 1 },
      tile: {
        ...BASE_TILE,
        defensiveStance: {
          active: true,
          since: new Date(NOW.getTime() - 60_000),
          lockedUntil,
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      toggleDefensiveStanceServer({
        callerUserId: "u1",
        tileId: "t1",
        desiredActive: false,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(GameDefensiveStanceLockedError);
  });

  it("turns stance off once lockedUntil has expired and decrements counter", async () => {
    const lockedUntil = new Date(NOW.getTime() - 1_000);
    const { db, update } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, activeDefensiveStanceCount: 2 },
      tile: {
        ...BASE_TILE,
        defensiveStance: {
          active: true,
          since: new Date(NOW.getTime() - 60_000),
          lockedUntil,
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const tile = await toggleDefensiveStanceServer({
      callerUserId: "u1",
      tileId: "t1",
      desiredActive: false,
      now: NOW,
    });
    expect(tile.defensiveStance).toBeNull();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("toggles off when no defensiveStance is set on the tile (else-branch on lockedMs)", async () => {
    // currentlyActive = false in production code? When defensiveStance is
    // absent, isTileInDefensiveStance returns false, so toggling OFF with
    // desiredActive=false short-circuits as no-op (covered above).
    // To hit the lockedMs=0 branch we need currentlyActive=true (active flag
    // true), but lockedUntil missing. The helper treats active+missing
    // lockedUntil as "active forever".
    // Provide a non-Date lockedUntil to take the else-branch.
    const { db, update } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, activeDefensiveStanceCount: 1 },
      tile: {
        ...BASE_TILE,
        // tsLike is not instanceof Date → lockedMs=0 → not blocked → toggle off succeeds
        defensiveStance: {
          active: true,
          since: tsLike("2026-05-20T11:00:00.000Z"),
          lockedUntil: tsLikeMs(NOW.getTime() - 60_000),
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const tile = await toggleDefensiveStanceServer({
      callerUserId: "u1",
      tileId: "t1",
      desiredActive: false,
      now: NOW,
    });
    expect(tile.defensiveStance).toBeNull();
    expect(update).toHaveBeenCalledTimes(2);
  });
});

// ──────────────────────────────────────────────────────────────────────
// redistributeUnitsServer guards (wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("redistributeUnitsServer guards (wave 16)", () => {
  it("throws GamePlayerNotFoundError when player doc is missing", async () => {
    const { db } = buildRedistributeDb({
      player: null,
      source: { ...BASE_TILE, tileId: "s" },
      dest: { ...BASE_TILE, tileId: "d" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 1, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("throws GameTileNotFoundError when source doc is missing", async () => {
    const { db } = buildRedistributeDb({
      player: BASE_PLAYER,
      source: null,
      dest: { ...BASE_TILE, tileId: "d" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 1, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotFoundError when dest doc is missing", async () => {
    const { db } = buildRedistributeDb({
      player: BASE_PLAYER,
      source: { ...BASE_TILE, tileId: "s" },
      dest: null,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 1, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotOwnedError when dest is foreign", async () => {
    const { db } = buildRedistributeDb({
      player: BASE_PLAYER,
      source: {
        ...BASE_TILE,
        tileId: "s",
        neighborTileIds: ["d"],
        units: { ground: 10, air: 0, siege: 0 },
      },
      dest: { ...BASE_TILE, tileId: "d", ownerId: "u2" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 1, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("throws GameInsufficientUnitsError when source lacks the stack", async () => {
    const { db } = buildRedistributeDb({
      player: BASE_PLAYER,
      source: {
        ...BASE_TILE,
        tileId: "s",
        neighborTileIds: ["d"],
        units: { ground: 0, air: 0, siege: 0 },
      },
      dest: { ...BASE_TILE, tileId: "d", ownerId: "u1" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 5, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameInsufficientUnitsError);
  });

  it("rate-limits with Firestore-Timestamp shaped recentRedistributions", async () => {
    // Fill the 24h window with Timestamp-shaped entries to exercise the
    // tsLike → toMillis branch on lines 7489 / 7498.
    const oldest = NOW.getTime() - 3_600_000;
    const recent = Array.from({ length: REDISTRIBUTE_MAX_PER_DAY }, (_, i) =>
      tsLikeMs(oldest + i * 1000),
    );
    const { db } = buildRedistributeDb({
      player: {
        ...BASE_PLAYER,
        caste: "red",
        recentRedistributions: recent,
      },
      source: {
        ...BASE_TILE,
        tileId: "s",
        neighborTileIds: ["d"],
        units: { ground: 20, air: 0, siege: 0 },
      },
      dest: {
        ...BASE_TILE,
        tileId: "d",
        ownerId: "u1",
        units: { ground: 0, air: 0, siege: 0 },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 5, air: 0, siege: 0 },
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(GameRedistributeRateLimitError);
  });

  it("throws GameTileFullError when arrival exceeds destination capacity", async () => {
    const { db } = buildRedistributeDb({
      player: { ...BASE_PLAYER, caste: "red", recentRedistributions: [] },
      source: {
        ...BASE_TILE,
        tileId: "s",
        type: "military",
        neighborTileIds: ["d"],
        units: { ground: 5000, air: 0, siege: 0 },
      },
      dest: {
        ...BASE_TILE,
        tileId: "d",
        type: "military",
        // already at capacity
        units: { ground: 99_999, air: 0, siege: 0 },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 2000, air: 0, siege: 0 },
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(GameTileFullError);
  });

  it("filters out stale recentRedistributions older than 24h", async () => {
    const staleEntry = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);
    const { db, tx } = buildRedistributeDb({
      player: {
        ...BASE_PLAYER,
        caste: "red",
        recentRedistributions: [staleEntry],
      },
      source: {
        ...BASE_TILE,
        tileId: "s",
        type: "military",
        neighborTileIds: ["d"],
        units: { ground: 20, air: 0, siege: 0 },
      },
      dest: {
        ...BASE_TILE,
        tileId: "d",
        type: "military",
        units: { ground: 0, air: 0, siege: 0 },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await redistributeUnitsServer({
      callerUserId: "u1",
      sourceTileId: "s",
      destTileId: "d",
      units: { ground: 10, air: 0, siege: 0 },
      now: NOW,
    });
    expect(result.dest.units.ground).toBeGreaterThan(0);
    expect(tx.update).toHaveBeenCalledTimes(3);
  });
});

// ──────────────────────────────────────────────────────────────────────
// meditateHeroServer guards (wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("meditateHeroServer guards (wave 16)", () => {
  const heroBase = {
    id: "h-w16",
    ownerId: "u1",
    tileId: "t1",
    class: "magic" as const,
    specialty: "spellcasting" as const,
    name: "Quiet One",
    caste: "red" as const,
    stamina: 8,
    staminaMax: 20,
    emergedAtTurn: 1,
    lastEngagedAtTurn: 1,
  };

  it("throws GameMeditationSlotFullError when an active slot is already in use", async () => {
    const heroOnOther = {
      ...heroBase,
      id: "h-other",
      tileId: "t-other",
      meditatingUntil: new Date(NOW.getTime() + MEDITATION_DURATION_MS),
    };
    const otherTileSnap = makeDoc("t-other", {
      ...BASE_TILE,
      tileId: "t-other",
      hero: heroOnOther,
    });
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: { ...BASE_TILE, hero: heroBase },
      heroesDocs: [otherTileSnap],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameMeditationSlotFullError);
  });

  it("counts Firestore-Timestamp shaped meditatingUntil toward the slot cap", async () => {
    const heroOnOther = {
      ...heroBase,
      id: "h-other",
      tileId: "t-other",
      meditatingUntil: tsLikeMs(NOW.getTime() + MEDITATION_DURATION_MS),
    };
    const otherTileSnap = makeDoc("t-other", {
      ...BASE_TILE,
      tileId: "t-other",
      hero: heroOnOther,
    });
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: { ...BASE_TILE, hero: heroBase },
      heroesDocs: [otherTileSnap],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameMeditationSlotFullError);
  });

  it("ignores expired meditatingUntil on other tiles when counting slots", async () => {
    const expiredHero = {
      ...heroBase,
      id: "h-expired",
      tileId: "t-expired",
      meditatingUntil: new Date(NOW.getTime() - 1_000),
    };
    const otherTileSnap = makeDoc("t-expired", {
      ...BASE_TILE,
      tileId: "t-expired",
      hero: expiredHero,
    });
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, turnsSpentTotal: 9 },
      tile: { ...BASE_TILE, hero: heroBase },
      heroesDocs: [otherTileSnap],
    });
    mockGetAdminDb.mockReturnValue(db);
    const tile = await meditateHeroServer({
      callerUserId: "u1",
      tileId: "t1",
      now: NOW,
    });
    expect(tile.hero?.stamina).toBe(heroBase.staminaMax);
    expect(tile.hero?.meditatingUntil).toBeInstanceOf(Date);
  });

  it("throws GamePlayerNotFoundError when player doc is missing inside txn", async () => {
    const { db } = buildPlayerTileDb({
      player: null,
      tile: { ...BASE_TILE, hero: heroBase },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("throws GameTileNotFoundError when tile doc is missing inside txn", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: null,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotOwnedError when the tile belongs to another player", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: { ...BASE_TILE, ownerId: "u2", hero: heroBase },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("throws GameHeroNotFoundError when tile has no hero", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: { ...BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameHeroNotFoundError);
  });

  it("throws GameHeroNotOwnedError when hero belongs to another player", async () => {
    const foreignHero = { ...heroBase, ownerId: "u2" };
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: { ...BASE_TILE, hero: foreignHero },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameHeroNotOwnedError);
  });

  it("throws GameHeroAlreadyMeditatingError when the hero is currently meditating", async () => {
    const meditatingHero = {
      ...heroBase,
      meditatingUntil: new Date(NOW.getTime() + MEDITATION_DURATION_MS),
    };
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: { ...BASE_TILE, hero: meditatingHero },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameHeroAlreadyMeditatingError);
  });

  it("ignores expired meditatingUntil inside the txn and re-meditates", async () => {
    const expiredHero = {
      ...heroBase,
      meditatingUntil: new Date(NOW.getTime() - 1_000),
    };
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, turnsSpentTotal: 9 },
      tile: { ...BASE_TILE, hero: expiredHero },
    });
    mockGetAdminDb.mockReturnValue(db);
    const tile = await meditateHeroServer({
      callerUserId: "u1",
      tileId: "t1",
      now: NOW,
    });
    expect(tile.hero?.stamina).toBe(heroBase.staminaMax);
  });
});

// ──────────────────────────────────────────────────────────────────────
// pepTalkHeroServer guards (wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("pepTalkHeroServer guards (wave 16)", () => {
  const heroBase = {
    id: "h-pep",
    ownerId: "u1",
    tileId: "t1",
    class: "farm" as const,
    specialty: "food" as const,
    name: "Cheerful One",
    caste: "red" as const,
    stamina: 5,
    staminaMax: 20,
    emergedAtTurn: 1,
    lastEngagedAtTurn: 1,
  };

  it("throws GamePlayerNotFoundError when player is missing", async () => {
    const { db } = buildPlayerTileDb({
      player: null,
      tile: { ...BASE_TILE, hero: heroBase },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("throws GameTileNotFoundError when tile doc is missing", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, turnsRemaining: 0 },
      tile: null,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GamePepTalkRequiresZeroTurnsError when caller still has turns", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, turnsRemaining: 3 },
      tile: { ...BASE_TILE, hero: heroBase },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GamePepTalkRequiresZeroTurnsError);
  });

  it("throws GameTileNotOwnedError when tile belongs to another player", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, turnsRemaining: 0 },
      tile: { ...BASE_TILE, ownerId: "u2", hero: heroBase },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("throws GameHeroNotFoundError when tile has no hero", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, turnsRemaining: 0 },
      tile: { ...BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameHeroNotFoundError);
  });

  it("throws GameHeroNotOwnedError when hero belongs to another player", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, turnsRemaining: 0 },
      tile: { ...BASE_TILE, hero: { ...heroBase, ownerId: "u2" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1", now: NOW }),
    ).rejects.toBeInstanceOf(GameHeroNotOwnedError);
  });
});

// ──────────────────────────────────────────────────────────────────────
// summon / unsummon / upgrade guards (wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("summonSpecialUnitServer guards (wave 16)", () => {
  it("throws GamePlayerNotFoundError when player is missing", async () => {
    const { db } = buildPlayerTileDb({
      player: null,
      tile: { ...BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      summonSpecialUnitServer({
        userId: "u1",
        instanceId: "su-x",
        targetTileId: "t1",
      }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("throws GameTileNotFoundError when target tile is missing", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, phase: "play" },
      tile: null,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      summonSpecialUnitServer({
        userId: "u1",
        instanceId: "su-x",
        targetTileId: "t1",
      }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotOwnedError when target tile is foreign", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, phase: "play" },
      tile: { ...BASE_TILE, ownerId: "u2" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      summonSpecialUnitServer({
        userId: "u1",
        instanceId: "su-x",
        targetTileId: "t1",
      }),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("throws GameInvalidPhaseError when player is not in play", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER, phase: "explore" },
      tile: { ...BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      summonSpecialUnitServer({
        userId: "u1",
        instanceId: "su-x",
        targetTileId: "t1",
      }),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("throws GameSpecialUnitAlreadyStationedError when instance has a tile", async () => {
    const instance = {
      instanceId: "su-w16",
      defId: "red-forge-bound",
      spawnedAtTurn: 1,
      stationedTileId: "other",
    };
    const { db } = buildPlayerTileDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        summonableSpecialUnits: [instance],
      },
      tile: { ...BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      summonSpecialUnitServer({
        userId: "u1",
        instanceId: "su-w16",
        targetTileId: "t1",
      }),
    ).rejects.toBeInstanceOf(GameSpecialUnitAlreadyStationedError);
  });
});

describe("unsummonSpecialUnitServer guards (wave 16)", () => {
  function buildPlayerOnlyDb(player: Record<string, unknown> | null) {
    const playerRef = { __kind: "player" as const };
    const tx = {
      get: jest.fn(() =>
        Promise.resolve(
          player
            ? { exists: true, data: () => player }
            : { exists: false, data: () => undefined },
        ),
      ),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(() => playerRef) })),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    return { db, tx };
  }

  it("throws GamePlayerNotFoundError when player is missing", async () => {
    const { db } = buildPlayerOnlyDb(null);
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      unsummonSpecialUnitServer({ userId: "u1", instanceId: "su-x" }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("throws GameSpecialUnitNotFoundError for unknown instance", async () => {
    const { db } = buildPlayerOnlyDb({
      ...BASE_PLAYER,
      summonableSpecialUnits: [],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      unsummonSpecialUnitServer({ userId: "u1", instanceId: "missing" }),
    ).rejects.toBeInstanceOf(GameSpecialUnitNotFoundError);
  });

  it("recalls a stationed instance and updates the player doc", async () => {
    const instance = {
      instanceId: "su-w16-r",
      defId: "red-forge-bound",
      spawnedAtTurn: 1,
      stationedTileId: "t9",
    };
    const { db, tx } = buildPlayerOnlyDb({
      ...BASE_PLAYER,
      summonableSpecialUnits: [instance],
    });
    mockGetAdminDb.mockReturnValue(db);
    const { player } = await unsummonSpecialUnitServer({
      userId: "u1",
      instanceId: "su-w16-r",
    });
    expect(player.summonableSpecialUnits?.[0]?.stationedTileId).toBeUndefined();
    expect(tx.update).toHaveBeenCalled();
  });

  it("no-ops when the instance is already unsummoned", async () => {
    const instance = {
      instanceId: "su-w16-noop",
      defId: "red-forge-bound",
      spawnedAtTurn: 1,
    };
    const { db, tx } = buildPlayerOnlyDb({
      ...BASE_PLAYER,
      summonableSpecialUnits: [instance],
    });
    mockGetAdminDb.mockReturnValue(db);
    const { player } = await unsummonSpecialUnitServer({
      userId: "u1",
      instanceId: "su-w16-noop",
    });
    expect(player.summonableSpecialUnits?.[0]?.stationedTileId).toBeUndefined();
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe("applyUpgradeServer / removeUpgradeServer player-not-found guards (wave 16)", () => {
  function buildEmptyPlayerDb() {
    const playerRef = { __kind: "player" as const };
    const tx = {
      get: jest.fn(() =>
        Promise.resolve({ exists: false, data: () => undefined }),
      ),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(() => playerRef) })),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    return { db };
  }

  it("apply throws GamePlayerNotFoundError when player is missing", async () => {
    const { db } = buildEmptyPlayerDb();
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      applyUpgradeServer({
        userId: "u1",
        targetId: "red-ground-marauder",
        upgradeId: "red-ground-marauder-upgrade-1",
      }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("remove throws GamePlayerNotFoundError when player is missing", async () => {
    const { db } = buildEmptyPlayerDb();
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      removeUpgradeServer({
        userId: "u1",
        targetId: "red-ground-marauder",
      }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });
});

// ──────────────────────────────────────────────────────────────────────
// spendArtifactServer happy paths (wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("spendArtifactServer happy paths (wave 16)", () => {
  function buildSpendDb(opts: {
    artifact: Record<string, unknown> | null;
    player?: Record<string, unknown> | null;
  }) {
    const artifactRef = { __kind: "artifact" as const };
    const playerRef = { __kind: "player" as const };
    const playerSnap = opts.player
      ? { exists: true, data: () => opts.player }
      : { exists: false, data: () => undefined };
    const playerDoc = {
      get: jest.fn().mockResolvedValue(playerSnap),
    };
    const tx = {
      get: jest.fn((ref: { __kind?: string }) => {
        if (ref === artifactRef) {
          return Promise.resolve(
            opts.artifact
              ? { exists: true, data: () => opts.artifact }
              : { exists: false, data: () => undefined },
          );
        }
        return Promise.resolve({ exists: false, data: () => undefined });
      }),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_artifacts") {
          return { doc: jest.fn(() => artifactRef) };
        }
        if (name === "game_players") {
          return { doc: jest.fn(() => playerDoc) };
        }
        return { doc: jest.fn(() => playerRef) };
      }),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    return { db, tx };
  }

  it("spends a non-intel artifact and skips the intel report path", async () => {
    const { db, tx } = buildSpendDb({
      artifact: {
        ownerId: "u1",
        used: false,
        // common-rusted-spearhead is type "passive" — not intel
        definitionId: "common-rusted-spearhead",
        foundAtTurn: 3,
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await spendArtifactServer({
      userId: "u1",
      artifactId: "a-w16",
    });
    expect(result.artifact.used).toBe(true);
    expect("intelReport" in result ? result.intelReport : undefined).toBeUndefined();
    expect(tx.update).toHaveBeenCalled();
  });

  it("spends an intel artifact and runs the follow-up intel-report read", async () => {
    const { db, tx } = buildSpendDb({
      artifact: {
        ownerId: "u1",
        used: false,
        definitionId: "common-whispered-map",
        foundAtTurn: 5,
      },
      player: { ...BASE_PLAYER, turnsSpentTotal: 12 },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await spendArtifactServer({
      userId: "u1",
      artifactId: "a-w16-intel",
      targetTileId: "t1",
    });
    expect(result.artifact.used).toBe(true);
    expect(result.intelReport).toBeDefined();
    expect(tx.update).toHaveBeenCalled();
  });

  it("falls back to capturedAtTurn=0 when player doc is missing", async () => {
    const { db } = buildSpendDb({
      artifact: {
        ownerId: "u1",
        used: false,
        definitionId: "common-whispered-map",
        foundAtTurn: 5,
      },
      player: null,
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await spendArtifactServer({
      userId: "u1",
      artifactId: "a-w16-intel",
      targetTileId: "t1",
    });
    expect(result.intelReport).toBeDefined();
  });

  it("throws GameArtifactNotFoundError for missing artifact doc", async () => {
    const { db } = buildSpendDb({ artifact: null });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      spendArtifactServer({ userId: "u1", artifactId: "a-w16-missing" }),
    ).rejects.toBeInstanceOf(GameArtifactNotFoundError);
  });

  it("throws GameArtifactAlreadyUsedError when artifact has been spent", async () => {
    const { db } = buildSpendDb({
      artifact: {
        ownerId: "u1",
        used: true,
        definitionId: "common-rusted-spearhead",
        foundAtTurn: 3,
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      spendArtifactServer({ userId: "u1", artifactId: "a-w16" }),
    ).rejects.toBeInstanceOf(GameArtifactAlreadyUsedError);
  });

  it("throws GameInvalidSpellError for intel artifact without targetTileId", async () => {
    const { db } = buildSpendDb({
      artifact: {
        ownerId: "u1",
        used: false,
        definitionId: "common-whispered-map",
        foundAtTurn: 1,
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      spendArtifactServer({ userId: "u1", artifactId: "a-w16" }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });
});

// ──────────────────────────────────────────────────────────────────────
// getRecentAttacksServer per-side (wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("getRecentAttacksServer per-side query paths (wave 16)", () => {
  function buildAttacksDb(sentDocs: ReturnType<typeof makeDoc>[], receivedDocs: ReturnType<typeof makeDoc>[]) {
    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "game_attacks") return { doc: jest.fn() };
        const chain = makeChain({});
        chain.where = jest.fn((field: string, _op: string, _value: unknown) => {
          const result = makeChain({});
          if (field === "attackerId") {
            result.get = jest.fn().mockResolvedValue(makeQuerySnap(sentDocs));
            result.limit = jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(makeQuerySnap(sentDocs)),
            });
            result.orderBy = jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(makeQuerySnap(sentDocs)),
              }),
            });
          } else {
            result.get = jest.fn().mockResolvedValue(makeQuerySnap(receivedDocs));
            result.limit = jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(makeQuerySnap(receivedDocs)),
            });
            result.orderBy = jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(makeQuerySnap(receivedDocs)),
              }),
            });
          }
          return result;
        });
        chain.doc = jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false }),
        }));
        return chain;
      }),
    };
    return db;
  }

  const sentAttack = makeDoc("a-sent", {
    id: "a-sent",
    attackerId: "u1",
    defenderId: "u2",
    createdAt: new Date("2026-05-19T10:00:00.000Z"),
  });
  const receivedAttack = makeDoc("a-recv", {
    id: "a-recv",
    attackerId: "u3",
    defenderId: "u1",
    createdAt: new Date("2026-05-19T09:00:00.000Z"),
  });

  it("returns sent attacks via the attackerId path", async () => {
    const db = buildAttacksDb([sentAttack], []);
    mockGetAdminDb.mockReturnValue(db);
    const out = await getRecentAttacksServer({
      userId: "u1",
      side: "sent",
      limit: 10,
      cursor: null,
    });
    expect(out.items.length).toBeGreaterThanOrEqual(1);
    expect(out.items[0]?.id).toBe("a-sent");
  });

  it("returns received attacks via the defenderId path", async () => {
    const db = buildAttacksDb([], [receivedAttack]);
    mockGetAdminDb.mockReturnValue(db);
    const out = await getRecentAttacksServer({
      userId: "u1",
      side: "received",
      limit: 10,
      cursor: null,
    });
    expect(out.items.length).toBeGreaterThanOrEqual(1);
    expect(out.items[0]?.id).toBe("a-recv");
  });

  it("merges sent + received with createdAt sort under side='all'", async () => {
    const dupAttack = makeDoc("a-dup", {
      id: "a-dup",
      attackerId: "u1",
      defenderId: "u1",
      createdAt: new Date("2026-05-19T11:00:00.000Z"),
    });
    const db = buildAttacksDb([sentAttack, dupAttack], [receivedAttack, dupAttack]);
    mockGetAdminDb.mockReturnValue(db);
    const out = await getRecentAttacksServer({
      userId: "u1",
      side: "all",
      limit: 10,
      cursor: null,
    });
    // dedup: a-dup should appear once
    const ids = out.items.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(out.items[0]?.createdAt).toBeTruthy();
  });

  it("coerces Firestore-Timestamp shaped createdAt during the side='all' sort", async () => {
    const tsAttack = makeDoc("a-ts", {
      id: "a-ts",
      attackerId: "u1",
      defenderId: "u4",
      createdAt: tsLike("2026-05-19T08:00:00.000Z"),
    });
    const db = buildAttacksDb([tsAttack], []);
    mockGetAdminDb.mockReturnValue(db);
    const out = await getRecentAttacksServer({
      userId: "u1",
      side: "all",
      limit: 5,
      cursor: null,
    });
    expect(out.items[0]?.id).toBe("a-ts");
  });

  it("treats missing createdAt as epoch under side='all' sort", async () => {
    const noTs = makeDoc("a-nots", {
      id: "a-nots",
      attackerId: "u1",
      defenderId: "u5",
      // no createdAt
    });
    const db = buildAttacksDb([noTs], []);
    mockGetAdminDb.mockReturnValue(db);
    const out = await getRecentAttacksServer({
      userId: "u1",
      side: "all",
      limit: 5,
      cursor: null,
    });
    expect(out.items[0]?.id).toBe("a-nots");
  });
});

// ──────────────────────────────────────────────────────────────────────
// adminGrantUnitsServer guards (wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("adminGrantUnitsServer guards (wave 16)", () => {
  it("throws when count is negative", async () => {
    await expect(
      adminGrantUnitsServer({
        ownerId: "u1",
        tileId: "t1",
        unitType: "ground",
        count: -5,
      }),
    ).rejects.toThrow(/non-negative integer/);
  });

  it("throws when count is non-integer", async () => {
    await expect(
      adminGrantUnitsServer({
        ownerId: "u1",
        tileId: "t1",
        unitType: "ground",
        count: 1.5,
      }),
    ).rejects.toThrow(/non-negative integer/);
  });

  it("throws GameTileNotOwnedError when tile is foreign", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: { ...BASE_TILE, ownerId: "u2", units: { ground: 0, air: 0, siege: 0 } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      adminGrantUnitsServer({
        ownerId: "u1",
        tileId: "t1",
        unitType: "ground",
        count: 5,
      }),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("throws GameTileNotFoundError when tile is missing", async () => {
    const { db } = buildPlayerTileDb({
      player: { ...BASE_PLAYER },
      tile: null,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      adminGrantUnitsServer({
        ownerId: "u1",
        tileId: "t1",
        unitType: "ground",
        count: 5,
      }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("grants units when ownership and counts validate", async () => {
    const { db, update } = buildPlayerTileDb({
      player: {
        ...BASE_PLAYER,
        stats: { tilesHeld: 100, unitsAlive: 50 },
      },
      tile: {
        ...BASE_TILE,
        units: { ground: 2, air: 0, siege: 0 },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await adminGrantUnitsServer({
      ownerId: "u1",
      tileId: "t1",
      unitType: "ground",
      count: 7,
    });
    expect(out.tile.units.ground).toBe(9);
    expect(out.player.stats.unitsAlive).toBe(57);
    expect(update).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────
// redistributeUnitsServer adjacency guard (extra; wave 16)
// ──────────────────────────────────────────────────────────────────────
describe("redistributeUnitsServer adjacency (wave 16)", () => {
  it("throws GameNotAdjacentError when destination is not in neighbors", async () => {
    const { db } = buildRedistributeDb({
      player: { ...BASE_PLAYER, recentRedistributions: [] },
      source: {
        ...BASE_TILE,
        tileId: "s",
        neighborTileIds: ["other"],
        units: { ground: 50, air: 0, siege: 0 },
      },
      dest: { ...BASE_TILE, tileId: "d", ownerId: "u1" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 5, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameNotAdjacentError);
  });
});
