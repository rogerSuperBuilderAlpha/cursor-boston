/**
 * @jest-environment node
 *
 * Wave 13 — complex branches: txn races, artifact staging, hero emergence,
 * pact/oathbreaker attacks, prophecy resolution, community feed, intel
 * consumption, armageddon success, weekly rollover grants, bulk explore
 * partial failures, createPlayer duplicate name, getRecentAttacks pagination.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

const mockPaginate = jest.fn();

jest.mock("@/lib/firestore-pagination", () => {
  const actual = jest.requireActual<typeof import("@/lib/firestore-pagination")>(
    "@/lib/firestore-pagination",
  );
  return {
    ...actual,
    paginateFirestoreQuery: (...args: unknown[]) => mockPaginate(...args),
  };
});

jest.mock("@/lib/game/content/armageddon", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/content/armageddon")>(
    "@/lib/game/content/armageddon",
  );
  return {
    ...actual,
    computeArmageddonSuccessChanceFromMultiplier: jest.fn(() => 1),
  };
});

jest.mock("@/lib/game/prophecies", () => ({
  resolveProphesiesForSealInTx: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/game/pacts", () => ({
  findActivePactsBetween: jest.fn().mockResolvedValue([]),
  markPactsBrokenInTx: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/game/turn-report", () => ({
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
  buildDistributeReport: jest.fn(() => ({ kind: "distribute" })),
  buildExploreReport: jest.fn(() => ({
    action: "explore",
    narrative: ["explored"],
    outcome: {},
  })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/game/intel-effects", () => ({
  readAttackContextEffects: jest.fn().mockResolvedValue({
    forgeSightOffenseBonus: 0,
    alertVsCasterDefenseBonus: 0,
    siegeDebuffMagnitude: 0,
    preCastOffenseBonus: 0,
    defenseDisarmFraction: 0,
    consumeEffectIds: [],
  }),
  deleteIntelEffectsInTx: jest.fn(),
}));
jest.mock("@/lib/game/discord-game", () => ({ notifyConquest: jest.fn() }));
jest.mock("@/lib/game/hero-registry", () => ({
  appendHeroEventInTx: jest.fn(),
  upsertHeroInTx: jest.fn(),
  markHeroDeceasedInTx: jest.fn(),
  transferHeroOwnerInTx: jest.fn(),
  heroEvent: {
    engagedAttacker: jest.fn(() => ({})),
    engagedDefender: jest.fn(() => ({})),
    slain: jest.fn(() => ({})),
    defected: jest.fn(() => ({})),
    movedOnCapture: jest.fn(() => ({})),
    emerged: jest.fn(() => ({})),
    spellCast: jest.fn(() => ({})),
  },
}));
jest.mock("@/lib/game/heroes", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/heroes")>("@/lib/game/heroes");
  return { ...actual, maybeEmergeHero: jest.fn(() => null) };
});
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import * as crypto from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { computeArmageddonSuccessChanceFromMultiplier } from "@/lib/game/content/armageddon";
import { rollArtifact } from "@/lib/game/artifacts";
import { logCommunityEventInTx } from "@/lib/game/community";
import { ALL_ARTIFACTS } from "@/lib/game/content/artifacts";
import { SEAL_COUNT } from "@/lib/game/content/armageddon";
import {
  attackTileServer,
  bulkFrontierExploreServer,
  castArmageddonServer,
  createPlayerWithSpawnServer,
  distributeTileServer,
  exploreNextTileServer,
  frontierExploreServer,
  GameAlreadyRevealedError,
  GameFrontierExhaustedError,
  GameInsufficientTurnsError,
  GameInvalidNameError,
  GameInvalidPhaseError,
  GameNameTakenError,
  GameNoUnrevealedTilesError,
  GamePlayerAlreadyExistsError,
  GamePlayerNotFoundError,
  GameSelfAttackError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  getRecentAttacksServer,
  isGeneralNameTakenServer,
  NEW_PLAYER_TILE_COUNT,
  runWeeklyRolloverServer,
} from "@/lib/game/data-server";
import {
  deleteIntelEffectsInTx,
  readAttackContextEffects,
} from "@/lib/game/intel-effects";
import { maybeEmergeHero } from "@/lib/game/heroes";
import { findActivePactsBetween, markPactsBrokenInTx } from "@/lib/game/pacts";
import { resolveProphesiesForSealInTx } from "@/lib/game/prophecies";
import { WEEKLY_TURN_GRANT } from "@/lib/game/turns";
import type { UnitStack } from "@/lib/game/types";
import { OATHBREAKER_DURATION_MS } from "@/lib/game/types";
import {
  makeChain,
  makeDoc,
  makeFakeDb,
  makeQuerySnap,
  tsLike,
} from "@/__tests__/_helpers/firebase-admin-mock";
import {
  BASE_ATTACKER,
  BASE_DEFENDER,
  BASE_PLAYER,
  BASE_TILE,
  buildCombatMutationDb,
  buildGameMutationDb,
  makeAdjacentCombatTiles,
} from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRollArtifact = rollArtifact as jest.MockedFunction<typeof rollArtifact>;
const mockLogCommunity = logCommunityEventInTx as jest.MockedFunction<
  typeof logCommunityEventInTx
>;
const mockFindPacts = findActivePactsBetween as jest.MockedFunction<
  typeof findActivePactsBetween
>;
const mockMarkPactsBroken = markPactsBrokenInTx as jest.MockedFunction<
  typeof markPactsBrokenInTx
>;
const mockReadIntel = readAttackContextEffects as jest.MockedFunction<
  typeof readAttackContextEffects
>;
const mockDeleteIntel = deleteIntelEffectsInTx as jest.MockedFunction<
  typeof deleteIntelEffectsInTx
>;
const mockResolveProphecies = resolveProphesiesForSealInTx as jest.MockedFunction<
  typeof resolveProphesiesForSealInTx
>;
const mockMaybeEmergeHero = maybeEmergeHero as jest.MockedFunction<typeof maybeEmergeHero>;
const mockArmaChance = computeArmageddonSuccessChanceFromMultiplier as jest.Mock;

const SAMPLE_ARTIFACT = ALL_ARTIFACTS[0]!;

function exploreDb(opts: {
  player?: Record<string, unknown>;
  tile?: Record<string, unknown>;
  unrevealedDocs?: Array<{ id: string; data: Record<string, unknown> }>;
}) {
  return buildGameMutationDb({
    player: {
      exists: true,
      data: {
        ...BASE_PLAYER,
        phase: "explore",
        turnsRemaining: 5,
        tilesExplored: 10,
        caste: null,
        ...opts.player,
      },
    },
    tile: {
      exists: true,
      data: {
        ...BASE_TILE,
        type: "unrevealed",
        ...opts.tile,
      },
    },
    unrevealedDocs: opts.unrevealedDocs ?? [
      { id: "t1", data: { ...BASE_TILE, type: "unrevealed" } },
    ],
  });
}

function createPlayerDb(opts: {
  nameTaken?: boolean;
  playerExists?: boolean;
  occupiedCenter?: boolean;
}) {
  const userId = "spawn-w13";
  const playerRef = { id: userId, __player: true as const };
  const metaRef = { id: "singleton", __meta: true as const };
  const tileGets = new Map<string, boolean>();

  if (opts.occupiedCenter) {
    tileGets.set("0_0", true);
  }

  const nameTakenChain = makeChain({
    docs: opts.nameTaken
      ? [makeDoc("other", { displayNameLower: "taken" })]
      : [],
  });

  const tx = {
    get: jest.fn(
      (ref: {
        id?: string;
        __player?: boolean;
        __meta?: boolean;
        __tile?: boolean;
      }) => {
        if (ref.__player) {
          return Promise.resolve({
            exists: !!opts.playerExists,
            id: userId,
            data: () => (opts.playerExists ? { userId } : undefined),
          });
        }
        if (ref.__meta) {
          return Promise.resolve({
            exists: true,
            id: "singleton",
            data: () => ({ playerCount: 0 }),
          });
        }
        if (ref.__tile && ref.id) {
          return Promise.resolve({
            exists: tileGets.get(ref.id) ?? false,
            id: ref.id,
            data: () => (tileGets.get(ref.id) ? { tileId: ref.id } : undefined),
          });
        }
        return Promise.resolve({ exists: false, id: "", data: () => undefined });
      },
    ),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const cachedTileRefs = new Map<string, { id: string; __tile: true }>();
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          doc: jest.fn(() => playerRef),
          where: jest.fn(() => nameTakenChain),
        };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((tid: string) => {
            if (!cachedTileRefs.has(tid)) {
              cachedTileRefs.set(tid, { __tile: true, id: tid });
            }
            return cachedTileRefs.get(tid)!;
          }),
        };
      }
      if (name === "game_world_meta") {
        return { doc: jest.fn(() => metaRef) };
      }
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db, tx, userId };
}

function weeklyDb(opts: {
  hasPr: boolean;
  players: Array<Record<string, unknown>>;
  txnAlreadyGranted?: boolean;
  txnThrows?: boolean;
}) {
  const wkStart = "2026-05-12T00:00:00.000Z";
  const prChain = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue(
        opts.hasPr ? { empty: false, docs: [makeDoc("pr1", {})] } : { empty: true, docs: [] },
      ),
    }),
  };

  return {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          get: jest.fn().mockResolvedValue({
            size: opts.players.length,
            docs: opts.players.map((p, i) =>
              makeDoc((p.userId as string) ?? `u${i + 1}`, p),
            ),
          }),
          doc: jest.fn((id: string) => ({ id })),
        };
      }
      if (name === "pullRequests") return prChain;
      return { doc: jest.fn() };
    }),
    runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      if (opts.txnThrows) {
        throw new Error("txn failed");
      }
      const tx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            ...opts.players[0],
            lastWeeklyGrantWeekStart: opts.txnAlreadyGranted ? wkStart : undefined,
          }),
        }),
        update: jest.fn(),
      };
      return cb(tx);
    }),
  };
}

function armageddonDb(sealsBrokenBefore: number) {
  const userId = "arma-w13";
  const playerRef = { id: userId, __p: true as const };
  const worldRef = { id: "singleton", __w: true as const };
  const landsChain = makeChain({
    docs: [makeDoc("m1", { tileId: "m1", ownerId: userId, type: "magic" })],
  });
  landsChain.where = jest.fn(() => landsChain);

  const playerTxn = {
    userId,
    displayName: "Breaker",
    caste: "red" as const,
    phase: "play" as const,
    turnsRemaining: 200,
    turnsSpentTotal: 50,
    seasonNumber: 1,
    stats: { tilesHeld: 10_050, unitsAlive: 1 },
    activeUpgrades: {},
    armageddonCastsAttempted: 0,
    armageddonSealsBroken: 0,
    productionSpellsActive: [],
  };

  const tx = {
    get: jest.fn((ref: { __p?: boolean; __w?: boolean }) => {
      if (ref.__p) {
        return Promise.resolve({ exists: true, id: userId, data: () => playerTxn });
      }
      if (ref.__w) {
        return Promise.resolve({
          exists: true,
          id: "singleton",
          data: () => ({
            playerCount: 2,
            seasonNumber: 1,
            sealsBroken: sealsBrokenBefore,
            seals: [],
            armageddonState: "active",
          }),
        });
      }
      return Promise.resolve({ exists: false, id: "", data: () => undefined });
    }),
    update: jest.fn(),
    set: jest.fn(),
  };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return { doc: jest.fn(() => playerRef), where: jest.fn() };
      }
      if (name === "game_world_meta") {
        return { doc: jest.fn(() => worldRef) };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn(),
          where: jest.fn((_f: string, _op: string, uid: unknown) => {
            if (uid === userId) return landsChain;
            return makeChain({ docs: [] });
          }),
        };
      }
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db, tx, userId, playerRef, worldRef, playerTxn };
}

async function attackUntilOutcome(
  outcome: "captured" | "repelled" | "stalemate",
  setup: () => Partial<Parameters<typeof buildCombatMutationDb>[0]>,
  units: UnitStack,
) {
  const tiles = makeAdjacentCombatTiles();
  const uuidSpy = jest.spyOn(crypto, "randomUUID");
  try {
    for (let i = 0; i < 250; i++) {
      const attackId = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      uuidSpy.mockReturnValue(attackId as crypto.UUID);
      const params = setup();
      const { db, tx } = buildCombatMutationDb({
        attacker: BASE_ATTACKER,
        defender: BASE_DEFENDER,
        source: tiles.source,
        target: tiles.target,
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        ownedTileDocs: [{ id: tiles.sourceTileId, data: tiles.source }],
        ...params,
      });
      mockGetAdminDb.mockReturnValue(db as never);
      const result = await attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units,
        offenseSpellId: null,
      });
      if (result.combat.outcome === outcome) return { ...result, tx };
    }
    throw new Error(`Could not produce combat outcome "${outcome}" within 250 seeds`);
  } finally {
    uuidSpy.mockRestore();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPaginate.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  mockArmaChance.mockReturnValue(1);
  mockRollArtifact.mockReturnValue(null);
  mockFindPacts.mockResolvedValue([]);
  mockReadIntel.mockResolvedValue({
    forgeSightOffenseBonus: 0,
    alertVsCasterDefenseBonus: 0,
    siegeDebuffMagnitude: 0,
    preCastOffenseBonus: 0,
    defenseDisarmFraction: 0,
    consumeEffectIds: [],
  });
  mockMaybeEmergeHero.mockReturnValue(null);
});

describe("createPlayerWithSpawnServer (wave 13)", () => {
  it("throws GameNameTakenError when the display name is already taken", async () => {
    const { db } = createPlayerDb({ nameTaken: true });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      createPlayerWithSpawnServer("spawn-w13", "Taken"),
    ).rejects.toBeInstanceOf(GameNameTakenError);
  });

  it("throws GamePlayerAlreadyExistsError when the player doc already exists", async () => {
    const { db } = createPlayerDb({ playerExists: true });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      createPlayerWithSpawnServer("spawn-w13", "FreshGeneral"),
    ).rejects.toBeInstanceOf(GamePlayerAlreadyExistsError);
  });

  it("throws GameInvalidNameError for an empty display name", async () => {
    const { db } = createPlayerDb({});
    mockGetAdminDb.mockReturnValue(db);
    await expect(createPlayerWithSpawnServer("spawn-w13", "   ")).rejects.toBeInstanceOf(
      GameInvalidNameError,
    );
  });

  it("walks the spawn spiral when the default center tile is already claimed", async () => {
    const { db, tx, userId } = createPlayerDb({ occupiedCenter: true });
    mockGetAdminDb.mockReturnValue(db);
    const { tileIds } = await createPlayerWithSpawnServer(userId, "SpiralWalker");
    expect(tileIds).toHaveLength(NEW_PLAYER_TILE_COUNT);
    expect(tileIds.some((id) => id !== "0_0")).toBe(true);
    expect(tx.set).toHaveBeenCalled();
  });

  it("logs a player_join community feed event on successful spawn", async () => {
    const { db, userId } = createPlayerDb({});
    mockGetAdminDb.mockReturnValue(db);
    await createPlayerWithSpawnServer(userId, "NewRecruit");
    expect(mockLogCommunity).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ kind: "player_join", actorUserId: userId }),
      expect.any(Date),
    );
  });

  it("persists displayNameLower alongside the player doc", async () => {
    const { db, tx, userId } = createPlayerDb({});
    mockGetAdminDb.mockReturnValue(db);
    await createPlayerWithSpawnServer(userId, "LowerCase");
    const playerSet = tx.set.mock.calls.find(
      (c) => c[1] && typeof c[1] === "object" && "displayNameLower" in (c[1] as object),
    );
    expect(playerSet?.[1]).toEqual(
      expect.objectContaining({ displayNameLower: "lowercase" }),
    );
  });
});

describe("exploreNextTileServer races and artifacts (wave 13)", () => {
  it("throws GameNoUnrevealedTilesError when the pre-query finds nothing", async () => {
    const { db } = buildGameMutationDb({
      unrevealedDocs: [],
      player: { exists: true, data: BASE_PLAYER },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(exploreNextTileServer("u1")).rejects.toBeInstanceOf(
      GameNoUnrevealedTilesError,
    );
  });

  it("throws GameAlreadyRevealedError when another process revealed the tile first", async () => {
    const { db } = exploreDb({
      tile: { type: "unassigned", ownerId: "u1" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(exploreNextTileServer("u1")).rejects.toBeInstanceOf(
      GameAlreadyRevealedError,
    );
  });

  it("throws GamePlayerNotFoundError when the player doc is missing", async () => {
    const { db } = exploreDb({});
    db.runTransaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn((ref: { __kind?: string }) => {
          if (ref.__kind === "player") {
            return Promise.resolve({ exists: false, data: () => undefined });
          }
          return Promise.resolve({
            exists: true,
            data: () => ({ ...BASE_TILE, type: "unrevealed", ownerId: "u1" }),
          });
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      return cb(tx);
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(exploreNextTileServer("u1")).rejects.toBeInstanceOf(
      GamePlayerNotFoundError,
    );
  });

  it("throws GameTileNotFoundError when the tile doc vanished", async () => {
    const { db } = exploreDb({});
    db.runTransaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn((ref: { __kind?: string }) => {
          if (ref.__kind === "player") {
            return Promise.resolve({ exists: true, data: () => BASE_PLAYER });
          }
          return Promise.resolve({ exists: false, data: () => undefined });
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      return cb(tx);
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(exploreNextTileServer("u1")).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotOwnedError when ownership changed inside the txn", async () => {
    const { db } = exploreDb({
      tile: { type: "unrevealed", ownerId: "u-other" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(exploreNextTileServer("u1")).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("throws GameInvalidPhaseError outside the explore phase", async () => {
    const { db } = exploreDb({ player: { phase: "play" } });
    mockGetAdminDb.mockReturnValue(db);
    await expect(exploreNextTileServer("u1")).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("throws GameInsufficientTurnsError at zero turns", async () => {
    const { db } = exploreDb({ player: { turnsRemaining: 0 } });
    mockGetAdminDb.mockReturnValue(db);
    await expect(exploreNextTileServer("u1")).rejects.toBeInstanceOf(
      GameInsufficientTurnsError,
    );
  });

  it("stages an artifact doc when rollArtifact returns a definition", async () => {
    mockRollArtifact.mockReturnValue(SAMPLE_ARTIFACT);
    const { db, tx } = exploreDb({});
    mockGetAdminDb.mockReturnValue(db);
    const result = await exploreNextTileServer("u1");
    expect(result.artifact).toEqual(
      expect.objectContaining({ definitionId: SAMPLE_ARTIFACT.id, used: false }),
    );
    expect(tx.set.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ ownerId: "u1", foundDuringAction: "explore" }),
    );
  });

  it("returns a null artifact when the roll misses", async () => {
    mockRollArtifact.mockReturnValue(null);
    const { db } = exploreDb({});
    mockGetAdminDb.mockReturnValue(db);
    const result = await exploreNextTileServer("u1");
    expect(result.artifact).toBeNull();
  });
});

describe("getRecentAttacksServer pagination (wave 13)", () => {
  beforeEach(() => mockPaginate.mockReset());

  it("delegates sent-side queries to paginateFirestoreQuery", async () => {
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_attacks: makeChain({}) } }).db,
    );
    await getRecentAttacksServer({
      userId: "u1",
      side: "sent",
      limit: 10,
      cursor: "cur1",
    });
    expect(mockPaginate).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, cursor: "cur1" }),
    );
  });

  it("delegates received-side queries to paginateFirestoreQuery", async () => {
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_attacks: makeChain({}) } }).db,
    );
    await getRecentAttacksServer({
      userId: "u2",
      side: "received",
      limit: 5,
      cursor: null,
    });
    expect(mockPaginate).toHaveBeenCalled();
  });

  it("deduplicates the same attack id when side=all merges sent and received", async () => {
    const attacksChain = makeChain({});
    attacksChain.where = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(
          makeQuerySnap([
            makeDoc("dup", {
              id: "dup",
              attackerId: "u1",
              defenderId: "u2",
              createdAt: new Date("2026-05-03"),
            }),
          ]),
        ),
      }),
    });
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_attacks: attacksChain } }).db,
    );
    const result = await getRecentAttacksServer({
      userId: "u1",
      side: "all",
      limit: 10,
      cursor: null,
    });
    expect(result.items.filter((a) => a.id === "dup")).toHaveLength(1);
  });

  it("sorts side=all results newest-first using Firestore Timestamp createdAt", async () => {
    const attacksChain = makeChain({});
    attacksChain.where = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        get: jest.fn()
          .mockResolvedValueOnce(
            makeQuerySnap([
              makeDoc("old", {
                id: "old",
                createdAt: tsLike("2026-05-01T00:00:00.000Z"),
              }),
            ]),
          )
          .mockResolvedValueOnce(
            makeQuerySnap([
              makeDoc("new", {
                id: "new",
                createdAt: tsLike("2026-05-10T00:00:00.000Z"),
              }),
            ]),
          ),
      }),
    });
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_attacks: attacksChain } }).db,
    );
    const result = await getRecentAttacksServer({
      userId: "u1",
      side: "all",
      limit: 10,
      cursor: null,
    });
    expect(result.items[0]?.id).toBe("new");
    expect(result.items[1]?.id).toBe("old");
  });

  it("applies limit via in-memory pagination for side=all", async () => {
    const attacksChain = makeChain({});
    attacksChain.where = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(
          makeQuerySnap(
            ["a", "b", "c"].map((id) =>
              makeDoc(id, { id, createdAt: new Date(`2026-05-0${id === "a" ? 1 : id === "b" ? 2 : 3}`) }),
            ),
          ),
        ),
      }),
    });
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_attacks: attacksChain } }).db,
    );
    const result = await getRecentAttacksServer({
      userId: "u1",
      side: "all",
      limit: 2,
      cursor: null,
    });
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
  });
});

describe("isGeneralNameTakenServer (wave 13)", () => {
  it("returns false for blank names without hitting Firestore semantics", async () => {
    mockGetAdminDb.mockReturnValue(makeFakeDb().db);
    await expect(isGeneralNameTakenServer("   ")).resolves.toBe(false);
  });

  it("returns false when the only match is the excluded user", async () => {
    const playersChain = makeChain({
      docs: [makeDoc("self", { displayNameLower: "alpha" })],
    });
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );
    await expect(isGeneralNameTakenServer("Alpha", "self")).resolves.toBe(false);
  });
});

describe("attackTileServer pacts, intel, heroes, feed (wave 13)", () => {
  it("stamps oathbreakerUntil when the attack breaks an active pact", async () => {
    mockFindPacts.mockResolvedValue([{ id: "pact-1" } as never]);
    const now = new Date("2026-05-12T12:00:00.000Z");
    const { tx } = await attackUntilOutcome(
      "captured",
      () => ({
        attacker: { ...BASE_ATTACKER, oathbreakerUntil: undefined },
        target: { ...makeAdjacentCombatTiles().target, units: { ground: 1, air: 0, siege: 0 } },
      }),
      { ground: 40, air: 0, siege: 0 },
    );
    const attackerUpdate = tx.update.mock.calls.find(
      (c) => c[1] && typeof c[1] === "object" && "oathbreakerUntil" in (c[1] as object),
    )?.[1] as { oathbreakerUntil?: Date } | undefined;
    expect(attackerUpdate?.oathbreakerUntil).toBeDefined();
    expect(attackerUpdate!.oathbreakerUntil!.getTime()).toBeGreaterThanOrEqual(
      now.getTime() + OATHBREAKER_DURATION_MS - 1000,
    );
  });

  it("calls markPactsBrokenInTx after resolving combat", async () => {
    await attackUntilOutcome(
      "captured",
      () => ({
        target: { ...makeAdjacentCombatTiles().target, units: { ground: 1, air: 0, siege: 0 } },
      }),
      { ground: 40, air: 0, siege: 0 },
    );
    expect(mockMarkPactsBroken).toHaveBeenCalledWith(
      expect.objectContaining({ attackerId: "u1", defenderId: "u2" }),
    );
  });

  it("consumes single-use intel effects when consumeEffectIds is populated", async () => {
    mockReadIntel.mockResolvedValue({
      forgeSightOffenseBonus: 0.1,
      alertVsCasterDefenseBonus: 0,
      siegeDebuffMagnitude: 0,
      preCastOffenseBonus: 0.05,
      defenseDisarmFraction: 0,
      consumeEffectIds: ["eff-a", "eff-b"],
    });
    await attackUntilOutcome(
      "captured",
      () => ({
        target: { ...makeAdjacentCombatTiles().target, units: { ground: 1, air: 0, siege: 0 } },
      }),
      { ground: 40, air: 0, siege: 0 },
    );
    expect(mockDeleteIntel).toHaveBeenCalledWith(
      expect.objectContaining({ effectIds: ["eff-a", "eff-b"] }),
    );
  });

  it("skips deleteIntelEffectsInTx when there is nothing to consume", async () => {
    mockReadIntel.mockResolvedValue({
      forgeSightOffenseBonus: 0,
      alertVsCasterDefenseBonus: 0,
      siegeDebuffMagnitude: 0.2,
      preCastOffenseBonus: 0,
      defenseDisarmFraction: 0,
      consumeEffectIds: [],
    });
    await attackUntilOutcome(
      "repelled",
      () => ({
        source: {
          ...makeAdjacentCombatTiles().source,
          units: { ground: 2, air: 0, siege: 0 },
        },
        target: {
          ...makeAdjacentCombatTiles().target,
          units: { ground: 500, air: 0, siege: 0 },
        },
      }),
      { ground: 2, air: 0, siege: 0 },
    );
    expect(mockDeleteIntel).not.toHaveBeenCalled();
  });

  it("logs an attack community feed event", async () => {
    await attackUntilOutcome(
      "captured",
      () => ({
        target: { ...makeAdjacentCombatTiles().target, units: { ground: 1, air: 0, siege: 0 } },
      }),
      { ground: 40, air: 0, siege: 0 },
    );
    expect(mockLogCommunity).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ kind: "attack", actorUserId: "u1" }),
      expect.any(Date),
    );
  });

  it("logs milestone_1k_tiles when a capture crosses the threshold", async () => {
    await attackUntilOutcome(
      "captured",
      () => ({
        attacker: {
          ...BASE_ATTACKER,
          stats: { ...BASE_ATTACKER.stats, tilesHeld: 999 },
        },
        target: { ...makeAdjacentCombatTiles().target, units: { ground: 1, air: 0, siege: 0 } },
      }),
      { ground: 40, air: 0, siege: 0 },
    );
    expect(mockLogCommunity).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ kind: "milestone_1k_tiles" }),
      expect.any(Date),
    );
  });

  it("logs hero_emerged when a military hero emerges on capture", async () => {
    mockMaybeEmergeHero.mockReturnValue({
      id: "hero-cap",
      ownerId: "u1",
      tileId: "1_0",
      class: "military",
      specialty: "ground",
      name: "Victor",
      caste: "red",
      stamina: 10,
      staminaMax: 20,
      emergedAtTurn: 5,
      lastEngagedAtTurn: 5,
    } as never);
    await attackUntilOutcome(
      "captured",
      () => ({
        target: { ...makeAdjacentCombatTiles().target, units: { ground: 1, air: 0, siege: 0 } },
      }),
      { ground: 40, air: 0, siege: 0 },
    );
    expect(mockLogCommunity).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ kind: "hero_emerged", heroId: "hero-cap" }),
      expect.any(Date),
    );
  });

  it("logs hero_emerged when a defender hero emerges on repel", async () => {
    mockMaybeEmergeHero.mockReturnValue({
      id: "hero-repel",
      ownerId: "u2",
      tileId: "1_0",
      class: "military",
      specialty: "ground",
      name: "Warder",
      caste: "blue",
      stamina: 10,
      staminaMax: 20,
      emergedAtTurn: 5,
      lastEngagedAtTurn: 5,
    } as never);
    await attackUntilOutcome(
      "repelled",
      () => ({
        source: { ...makeAdjacentCombatTiles().source, units: { ground: 2, air: 0, siege: 0 } },
        target: { ...makeAdjacentCombatTiles().target, units: { ground: 500, air: 0, siege: 0 } },
      }),
      { ground: 2, air: 0, siege: 0 },
    );
    expect(mockLogCommunity).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ kind: "hero_emerged", heroId: "hero-repel" }),
      expect.any(Date),
    );
  });

  it("throws GameSelfAttackError when the defender changes between pre-read and txn", async () => {
    const tiles = makeAdjacentCombatTiles();
    const targetPre = { ...tiles.target, ownerId: "u2" };
    const targetTxn = { ...tiles.target, ownerId: "u3" };
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: targetTxn,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    const targetDoc = db.collection("game_tiles").doc(tiles.targetTileId) as {
      get: jest.Mock;
    };
    targetDoc.get = jest.fn().mockResolvedValue({
      exists: true,
      data: () => targetPre,
      id: tiles.targetTileId,
    });
    const origRunTxn = db.runTransaction;
    db.runTransaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const innerTx = {
        get: jest.fn((ref: { id?: string }) => {
          if (ref.id === "u1") {
            return Promise.resolve({
              exists: true,
              data: () => BASE_ATTACKER,
              id: "u1",
            });
          }
          if (ref.id === "u2") {
            return Promise.resolve({
              exists: true,
              data: () => BASE_DEFENDER,
              id: "u2",
            });
          }
          if (ref.id === tiles.sourceTileId) {
            return Promise.resolve({
              exists: true,
              data: () => tiles.source,
              id: tiles.sourceTileId,
            });
          }
          if (ref.id === tiles.targetTileId) {
            return Promise.resolve({
              exists: true,
              data: () => targetTxn,
              id: tiles.targetTileId,
            });
          }
          return Promise.resolve({ exists: false, data: () => undefined, id: "" });
        }),
        update: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      };
      return cb(innerTx);
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 10, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameSelfAttackError);
    expect(origRunTxn).toBeDefined();
  });

  it("extends an existing oathbreakerUntil window when breaching again", async () => {
    mockFindPacts.mockResolvedValue([{ id: "pact-2" } as never]);
    const existingUntil = new Date("2026-06-01T00:00:00.000Z");
    const { tx } = await attackUntilOutcome(
      "captured",
      () => ({
        attacker: { ...BASE_ATTACKER, oathbreakerUntil: existingUntil },
        target: { ...makeAdjacentCombatTiles().target, units: { ground: 1, air: 0, siege: 0 } },
      }),
      { ground: 40, air: 0, siege: 0 },
    );
    const attackerUpdate = tx.update.mock.calls.find(
      (c) => c[1] && typeof c[1] === "object" && "oathbreakerUntil" in (c[1] as object),
    )?.[1] as { oathbreakerUntil?: Date } | undefined;
    expect(attackerUpdate!.oathbreakerUntil!.getTime()).toBeGreaterThanOrEqual(
      existingUntil.getTime(),
    );
  });
});

describe("castArmageddonServer success branches (wave 13)", () => {
  it("breaks a seal and increments player counters on success", async () => {
    const { db, userId, playerTxn } = armageddonDb(2);
    mockGetAdminDb.mockReturnValue(db);
    const res = await castArmageddonServer({ userId, now: new Date("2026-05-10T12:00:00.000Z") });
    expect(res.success).toBe(true);
    expect(res.sealsBroken).toBe(3);
    expect(res.player.armageddonSealsBroken).toBe(1);
    expect(res.player.turnsRemaining).toBe(playerTxn.turnsRemaining - 100);
  });

  it("calls resolveProphesiesForSealInTx with the 1-indexed seal number", async () => {
    const { db, userId } = armageddonDb(1);
    mockGetAdminDb.mockReturnValue(db);
    await castArmageddonServer({ userId, now: new Date("2026-05-10T12:00:00.000Z") });
    expect(mockResolveProphecies).toHaveBeenCalledWith(
      expect.objectContaining({ brokenSealNumber: 2 }),
    );
  });

  it("logs seal_broken on a successful cast", async () => {
    const { db, userId } = armageddonDb(0);
    mockGetAdminDb.mockReturnValue(db);
    await castArmageddonServer({ userId, now: new Date("2026-05-10T12:00:00.000Z") });
    expect(mockLogCommunity).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ kind: "seal_broken", sealIndex: 0 }),
      expect.any(Date),
    );
  });

  it("sets shouldTriggerResolve when the final seal breaks", async () => {
    const { db, userId } = armageddonDb(SEAL_COUNT - 1);
    mockGetAdminDb.mockReturnValue(db);
    const res = await castArmageddonServer({ userId, now: new Date("2026-05-10T12:00:00.000Z") });
    expect(res.shouldTriggerResolve).toBe(true);
    expect(res.sealsBroken).toBe(SEAL_COUNT);
  });

  it("logs armageddon_started when the last seal breaks", async () => {
    const { db, userId } = armageddonDb(SEAL_COUNT - 1);
    mockGetAdminDb.mockReturnValue(db);
    await castArmageddonServer({ userId, now: new Date("2026-05-10T12:00:00.000Z") });
    expect(mockLogCommunity).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ kind: "armageddon_started" }),
      expect.any(Date),
    );
  });
});

describe("runWeeklyRolloverServer turn grants (wave 13)", () => {
  const wkStart = "2026-05-12T00:00:00.000Z";

  it("adds pendingProphecyBonus turns and zeroes the pending counter", async () => {
    const db = weeklyDb({
      hasPr: true,
      players: [
        {
          ...BASE_PLAYER,
          userId: "u1",
          turnsRemaining: 4,
          pendingProphecyBonus: 3,
        },
      ],
    });
    mockGetAdminDb.mockReturnValue(db);
    const summary = await runWeeklyRolloverServer(wkStart);
    expect(summary.granted).toBe(1);
    const tx = db.runTransaction.mock.calls[0]?.[0];
    const fakeTx = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          ...BASE_PLAYER,
          userId: "u1",
          turnsRemaining: 4,
          pendingProphecyBonus: 3,
        }),
      }),
      update: jest.fn(),
    };
    await tx!(fakeTx);
    expect(fakeTx.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        turnsRemaining: 4 + WEEKLY_TURN_GRANT + 3,
        pendingProphecyBonus: 0,
        lastWeeklyGrantWeekStart: wkStart,
      }),
    );
  });

  it("skips players who already received this week's grant", async () => {
    const db = weeklyDb({
      hasPr: true,
      players: [
        {
          ...BASE_PLAYER,
          userId: "u1",
          lastWeeklyGrantWeekStart: wkStart,
        },
      ],
    });
    mockGetAdminDb.mockReturnValue(db);
    const summary = await runWeeklyRolloverServer(wkStart);
    expect(summary.skippedAlreadyGranted).toBe(1);
    expect(summary.granted).toBe(0);
  });

  it("counts a txn race as skippedAlreadyGranted when fresh data already has the week stamp", async () => {
    const db = weeklyDb({
      hasPr: true,
      players: [{ ...BASE_PLAYER, userId: "u1", turnsRemaining: 1 }],
      txnAlreadyGranted: true,
    });
    mockGetAdminDb.mockReturnValue(db);
    const summary = await runWeeklyRolloverServer(wkStart);
    expect(summary.skippedAlreadyGranted).toBe(1);
    expect(summary.granted).toBe(0);
  });

  it("skips players with no merged PRs in the window", async () => {
    const db = weeklyDb({
      hasPr: false,
      players: [{ ...BASE_PLAYER, userId: "u1" }],
    });
    mockGetAdminDb.mockReturnValue(db);
    const summary = await runWeeklyRolloverServer(wkStart);
    expect(summary.skippedNoPrs).toBe(1);
    expect(summary.granted).toBe(0);
  });

  it("records per-player errors without aborting the whole rollover", async () => {
    const db = weeklyDb({
      hasPr: true,
      players: [{ ...BASE_PLAYER, userId: "u1" }],
      txnThrows: true,
    });
    mockGetAdminDb.mockReturnValue(db);
    const summary = await runWeeklyRolloverServer(wkStart);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]?.userId).toBe("u1");
  });
});

describe("bulkFrontierExploreServer partial failures (wave 13)", () => {
  it("throws GameFrontierExhaustedError when every candidate was raced", async () => {
    const userId = "u1";
    const playerPre = {
      userId,
      phase: "play" as const,
      turnsRemaining: 5,
      turnsSpentTotal: 50,
      tilesExplored: 10,
      caste: "red" as const,
      stats: { tilesHeld: 50, unitsAlive: 1, attacksWon: 0, attacksLost: 0 },
      activeUpgrades: {},
      productionSpellsActive: [],
    };
    const ownedChain = makeChain({
      docs: [makeDoc("0_0", { tileId: "0_0", q: 0, r: 0, ownerId: userId, type: "food" })],
    });
    const tx = {
      getAll: jest.fn((...refs: Array<{ id: string }>) =>
        Promise.resolve(
          refs.map((ref, idx) => {
            if (idx === 0) {
              return { exists: true, id: ref.id, data: () => playerPre };
            }
            return {
              exists: true,
              id: ref.id,
              data: () => ({ tileId: ref.id }),
            };
          }),
        ),
      ),
      set: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ exists: true, data: () => playerPre }),
            })),
          };
        }
        if (name === "game_tiles") {
          return {
            doc: jest.fn((id: string) => ({ id })),
            where: jest.fn(() => ownedChain),
          };
        }
        return { doc: jest.fn(), where: jest.fn() };
      }),
      getAll: jest.fn((...refs: Array<{ id: string }>) =>
        Promise.resolve(refs.map((r) => ({ exists: false, id: r.id, data: () => undefined }))),
      ),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    });
    await expect(bulkFrontierExploreServer(userId, 2)).rejects.toBeInstanceOf(
      GameFrontierExhaustedError,
    );
  });

  it("stops early when the player runs out of turns mid-batch", async () => {
    const userId = "u1";
    const playerPre = {
      userId,
      phase: "play" as const,
      turnsRemaining: 1,
      turnsSpentTotal: 50,
      tilesExplored: 10,
      caste: "red" as const,
      stats: { tilesHeld: 50, unitsAlive: 1, attacksWon: 0, attacksLost: 0 },
      activeUpgrades: {},
      productionSpellsActive: [],
    };
    const ownedChain = makeChain({
      docs: [makeDoc("0_0", { tileId: "0_0", q: 0, r: 0, ownerId: userId, type: "food" })],
    });
    const tx = {
      getAll: jest.fn((...refs: Array<{ id: string }>) =>
        Promise.resolve(
          refs.map((ref, idx) => {
            if (idx === 0) {
              return { exists: true, id: ref.id, data: () => playerPre };
            }
            return { exists: false, id: ref.id, data: () => undefined };
          }),
        ),
      ),
      set: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ exists: true, data: () => playerPre }),
            })),
          };
        }
        if (name === "game_tiles") {
          return {
            doc: jest.fn((id: string) => ({ id })),
            where: jest.fn(() => ownedChain),
          };
        }
        return { doc: jest.fn(), where: jest.fn() };
      }),
      getAll: jest.fn((...refs: Array<{ id: string }>) =>
        Promise.resolve(refs.map((r) => ({ exists: false, id: r.id, data: () => undefined }))),
      ),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    });
    const out = await bulkFrontierExploreServer(userId, 3);
    expect(out.tiles.length).toBeGreaterThanOrEqual(1);
    expect(out.stoppedEarly).toMatch(/out of turns/);
  });

  it("stages artifacts for each successful claim in the batch", async () => {
    mockRollArtifact.mockReturnValue(SAMPLE_ARTIFACT);
    const userId = "u1";
    const playerPre = {
      userId,
      phase: "play" as const,
      turnsRemaining: 3,
      turnsSpentTotal: 50,
      tilesExplored: 10,
      caste: "red" as const,
      stats: { tilesHeld: 50, unitsAlive: 1, attacksWon: 0, attacksLost: 0 },
      activeUpgrades: {},
      productionSpellsActive: [],
    };
    const ownedChain = makeChain({
      docs: [makeDoc("0_0", { tileId: "0_0", q: 0, r: 0, ownerId: userId, type: "food" })],
    });
    const tx = {
      getAll: jest.fn((...refs: Array<{ id: string }>) =>
        Promise.resolve(
          refs.map((ref, idx) => {
            if (idx === 0) {
              return { exists: true, id: ref.id, data: () => playerPre };
            }
            return { exists: false, id: ref.id, data: () => undefined };
          }),
        ),
      ),
      set: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ exists: true, data: () => playerPre }),
            })),
          };
        }
        if (name === "game_tiles") {
          return {
            doc: jest.fn((id: string) => ({ id })),
            where: jest.fn(() => ownedChain),
          };
        }
        if (name === "game_artifacts") {
          return { doc: jest.fn(() => ({})) };
        }
        return { doc: jest.fn(), where: jest.fn() };
      }),
      getAll: jest.fn((...refs: Array<{ id: string }>) =>
        Promise.resolve(refs.map((r) => ({ exists: false, id: r.id, data: () => undefined }))),
      ),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    });
    const out = await bulkFrontierExploreServer(userId, 2);
    expect(out.artifacts.length).toBeGreaterThanOrEqual(1);
    expect(tx.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ foundDuringAction: "explore" }),
    );
  });

  it("rejects non-positive batch counts", async () => {
    mockGetAdminDb.mockReturnValue(makeFakeDb().db);
    await expect(bulkFrontierExploreServer("u1", 0)).rejects.toThrow(/count must be > 0/);
  });

  it("rejects batches larger than 50", async () => {
    mockGetAdminDb.mockReturnValue(makeFakeDb().db);
    await expect(bulkFrontierExploreServer("u1", 51)).rejects.toThrow(/at most 50/);
  });
});

describe("frontierExploreServer race (wave 13)", () => {
  function frontierRaceDb(tileExistsInTxn: boolean) {
    const userId = "u1";
    const playerPre = {
      userId,
      phase: "play" as const,
      turnsRemaining: 5,
      turnsSpentTotal: 20,
      tilesExplored: 10,
      caste: "red" as const,
      stats: { tilesHeld: 50, unitsAlive: 1, attacksWon: 0, attacksLost: 0 },
      activeUpgrades: {},
      productionSpellsActive: [],
    };
    const playerDocRef = {
      id: userId,
      get: jest.fn().mockResolvedValue({ exists: true, data: () => playerPre }),
    };
    const ownedChain = makeChain({
      docs: [makeDoc("0_0", { tileId: "0_0", q: 0, r: 0, ownerId: userId, type: "food" })],
    });
    const tileDocById = new Map<string, { id: string }>();
    const tx = {
      get: jest.fn((ref: { id: string }) => {
        if (ref.id === userId) {
          return Promise.resolve({ exists: true, data: () => playerPre });
        }
        return Promise.resolve({
          exists: tileExistsInTxn,
          id: ref.id,
          data: () => (tileExistsInTxn ? { tileId: ref.id } : undefined),
        });
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return { doc: jest.fn(() => playerDocRef), where: jest.fn() };
        }
        if (name === "game_tiles") {
          return {
            doc: jest.fn((id: string) => {
              if (!tileDocById.has(id)) tileDocById.set(id, { id });
              return tileDocById.get(id)!;
            }),
            where: jest.fn(() => ownedChain),
          };
        }
        return { doc: jest.fn(), where: jest.fn() };
      }),
      getAll: jest.fn((...refs: Array<{ id: string }>) =>
        Promise.resolve(
          refs.map((r) => ({ exists: false, id: r.id, data: () => undefined })),
        ),
      ),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    return { db, userId };
  }

  it("throws GameFrontierExhaustedError when the candidate tile was claimed first", async () => {
    const { db, userId } = frontierRaceDb(true);
    mockGetAdminDb.mockReturnValue(db);
    await expect(frontierExploreServer(userId)).rejects.toBeInstanceOf(
      GameFrontierExhaustedError,
    );
  });

  it("throws GameInsufficientTurnsError at zero turns", async () => {
    const userId = "u1";
    const playerPre = {
      userId,
      phase: "play" as const,
      turnsRemaining: 0,
      turnsSpentTotal: 20,
      tilesExplored: 10,
      caste: "red" as const,
      stats: { tilesHeld: 50, unitsAlive: 1, attacksWon: 0, attacksLost: 0 },
      activeUpgrades: {},
      productionSpellsActive: [],
    };
    const ownedChain = makeChain({
      docs: [makeDoc("0_0", { tileId: "0_0", q: 0, r: 0, ownerId: userId, type: "food" })],
    });
    const tileDocById = new Map<string, { id: string }>();
    const tx = {
      get: jest.fn((ref: { id: string }) => {
        if (ref.id === userId) {
          return Promise.resolve({ exists: true, data: () => playerPre });
        }
        return Promise.resolve({ exists: false, id: ref.id, data: () => undefined });
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return {
            doc: jest.fn(() => ({
              id: userId,
              get: jest.fn().mockResolvedValue({ exists: true, data: () => playerPre }),
            })),
          };
        }
        if (name === "game_tiles") {
          return {
            doc: jest.fn((id: string) => {
              if (!tileDocById.has(id)) tileDocById.set(id, { id });
              return tileDocById.get(id)!;
            }),
            where: jest.fn(() => ownedChain),
          };
        }
        return { doc: jest.fn(), where: jest.fn() };
      }),
      getAll: jest.fn((...refs: Array<{ id: string }>) =>
        Promise.resolve(
          refs.map((r) => ({ exists: false, id: r.id, data: () => undefined })),
        ),
      ),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    });
    await expect(frontierExploreServer(userId)).rejects.toBeInstanceOf(
      GameInsufficientTurnsError,
    );
  });
});

describe("distributeTileServer artifact staging (wave 13)", () => {
  it("stages an artifact during distribute", async () => {
    mockRollArtifact.mockReturnValue(SAMPLE_ARTIFACT);
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: { ...BASE_PLAYER, phase: "distribute", turnsRemaining: 5, caste: "red" },
      },
      tile: { exists: true, data: { ...BASE_TILE, type: "unassigned" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await distributeTileServer("u1", "t1", "food");
    expect(result.artifact).toEqual(
      expect.objectContaining({ definitionId: SAMPLE_ARTIFACT.id }),
    );
    expect(tx.set.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ foundDuringAction: "distribute" }),
    );
  });

  it("returns null artifact when distribute roll misses", async () => {
    mockRollArtifact.mockReturnValue(null);
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: { ...BASE_PLAYER, phase: "distribute", turnsRemaining: 5, caste: "red" },
      },
      tile: { exists: true, data: { ...BASE_TILE, type: "unassigned" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await distributeTileServer("u1", "t1", "magic");
    expect(result.artifact).toBeNull();
  });
});
