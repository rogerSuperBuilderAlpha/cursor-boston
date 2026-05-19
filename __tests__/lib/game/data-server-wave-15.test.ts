/**
 * @jest-environment node
 *
 * Wave 15 — remaining data-server branches toward 95%+ coverage: hero combat
 * helpers, getMyMap border ring, bulk distribute early-stop, build/bulk-build
 * farm-hero paths, intel/armageddon guards, attack preview validation, monte
 * carlo frontier, far expedition txn races, spend-artifact errors.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/world-gen", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/world-gen")>(
    "@/lib/game/world-gen",
  );
  return {
    ...actual,
    makeSeededRng: jest.fn(() => () => 0),
  };
});

jest.mock("@/lib/game/content/armageddon", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/content/armageddon")>(
    "@/lib/game/content/armageddon",
  );
  return {
    ...actual,
    computeArmageddonSuccessChanceFromMultiplier: jest.fn(() => 0.5),
  };
});

jest.mock("@/lib/game/prophecies", () => ({
  resolveProphesiesForSealInTx: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/game/turn-report", () => ({
  buildArmDefenseReport: jest.fn(() => ({ action: "spell-arm" })),
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
  buildBuildReport: jest.fn(() => ({ kind: "build" })),
  buildCastSpellReport: jest.fn(() => ({ kind: "cast" })),
  buildDistributeReport: jest.fn(() => ({ kind: "distribute" })),
  buildExploreReport: jest.fn(() => ({
    action: "explore",
    narrative: ["explored"],
    outcome: {},
  })),
  buildFlyoverReport: jest.fn(() => ({ kind: "flyover" })),
  buildSiegeReport: jest.fn(() => ({ kind: "siege" })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn().mockResolvedValue({
    id: "ir-wave15",
    targetTileId: "1_0",
    scope: "tile",
    capturedAtTurn: 4,
    lines: [],
  }),
}));
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
  recordDefenseDisarmInTx: jest.fn(),
  recordIntelEffectInTx: jest.fn(),
  recordSiegeDebuffInTx: jest.fn(),
}));
jest.mock("@/lib/game/discord-game", () => ({ notifyConquest: jest.fn() }));
jest.mock("@/lib/game/pacts", () => ({
  findActivePactsBetween: jest.fn().mockResolvedValue([]),
  markPactsBrokenInTx: jest.fn().mockResolvedValue(undefined),
}));
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
    recruited: jest.fn(() => ({})),
    specialUnitSummoned: jest.fn(() => ({})),
  },
}));
jest.mock("@/lib/game/heroes", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/heroes")>("@/lib/game/heroes");
  return { ...actual, maybeEmergeHero: jest.fn(() => null) };
});
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import { computeArmageddonSuccessChanceFromMultiplier } from "@/lib/game/content/armageddon";
import { SEAL_COUNT } from "@/lib/game/content/armageddon";
import { rollArtifact } from "@/lib/game/artifacts";
import { logCommunityEventInTx } from "@/lib/game/community";
import {
  appendHeroEventInTx,
  upsertHeroInTx,
} from "@/lib/game/hero-registry";
import { maybeEmergeHero } from "@/lib/game/heroes";
import { recordIntelEffectInTx } from "@/lib/game/intel-effects";
import {
  applyUpgradeServer,
  armDefenseSpellServer,
  attackPreviewServer,
  attackTileServer,
  bulkBuildUnitsServer,
  bulkDistributeTilesServer,
  bulkFrontierExploreServer,
  buildUnitsServer,
  castArmageddonServer,
  castProductionSpellServer,
  changeCasteServer,
  castIntelSpellServer,
  castSpellServer,
  farExpeditionExploreServer,
  flyoverTileServer,
  frontierExploreServer,
  pepTalkHeroServer,
  GameArmageddonInProgressError,
  GameArtifactAlreadyUsedError,
  GameArtifactNotFoundError,
  GameCasteChangeUnavailableError,
  GameDefensiveStanceBlockedError,
  GameFrontierExhaustedError,
  GameInsufficientTurnsError,
  GameInvalidPhaseError,
  GameInvalidSpellError,
  GameNotAdjacentError,
  GamePlayerNotFoundError,
  GameSealsExhaustedError,
  GameSelfAttackError,
  GameShieldedError,
  GameStaleSeasonError,
  GameTileFullError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  GameTileTypeError,
  GameTileUnrevealedError,
  GameUnitCapExceededError,
  getMyMapServer,
  getOwnedTilesServer,
  meditateHeroServer,
  redistributeUnitsServer,
  removeUpgradeServer,
  siegeTileServer,
  spendArtifactServer,
  summonSpecialUnitServer,
} from "@/lib/game/data-server";
import type { Caste, GameHero } from "@/lib/game/types";
import { neighborTileIds } from "@/lib/game/world-gen";
import {
  makeChain,
  makeDoc,
  makeDocRef,
  makeFakeDb,
  makeQuerySnap,
  tsLike,
} from "@/__tests__/_helpers/firebase-admin-mock";
import {
  BASE_ATTACKER,
  BASE_DEFENDER,
  BASE_PLAYER,
  BASE_TILE,
  buildBulkMutationDb,
  buildCombatMutationDb,
  buildGameMutationDb,
  buildRedistributeMutationDb,
  makeAdjacentCombatTiles,
} from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockMaybeEmerge = maybeEmergeHero as jest.MockedFunction<typeof maybeEmergeHero>;
const mockArmaChance = computeArmageddonSuccessChanceFromMultiplier as jest.Mock;
const mockRollArtifact = rollArtifact as jest.MockedFunction<typeof rollArtifact>;

const farmHeroOnTile: GameHero = {
  id: "farm-hero-w15",
  ownerId: "u1",
  tileId: "t1",
  class: "farm",
  specialty: "food",
  name: "Harvest Warden",
  caste: "red",
  stamina: 18,
  staminaMax: 20,
  emergedAtTurn: 3,
  lastEngagedAtTurn: 3,
};

const militaryHeroOnTile: GameHero = {
  id: "mil-hero-w15",
  ownerId: "u1",
  tileId: "s1",
  class: "military",
  specialty: "ground",
  name: "Iron Marshal",
  caste: "red",
  stamina: 16,
  staminaMax: 20,
  emergedAtTurn: 2,
  lastEngagedAtTurn: 2,
};

const magicHeroOnTile: GameHero = {
  id: "magic-hero-w15",
  ownerId: "u1",
  tileId: "m1",
  class: "magic",
  specialty: "spellcasting",
  name: "Arcane Warden",
  caste: "red",
  stamina: 14,
  staminaMax: 20,
  emergedAtTurn: 4,
  lastEngagedAtTurn: 4,
};

function buildBulkDistributeDb(opts: {
  player: Record<string, unknown>;
  tiles: Array<Record<string, unknown>>;
}) {
  const playerSnap = { exists: true, data: () => opts.player };
  const tileSnaps = opts.tiles.map((t) => ({
    exists: true,
    data: () => t,
  }));
  const playerRef = { __kind: "player" };
  const tileIds = opts.tiles.map(
    (t, i) => (typeof t.tileId === "string" ? t.tileId : `t${i}`),
  );
  const tileRefs = tileIds.map((id) => ({ __kind: "tile" as const, id }));

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") return { doc: jest.fn(() => playerRef) };
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => {
            const ref = tileRefs.find((r) => r.id === id);
            return ref ?? tileRefs[0];
          }),
        };
      }
      return { doc: jest.fn() };
    }),
    runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        getAll: jest.fn().mockResolvedValue([playerSnap, ...tileSnaps]),
        update: jest.fn(),
        set: jest.fn(),
      };
      return cb(tx);
    }),
  };
  return { db };
}

function buildArmageddonDb(opts: {
  sealsBrokenBefore?: number;
  turnsRemaining?: number;
  armageddonState?: string;
  playerSeason?: number;
  worldSeason?: number;
  tilesHeld?: number;
  caste?: Caste | null;
  magicHeroOnLand?: boolean;
}) {
  const userId = "arma-w15";
  const playerRef = { id: userId, __p: true as const };
  const worldRef = { id: "singleton", __w: true as const };
  const sealsBrokenBefore = opts.sealsBrokenBefore ?? 2;
  const turnsRemaining = opts.turnsRemaining ?? 120;
  const tilesHeld = opts.tilesHeld ?? 10_050;

  const landDocs = [
    makeDoc("m1", {
      tileId: "m1",
      ownerId: userId,
      type: "magic",
      ...(opts.magicHeroOnLand
        ? {
            hero: magicHeroOnTile,
          }
        : {}),
    }),
  ];
  const landsChain = makeChain({ docs: landDocs });
  landsChain.where = jest.fn(() => landsChain);

  const playerTxn = {
    userId,
    displayName: "Breaker",
    caste: opts.caste === undefined ? ("red" as const) : opts.caste,
    phase: "play" as const,
    turnsRemaining,
    turnsSpentTotal: 50,
    seasonNumber: opts.playerSeason ?? 1,
    stats: { tilesHeld, unitsAlive: 1 },
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
            seasonNumber: opts.worldSeason ?? 1,
            sealsBroken: sealsBrokenBefore,
            seals: [],
            armageddonState: opts.armageddonState ?? "active",
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
      if (name === "game_players") return { doc: jest.fn(() => playerRef) };
      if (name === "game_world_meta") return { doc: jest.fn(() => worldRef) };
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

  return { db, tx, userId };
}

function buildMyMapDb() {
  const myTileData = {
    tileId: "0_0",
    q: 0,
    r: 0,
    ownerId: "u1",
    type: "military" as const,
    units: { ground: 1, air: 0, siege: 0 },
    baseUnits: { ground: 0, air: 0, siege: 0 },
    armedDefenseSpellId: null,
  };
  const enemyBorderData = {
    tileId: "1_0",
    q: 1,
    r: 0,
    ownerId: "u2",
    type: "military" as const,
    units: { ground: 2, air: 0, siege: 0 },
    baseUnits: { ground: 0, air: 0, siege: 0 },
    armedDefenseSpellId: null,
  };
  const unownedNeighborData = {
    tileId: "0_1",
    q: 0,
    r: 1,
    ownerId: null,
    type: "unassigned" as const,
    units: { ground: 0, air: 0, siege: 0 },
    baseUnits: { ground: 0, air: 0, siege: 0 },
    armedDefenseSpellId: null,
  };

  const myTilesSnap = makeQuerySnap([makeDoc("0_0", myTileData)]);
  const ownedQuery = {
    select: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue(myTilesSnap),
    }),
    get: jest.fn().mockResolvedValue(myTilesSnap),
  };

  const tileSnapsById: Record<string, ReturnType<typeof makeDoc>> = {
    "1_0": makeDoc("1_0", enemyBorderData),
    "0_1": makeDoc("0_1", unownedNeighborData),
  };

  const tilesChain = makeChain({});
  tilesChain.where = jest.fn().mockReturnValue(ownedQuery);
  tilesChain.select = jest.fn().mockReturnValue(ownedQuery);
  (tilesChain as { doc: jest.Mock }).doc = jest.fn((id: string) =>
    makeDocRef(id, { snap: tileSnapsById[id] ?? makeDoc(id, undefined) }),
  );

  const enemyPlayerSnap = makeDoc("u2", {
    userId: "u2",
    displayName: "Rival",
    caste: "blue",
    isNpc: false,
  });
  const playersChain = makeChain({});
  (playersChain as { doc: jest.Mock }).doc = jest.fn((uid: string) =>
    makeDocRef(uid, { snap: uid === "u2" ? enemyPlayerSnap : makeDoc(uid, undefined) }),
  );

  const getAll = jest.fn(async (...refs: Array<{ id?: string }>) =>
    refs.map((ref) => {
      const id = ref.id ?? "";
      if (id === "u2") return enemyPlayerSnap;
      return tileSnapsById[id] ?? makeDoc(id, undefined);
    }),
  );

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_tiles") return tilesChain;
      if (name === "game_players") return playersChain;
      throw new Error(`unexpected collection: ${name}`);
    }),
    getAll,
  };

  return { db, getAll };
}

function buildFrontierMonteCarloDb(tilesExplored: number) {
  const userId = "u1";
  const centroidId = "0_0";
  const playerPreData = {
    userId,
    phase: "play" as const,
    turnsRemaining: 10,
    turnsSpentTotal: 88,
    tilesExplored,
    caste: "red" as const,
    stats: {
      tilesHeld: 200,
      unitsAlive: 1,
      attacksWon: 0,
      attacksLost: 0,
      tilesCaptured: 0,
      tilesLost: 0,
    },
    activeUpgrades: {},
    productionSpellsActive: [],
  };
  const playerDocRef = {
    id: userId,
    get: jest.fn().mockResolvedValue({
      exists: true,
      id: userId,
      data: () => playerPreData,
    }),
  };
  const ownedTileSnap = makeDoc(centroidId, {
    tileId: centroidId,
    q: 0,
    r: 0,
    ownerId: userId,
    type: "military",
    units: { ground: 0, siege: 0, air: 0 },
  });
  const ownedChain = makeChain({ docs: [ownedTileSnap] });
  const tileDocById = new Map<string, { id: string }>();
  const tx = {
    get: jest.fn((ref: { id: string } | typeof playerDocRef) => {
      if (ref === playerDocRef) {
        return Promise.resolve({
          exists: true,
          id: userId,
          data: () => playerPreData,
        });
      }
      return Promise.resolve({
        exists: false,
        id: (ref as { id: string }).id,
        data: () => undefined,
      });
    }),
    set: jest.fn(),
    update: jest.fn(),
    getAll: jest.fn(),
    delete: jest.fn(),
  };
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return { doc: jest.fn(() => playerDocRef) };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => {
            if (!tileDocById.has(id)) {
              tileDocById.set(id, {
                id,
                get: jest.fn().mockResolvedValue({
                  exists: false,
                  id,
                  data: () => undefined,
                }),
              });
            }
            return tileDocById.get(id)!;
          }),
          where: jest.fn(() => ownedChain),
        };
      }
      return { doc: jest.fn(), where: jest.fn() };
    }),
    getAll: jest.fn(async (...refs: Array<{ id: string }>) =>
      refs.map((r) => ({ exists: false, id: r.id, data: () => undefined })),
    ),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  return db;
}

function buildFarExpeditionDb() {
  const playerData = {
    ...BASE_PLAYER,
    userId: "u1",
    phase: "play",
    caste: "red",
    turnsRemaining: 20,
    turnsSpentTotal: 10,
    stats: { ...BASE_PLAYER.stats, tilesHeld: 5 },
    tilesExplored: 3,
  };
  const enemyPlayer = {
    userId: "u2",
    phase: "play",
    stats: { tilesHeld: 50, unitsAlive: 0 },
  };
  const ownedTile = {
    tileId: "0_0",
    q: 0,
    r: 0,
    ownerId: "u1",
    type: "military",
    units: { ground: 1, air: 0, siege: 0 },
  };
  const enemyTile = {
    tileId: "1_0",
    q: 1,
    r: 0,
    ownerId: "u2",
    type: "military",
    units: { ground: 2, air: 0, siege: 0 },
  };
  const existingTiles = new Map<string, Record<string, unknown>>([
    ["0_0", ownedTile],
    ["1_0", enemyTile],
  ]);
  const tileDoc = (id: string) => ({ __tileId: id });
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          doc: jest.fn((id: string) => ({
            get: jest.fn().mockResolvedValue(
              makeDoc(id, id === "u1" ? playerData : undefined),
            ),
          })),
          where: jest.fn((field: string) => {
            if (field === "phase") {
              return {
                get: jest.fn().mockResolvedValue({
                  docs: [makeDoc("u1", playerData), makeDoc("u2", enemyPlayer)],
                }),
              };
            }
            return { get: jest.fn().mockResolvedValue({ docs: [] }) };
          }),
        };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => tileDoc(id)),
          where: jest.fn((_f: string, _op: string, value: string) => {
            if (value === "u1") {
              return {
                get: jest.fn().mockResolvedValue({
                  docs: [makeDoc("0_0", ownedTile)],
                }),
              };
            }
            if (value === "u2") {
              return {
                limit: jest.fn().mockReturnValue({
                  get: jest.fn().mockResolvedValue({
                    docs: [makeDoc("1_0", enemyTile)],
                  }),
                }),
              };
            }
            return { get: jest.fn().mockResolvedValue({ docs: [] }) };
          }),
        };
      }
      return { doc: jest.fn() };
    }),
    getAll: jest.fn(async (...refs: Array<{ __tileId?: string }>) =>
      refs.map((ref) => {
        const id = ref.__tileId ?? "";
        return makeDoc(id, existingTiles.get(id));
      }),
    ),
    runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(async (ref: { __tileId?: string }) => {
          if (ref?.__tileId) {
            const id = ref.__tileId;
            const raced = id !== "0_0" && id !== "1_0";
            return makeDoc(
              id,
              raced ? { tileId: id, ownerId: "u3" } : existingTiles.get(id),
            );
          }
          return makeDoc("u1", playerData);
        }),
        set: jest.fn(),
        update: jest.fn(),
      };
      return cb(tx);
    }),
  };
  return { db, playerData };
}

function foodLandDocsForSummary(count: number, heroOnFirst = true) {
  return Array.from({ length: count }, (_, i) => ({
    id: `food-${i}`,
    data: {
      ...BASE_TILE,
      tileId: `food-${i}`,
      type: "food" as const,
      hero: heroOnFirst && i === 0 ? farmHeroOnTile : undefined,
    },
  }));
}

function shieldedPlayer(overrides: Record<string, unknown> = {}) {
  return {
    ...BASE_ATTACKER,
    shieldUntil: new Date(Date.now() + 86_400_000),
    shieldDropAtTurn: 999_999,
    turnsSpentTotal: 0,
    ...overrides,
  };
}

function spendArtifactDb(artifact: Record<string, unknown>) {
  const artifactRef = { __artifact: true };
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_artifacts") return { doc: jest.fn(() => artifactRef) };
      if (name === "game_players") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ ...BASE_PLAYER, turnsSpentTotal: 9 }),
            }),
          })),
        };
      }
      return { doc: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(() =>
          Promise.resolve({
            exists: true,
            data: () => artifact,
          }),
        ),
        update: jest.fn(),
      };
      return cb(tx);
    }),
  };
  return db;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockArmaChance.mockReturnValue(0.5);
  mockMaybeEmerge.mockReturnValue(null);
  mockRollArtifact.mockReturnValue(null);
});

describe("castArmageddonServer guards (wave 15)", () => {
  it("throws GameArmageddonInProgressError when world is resolving", async () => {
    const { db, userId } = buildArmageddonDb({ armageddonState: "resolving" });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castArmageddonServer({ userId, now: new Date("2026-05-12T12:00:00.000Z") }),
    ).rejects.toBeInstanceOf(GameArmageddonInProgressError);
  });

  it("throws GameStaleSeasonError when player season lags world", async () => {
    const { db, userId } = buildArmageddonDb({
      playerSeason: 1,
      worldSeason: 2,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castArmageddonServer({ userId, now: new Date("2026-05-12T12:00:00.000Z") }),
    ).rejects.toBeInstanceOf(GameStaleSeasonError);
  });

  it("throws GameInvalidPhaseError when caste is null", async () => {
    const { db, userId } = buildArmageddonDb({ caste: null });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castArmageddonServer({ userId, now: new Date("2026-05-12T12:00:00.000Z") }),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("throws GameInvalidSpellError when below tile gate", async () => {
    const { db, userId } = buildArmageddonDb({ tilesHeld: 50 });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castArmageddonServer({ userId, now: new Date("2026-05-12T12:00:00.000Z") }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws GameSealsExhaustedError when all seals are broken", async () => {
    const { db, userId } = buildArmageddonDb({ sealsBrokenBefore: SEAL_COUNT });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castArmageddonServer({ userId, now: new Date("2026-05-12T12:00:00.000Z") }),
    ).rejects.toBeInstanceOf(GameSealsExhaustedError);
  });

  it("folds magic-hero virtual lands into the success roll", async () => {
    mockArmaChance.mockReturnValue(1);
    const { db, userId } = buildArmageddonDb({
      magicHeroOnLand: true,
      sealsBrokenBefore: 0,
    });
    mockGetAdminDb.mockReturnValue(db);
    const res = await castArmageddonServer({
      userId,
      now: new Date("2026-05-12T12:00:00.000Z"),
    });
    expect(res.success).toBe(true);
    expect(mockArmaChance).toHaveBeenCalled();
  });
});

describe("getMyMapServer border ring (wave 15)", () => {
  it("returns enemy border tiles and owner summaries", async () => {
    const { db } = buildMyMapDb();
    mockGetAdminDb.mockReturnValue(db);
    const out = await getMyMapServer("u1");
    expect(out.myTiles).toHaveLength(1);
    expect(out.borderTiles.some((t) => t.ownerId === "u2")).toBe(true);
    expect(out.owners.some((o) => o.userId === "u2")).toBe(true);
    expect(out.borderTiles.every((t) => t.ownerId !== "u1")).toBe(true);
  });

  it("skips unowned neighbor tiles in the border ring", async () => {
    const { db } = buildMyMapDb();
    mockGetAdminDb.mockReturnValue(db);
    const out = await getMyMapServer("u1");
    expect(out.borderTiles.find((t) => t.tileId === "0_1")).toBeUndefined();
  });

  it("omits owners when enemy player doc is missing", async () => {
    const { db, getAll } = buildMyMapDb();
    getAll.mockImplementation(async (...refs: Array<{ id?: string }>) =>
      refs.map((ref) => {
        const id = ref.id ?? "";
        if (id === "u2") return makeDoc("u2", undefined);
        if (id === "1_0") {
          return makeDoc("1_0", {
            tileId: "1_0",
            q: 1,
            r: 0,
            ownerId: "u2",
            type: "military",
            units: { ground: 1, air: 0, siege: 0 },
            baseUnits: { ground: 0, air: 0, siege: 0 },
          });
        }
        return makeDoc(id, undefined);
      }),
    );
    mockGetAdminDb.mockReturnValue(db);
    const out = await getMyMapServer("u1");
    expect(out.borderTiles).toHaveLength(1);
    expect(out.owners).toHaveLength(0);
  });
});

describe("getOwnedTilesServer lazy regen writeback (wave 15)", () => {
  it("fires writeback when base regen delta is positive", async () => {
    const oldBase = tsLike(new Date("2020-01-01T00:00:00.000Z"));
    const tileData = {
      tileId: "t-regen",
      q: 0,
      r: 0,
      ownerId: "u1",
      type: "military" as const,
      units: { ground: 0, air: 0, siege: 0 },
      baseUnits: { ground: 0, air: 0, siege: 0 },
      baseRegenedAt: oldBase,
      createdAt: oldBase,
      upgradeIds: [],
      intrinsicBuffs: [],
    };
    const updateMock = jest.fn().mockReturnValue({
      catch: (fn: (e: unknown) => void) => {
        fn(new Error("write failed"));
        return undefined;
      },
    });
    const tileRef = makeDocRef("t-regen", {
      update: updateMock,
      get: jest.fn(),
    });
    const tilesChain = makeChain({ docs: [makeDoc("t-regen", tileData)] });
    const playerSnap = makeDoc("u1", {
      ...BASE_PLAYER,
      caste: "red",
      productionSpellsActive: [],
    });
    const db = makeFakeDb({
      collections: {
        game_tiles: {
          ...tilesChain,
          doc: jest.fn(() => tileRef),
        },
        game_players: {
          doc: jest.fn(() => makeDocRef("u1", { snap: playerSnap })),
        },
      },
    }).db;
    mockGetAdminDb.mockReturnValue(db);

    const tiles = await getOwnedTilesServer("u1");
    expect(tiles[0]?.baseUnits?.ground).toBeGreaterThan(0);
    expect(updateMock).toHaveBeenCalled();
  });
});

describe("bulkDistributeTilesServer early-stop (wave 15)", () => {
  it("rejects more than 100 tile ids", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `t${i}`);
    const { db } = buildBulkDistributeDb({ player: BASE_PLAYER, tiles: [] });
    mockGetAdminDb.mockReturnValue(db);
    await expect(bulkDistributeTilesServer("u1", ids, "food")).rejects.toThrow(
      /at most 100/,
    );
  });

  it("throws GameInvalidPhaseError in explore phase", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "explore", turnsRemaining: 5 },
      tiles: [{ ...BASE_TILE, tileId: "t1", type: "unassigned" }],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(bulkDistributeTilesServer("u1", ["t1"], "food")).rejects.toBeInstanceOf(
      GameInvalidPhaseError,
    );
  });

  it("throws GameInsufficientTurnsError on first step at zero turns", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 0 },
      tiles: [{ ...BASE_TILE, tileId: "t1", type: "unassigned" }],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(bulkDistributeTilesServer("u1", ["t1"], "food")).rejects.toBeInstanceOf(
      GameInsufficientTurnsError,
    );
  });

  it("allows distribute phase", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "distribute", turnsRemaining: 3 },
      tiles: [{ ...BASE_TILE, tileId: "t1", type: "unassigned" }],
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkDistributeTilesServer("u1", ["t1"], "food");
    expect(result.tiles[0]?.type).toBe("food");
  });

  it("skips no-op when tile already has requested type", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 5 },
      tiles: [{ ...BASE_TILE, tileId: "t1", type: "food" }],
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkDistributeTilesServer("u1", ["t1"], "food");
    expect(result.tiles).toHaveLength(0);
    expect(result.player.turnsRemaining).toBe(5);
  });

  it("stops early when second tile is missing", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 5 },
      tiles: [
        { ...BASE_TILE, tileId: "t1", type: "unassigned" },
        { exists: false } as unknown as Record<string, unknown>,
      ],
    });
    (db.runTransaction as jest.Mock).mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        getAll: jest.fn().mockResolvedValue([
          { exists: true, data: () => ({ ...BASE_PLAYER, phase: "play", turnsRemaining: 5 }) },
          { exists: true, data: () => ({ ...BASE_TILE, tileId: "t1", type: "unassigned" }) },
          { exists: false, data: () => undefined },
        ]),
        update: jest.fn(),
        set: jest.fn(),
      };
      return cb(tx);
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkDistributeTilesServer("u1", ["t1", "t2"], "food");
    expect(result.stoppedEarly).toMatch(/not found/);
    expect(result.tiles).toHaveLength(1);
  });

  it("stops early when second tile is not owned", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 5 },
      tiles: [
        { ...BASE_TILE, tileId: "t1", type: "unassigned" },
        { ...BASE_TILE, tileId: "t2", ownerId: "u2", type: "unassigned" },
      ],
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkDistributeTilesServer("u1", ["t1", "t2"], "food");
    expect(result.stoppedEarly).toMatch(/not owned/);
  });

  it("stops early when second tile is unrevealed", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 5 },
      tiles: [
        { ...BASE_TILE, tileId: "t1", type: "unassigned" },
        { ...BASE_TILE, tileId: "t2", type: "unrevealed" },
      ],
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkDistributeTilesServer("u1", ["t1", "t2"], "magic");
    expect(result.stoppedEarly).toMatch(/unrevealed/);
  });

  it("stops early when out of turns on second step", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 1 },
      tiles: [
        { ...BASE_TILE, tileId: "t1", type: "unassigned" },
        { ...BASE_TILE, tileId: "t2", type: "unassigned" },
      ],
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkDistributeTilesServer("u1", ["t1", "t2"], "food");
    expect(result.stoppedEarly).toMatch(/out of turns/);
  });

  it("throws GameTileNotFoundError when first tile is missing", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 5 },
      tiles: [{ exists: false } as unknown as Record<string, unknown>],
    });
    (db.runTransaction as jest.Mock).mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        getAll: jest.fn().mockResolvedValue([
          { exists: true, data: () => BASE_PLAYER },
          { exists: false, data: () => undefined },
        ]),
        update: jest.fn(),
        set: jest.fn(),
      };
      return cb(tx);
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(bulkDistributeTilesServer("u1", ["t1"], "food")).rejects.toBeInstanceOf(
      GameTileNotFoundError,
    );
  });

  it("throws GameTileUnrevealedError when first tile is unrevealed", async () => {
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 5 },
      tiles: [{ ...BASE_TILE, tileId: "t1", type: "unrevealed" }],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(bulkDistributeTilesServer("u1", ["t1"], "food")).rejects.toBeInstanceOf(
      GameTileUnrevealedError,
    );
  });
});

describe("buildUnitsServer farm hero paths (wave 15)", () => {
  it("logs recruited and special-unit events for farm hero tiles", async () => {
    const foodTile = {
      ...BASE_TILE,
      type: "food" as const,
      hero: farmHeroOnTile,
    };
    const { db } = buildGameMutationDb({
      ownedTileDocs: foodLandDocsForSummary(8),
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          stats: { unitsAlive: 0, tilesHeld: 100 },
          summonableSpecialUnits: [],
        },
      },
      tile: { exists: true, data: foodTile },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await buildUnitsServer("u1", "t1", "ground");
    expect(result.produced).toBeGreaterThan(0);
    expect(appendHeroEventInTx).toHaveBeenCalled();
  });
});

describe("bulkBuildUnitsServer farm hero paths (wave 15)", () => {
  it("applies kingdom-wide farm hero recruit buff", async () => {
    const foodTile = {
      ...BASE_TILE,
      tileId: "food-0",
      type: "food" as const,
      hero: farmHeroOnTile,
    };
    const { db } = buildBulkMutationDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        caste: "red",
        turnsRemaining: 50,
        stats: { unitsAlive: 0, tilesHeld: 100 },
      },
      tiles: [{ id: "food-0", data: foodTile }],
      ownedTileDocs: foodLandDocsForSummary(8),
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkBuildUnitsServer("u1", [
      { tileId: "food-0", unitType: "ground", cycles: 1 },
    ]);
    expect(result.produced).toBeGreaterThan(5);
  });

  it("emerges a farm hero during bulk build on food tile", async () => {
    mockMaybeEmerge.mockReturnValue(farmHeroOnTile);
    const foodTile = { ...BASE_TILE, tileId: "t1", type: "food" as const, hero: null };
    const { db } = buildBulkMutationDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        caste: "red",
        turnsRemaining: 50,
        stats: { unitsAlive: 0, tilesHeld: 100 },
      },
      tiles: [{ id: "food-0", data: foodTile }],
      ownedTileDocs: foodLandDocsForSummary(8, true),
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkBuildUnitsServer("u1", [
      { tileId: "food-0", unitType: "ground", cycles: 1 },
    ]);
    expect(result.tiles[0]?.hero?.id).toBe(farmHeroOnTile.id);
    expect(upsertHeroInTx).toHaveBeenCalled();
  });

  it("throws GameTileTypeError for unassigned land", async () => {
    const { db } = buildBulkMutationDb({
      player: { ...BASE_PLAYER, phase: "play", caste: "red", turnsRemaining: 10 },
      tiles: [{ id: "t1", data: { ...BASE_TILE, type: "unassigned" } }],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      bulkBuildUnitsServer("u1", [{ tileId: "t1", unitType: "ground", cycles: 1 }]),
    ).rejects.toBeInstanceOf(GameTileTypeError);
  });

  it("stops early when unit cap is hit after first cycle", async () => {
    const foodTile = { ...BASE_TILE, tileId: "food-0", type: "food" as const };
    const { db } = buildBulkMutationDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        caste: "red",
        turnsRemaining: 50,
        stats: { unitsAlive: 0, tilesHeld: 100 },
      },
      tiles: [{ id: "food-0", data: foodTile }],
      ownedTileDocs: foodLandDocsForSummary(1, false),
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkBuildUnitsServer("u1", [
      { tileId: "food-0", unitType: "ground", cycles: 3 },
    ]);
    expect(result.stoppedEarly).toMatch(/unit cap/);
    expect(result.produced).toBeGreaterThan(0);
  });
});

describe("castProductionSpellServer guards (wave 15)", () => {
  it("throws GameInvalidPhaseError outside play", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, phase: "explore", caste: "red" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castProductionSpellServer("u1", "red-production-forge-boon"),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("throws when player lacks min tiles for production spell", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 20,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 10 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castProductionSpellServer("u1", "red-production-bellows-rite-t2"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws GameInsufficientTurnsError when out of turns", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 0,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 5000 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castProductionSpellServer("u1", "red-production-forge-boon"),
    ).rejects.toBeInstanceOf(GameInsufficientTurnsError);
  });
});

describe("armDefenseSpellServer (wave 15)", () => {
  it("throws when tile is unrevealed", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: { ...BASE_PLAYER, phase: "play", caste: "red", stats: { ...BASE_PLAYER.stats, tilesHeld: 5000 } },
      },
      tile: { exists: true, data: { ...BASE_TILE, type: "unrevealed" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      armDefenseSpellServer("u1", "t1", "red-defense-fire-wall"),
    ).rejects.toBeInstanceOf(GameTileUnrevealedError);
  });

  it("throws when spell is not defense type", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, phase: "play", caste: "red" } },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      armDefenseSpellServer("u1", "t1", "red-offense-inferno"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws when player lacks min tiles for spell", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 20,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 10 },
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, type: "magic" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      armDefenseSpellServer("u1", "t1", "red-defense-ember-hail-t2"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("emerges magic hero when arming on magic tile", async () => {
    mockMaybeEmerge.mockReturnValue(magicHeroOnTile);
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 20,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 5000 },
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, type: "magic", hero: null } },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await armDefenseSpellServer("u1", "t1", "red-defense-fire-wall");
    expect(result.tile.hero?.class).toBe("magic");
    expect(logCommunityEventInTx).toHaveBeenCalled();
    expect(upsertHeroInTx).toHaveBeenCalled();
  });
});

describe("castIntelSpellServer (wave 15)", () => {
  it("throws for unknown spell id", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
      tile: { exists: true, data: { ...BASE_TILE, ownerId: "u2" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castIntelSpellServer("u1", "not-real-intel", "t1"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws when spell is not intel type", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, caste: "red" } },
      tile: { exists: true, data: { ...BASE_TILE, ownerId: "u2" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castIntelSpellServer("u1", "red-defense-fire-wall", "t1"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws when caste does not match spell", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: { ...BASE_PLAYER, caste: "blue", stats: { ...BASE_PLAYER.stats, tilesHeld: 5000 } },
      },
      tile: { exists: true, data: { ...BASE_TILE, ownerId: "u2" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castIntelSpellServer("u1", "red-intel-forge-sight-t2", "t1"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("records alert effect for black vein of truth", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "black",
          turnsRemaining: 20,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 5000, unitsAlive: 5 },
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, ownerId: "u2" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await castIntelSpellServer("u1", "black-intel-vein-of-truth-t2", "t1");
    expect(recordIntelEffectInTx).toHaveBeenCalled();
  });

  it("records alert effect for green root whisper", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "green",
          turnsRemaining: 20,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 5000 },
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, ownerId: "u2" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await castIntelSpellServer("u1", "green-intel-root-whisper-t2", "t1");
    expect(recordIntelEffectInTx).toHaveBeenCalled();
  });
});

describe("attackTileServer hero and stance guards (wave 15)", () => {
  it("throws GameInvalidPhaseError when attacker caste is null", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, caste: null },
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("throws GameDefensiveStanceBlockedError when source is in stance", async () => {
    const tiles = makeAdjacentCombatTiles();
    const stanceUntil = new Date(Date.now() + 60_000);
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: {
        ...tiles.source,
        defensiveStance: { active: true, since: new Date(), lockedUntil: stanceUntil },
      },
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameDefensiveStanceBlockedError);
  });

  it("throws when offense spell needs more tiles than held", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, stats: { ...BASE_ATTACKER.stats, tilesHeld: 10 } },
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: "red-offense-magma-spear-t2",
      }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("resolves attack with military hero and stationed special unit bonuses", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 50, air: 0, siege: 0 },
    });
    const { db } = buildCombatMutationDb({
      attacker: {
        ...BASE_ATTACKER,
        summonableSpecialUnits: [
          {
            instanceId: "su-1",
            defId: "red-forge-bound",
            spawnedAtTurn: 1,
            stationedTileId: tiles.sourceTileId,
          },
        ],
      },
      defender: BASE_DEFENDER,
      source: { ...tiles.source, hero: militaryHeroOnTile },
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      ownedTileDocs: [{ id: tiles.sourceTileId, data: tiles.source }],
    });
    mockGetAdminDb.mockReturnValue(db as never);
    const result = await attackTileServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 10, air: 0, siege: 0 },
      offenseSpellId: null,
    });
    expect(result.combat).toBeDefined();
  });
});

describe("attackPreviewServer validation (wave 15)", () => {
  it("throws on invalid unit stack shape", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackPreviewServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: -1, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toThrow(/Invalid units stack/);
  });

  it("throws GameShieldedError when attacker is shielded", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: shieldedPlayer(),
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackPreviewServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameShieldedError);
  });

  it("throws when offense spell min tiles not met", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, stats: { ...BASE_ATTACKER.stats, tilesHeld: 5 } },
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackPreviewServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: "red-offense-magma-spear-t2",
      }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws when defender caste is null", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: { ...BASE_DEFENDER, caste: null },
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackPreviewServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("reads friendly neighbors for supply in preview", async () => {
    const tiles = makeAdjacentCombatTiles();
    const neighborId = neighborTileIds(tiles.target.q, tiles.target.r)[0];
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      ownedTileDocs: [
        { id: tiles.sourceTileId, data: tiles.source },
        {
          id: neighborId,
          data: {
            tileId: neighborId,
            q: 1,
            r: 1,
            ownerId: "u2",
            type: "food",
            units: { ground: 0, air: 0, siege: 0 },
          },
        },
      ],
    });
    mockGetAdminDb.mockReturnValue(db as never);
    const preview = await attackPreviewServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 5, air: 0, siege: 0 },
      offenseSpellId: null,
    });
    expect(preview.combat).toBeDefined();
  });
});

describe("siegeTileServer (wave 15)", () => {
  it("throws GameInvalidPhaseError outside play phase", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, phase: "explore" },
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      siegeTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });
});

describe("flyoverTileServer (wave 15)", () => {
  it("throws on invalid units stack", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      flyoverTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: -2, air: 0, siege: 0 },
      }),
    ).rejects.toThrow(/Invalid units stack/);
  });

  it("throws GameShieldedError when defender is shielded", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 0, air: 20, siege: 0 },
    });
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: shieldedPlayer({ ...BASE_DEFENDER, userId: "u2" }),
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      flyoverTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 0, air: 5, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameShieldedError);
  });
});

describe("castSpellServer branches (wave 15)", () => {
  it("throws when attacker caste is null", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, caste: null },
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      castSpellServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        spellId: "red-siege-firebreath",
      }),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("throws GameInvalidSpellError for non-castable spell types", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      castSpellServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        spellId: "red-offense-inferno",
      }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("emerges magic hero when casting from magic source tile", async () => {
    mockMaybeEmerge.mockReturnValue(magicHeroOnTile);
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: { ...tiles.source, type: "magic", hero: null },
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      ownedTileDocs: [
        { id: tiles.sourceTileId, data: { ...tiles.source, type: "magic" } },
      ],
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await castSpellServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      spellId: "red-siege-firebreath",
    });
    expect(logCommunityEventInTx).toHaveBeenCalled();
    expect(upsertHeroInTx).toHaveBeenCalled();
  });

  it("applies magic-hero spell multiplier when hero is on source tile", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: { ...tiles.source, type: "magic", hero: magicHeroOnTile },
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      ownedTileDocs: [
        {
          id: tiles.sourceTileId,
          data: { ...tiles.source, type: "magic", hero: magicHeroOnTile },
        },
      ],
    });
    mockGetAdminDb.mockReturnValue(db as never);
    const result = await castSpellServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      spellId: "red-siege-firebreath",
    });
    expect(result.player.turnsRemaining).toBeLessThan(BASE_ATTACKER.turnsRemaining);
  });
});

describe("frontierExploreServer monte carlo (wave 15)", () => {
  it("claims via monte carlo when tilesExplored exceeds threshold", async () => {
    const db = buildFrontierMonteCarloDb(200);
    mockGetAdminDb.mockReturnValue(db);
    const out = await frontierExploreServer("u1", new Date("2026-06-01T00:00:00.000Z"));
    expect(out.tile.ownerId).toBe("u1");
    expect(out.frontier.riskScore).toBeGreaterThanOrEqual(0);
  });

  it("includes hostile-neighbor risk line when neighbors are enemy-owned", async () => {
    const db = buildFrontierMonteCarloDb(40);
    const enemyNeighbor = {
      tileId: "1_0",
      q: 1,
      r: 0,
      ownerId: "u2",
      type: "military",
    };
    (db.getAll as jest.Mock).mockImplementation(async (...refs: Array<{ id: string }>) =>
      refs.map((r) => {
        if (r.id === "1_0") {
          return { exists: true, id: "1_0", data: () => enemyNeighbor };
        }
        return { exists: false, id: r.id, data: () => undefined };
      }),
    );
    mockGetAdminDb.mockReturnValue(db);
    const out = await frontierExploreServer("u1");
    expect(out.report.narrative.some((n) => n.includes("Risk"))).toBe(true);
    expect(out.frontier.hostileNeighbors).toBeGreaterThanOrEqual(0);
  });
});

describe("farExpeditionExploreServer races (wave 15)", () => {
  it("throws GameInsufficientTurnsError when turns are too low", async () => {
    const { db, playerData } = buildFarExpeditionDb();
    const lowTurns = { ...playerData, turnsRemaining: 0 };
    (db.collection as jest.Mock).mockImplementation((name: string) => {
      if (name === "game_players") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => lowTurns,
            }),
          })),
          where: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ docs: [] }),
          })),
        };
      }
      return { doc: jest.fn(), where: jest.fn() };
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(farExpeditionExploreServer("u1")).rejects.toBeInstanceOf(
      GameInsufficientTurnsError,
    );
  });

  it("throws GameFrontierExhaustedError when drop tile was claimed in txn", async () => {
    const { db } = buildFarExpeditionDb();
    mockGetAdminDb.mockReturnValue(db);
    await expect(farExpeditionExploreServer("u1")).rejects.toBeInstanceOf(
      GameFrontierExhaustedError,
    );
  });
});

describe("spendArtifactServer errors (wave 15)", () => {
  it("throws GameArtifactNotFoundError when doc missing", async () => {
    const db = spendArtifactDb({});
    (db.runTransaction as jest.Mock).mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        get: jest.fn().mockResolvedValue({ exists: false }),
        update: jest.fn(),
      };
      return cb(tx);
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      spendArtifactServer({ userId: "u1", artifactId: "missing" }),
    ).rejects.toBeInstanceOf(GameArtifactNotFoundError);
  });

  it("throws GameArtifactNotFoundError for wrong owner", async () => {
    const db = spendArtifactDb({
      ownerId: "u2",
      used: false,
      definitionId: "red-artifact-1",
      foundAtTurn: 1,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      spendArtifactServer({ userId: "u1", artifactId: "a1" }),
    ).rejects.toBeInstanceOf(GameArtifactNotFoundError);
  });

  it("throws GameArtifactAlreadyUsedError", async () => {
    const db = spendArtifactDb({
      ownerId: "u1",
      used: true,
      definitionId: "red-artifact-1",
      foundAtTurn: 1,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      spendArtifactServer({ userId: "u1", artifactId: "a1" }),
    ).rejects.toBeInstanceOf(GameArtifactAlreadyUsedError);
  });

  it("throws GameInvalidSpellError for intel without target tile", async () => {
    const db = spendArtifactDb({
      ownerId: "u1",
      used: false,
      definitionId: "common-whispered-map",
      foundAtTurn: 1,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      spendArtifactServer({ userId: "u1", artifactId: "a1" }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });
});

describe("bulkBuildUnitsServer validation (wave 15)", () => {
  it("throws GameInvalidPhaseError outside play phase", async () => {
    const { db } = buildBulkMutationDb({
      player: { ...BASE_PLAYER, phase: "explore" },
      tiles: [{ id: "t1", data: { ...BASE_TILE, type: "military" } }],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      bulkBuildUnitsServer("u1", [{ tileId: "t1", unitType: "ground", cycles: 1 }]),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("throws GameInsufficientTurnsError on first cycle at zero turns", async () => {
    const { db } = buildBulkMutationDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        caste: "red",
        turnsRemaining: 0,
        stats: { unitsAlive: 0, tilesHeld: 100 },
      },
      tiles: [{ id: "t1", data: { ...BASE_TILE, type: "military" } }],
      ownedTileDocs: [{ id: "t1", data: { ...BASE_TILE, type: "military" } }],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      bulkBuildUnitsServer("u1", [{ tileId: "t1", unitType: "ground", cycles: 1 }]),
    ).rejects.toBeInstanceOf(GameInsufficientTurnsError);
  });
});

describe("applyUpgradeServer / removeUpgradeServer errors (wave 15)", () => {
  const upgradeId = "red-ground-marauder-upgrade-1";
  const targetId = "red-ground-marauder";

  it("apply throws GameInvalidPhaseError outside play", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, phase: "explore" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      applyUpgradeServer({ userId: "u1", targetId, upgradeId }),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("apply throws GameInsufficientTurnsError at zero turns", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 0,
          activeUpgrades: {},
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      applyUpgradeServer({ userId: "u1", targetId, upgradeId }),
    ).rejects.toBeInstanceOf(GameInsufficientTurnsError);
  });

  it("remove throws GameInvalidPhaseError outside play", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "distribute",
          activeUpgrades: { [targetId]: upgradeId },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(removeUpgradeServer({ userId: "u1", targetId })).rejects.toBeInstanceOf(
      GameInvalidPhaseError,
    );
  });
});

function buildBulkFrontierMonteCarloDb() {
  const userId = "u1";
  const playerPre = {
    userId,
    phase: "play" as const,
    turnsRemaining: 8,
    turnsSpentTotal: 200,
    tilesExplored: 200,
    caste: "red" as const,
    stats: { tilesHeld: 200, unitsAlive: 1, attacksWon: 0, attacksLost: 0 },
    activeUpgrades: {},
    productionSpellsActive: [],
  };
  const playerDocRef = {
    id: userId,
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => playerPre,
    }),
  };
  const ownedDocs = Array.from({ length: 12 }, (_, i) =>
    makeDoc(`${i}_0`, {
      tileId: `${i}_0`,
      q: i,
      r: 0,
      ownerId: userId,
      type: "food",
    }),
  );
  const ownedChain = makeChain({ docs: ownedDocs });
  const tilesDocById = new Map<string, { id: string }>();
  const tx = {
    getAll: jest.fn((...refs: Array<{ id: string }>) =>
      Promise.resolve(
        refs.map((ref, idx) => {
          if (idx === 0) {
            return { exists: true, id: userId, data: () => playerPre };
          }
          if (idx === 1) {
            return { exists: true, id: ref.id, data: () => ({}) };
          }
          return { exists: false, id: ref.id, data: () => undefined };
        }),
      ),
    ),
    set: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
  };
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return { doc: jest.fn(() => playerDocRef), where: jest.fn() };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => {
            if (!tilesDocById.has(id)) {
              tilesDocById.set(id, {
                id,
                get: jest.fn().mockResolvedValue({
                  exists: false,
                  id,
                  data: () => undefined,
                }),
              });
            }
            return tilesDocById.get(id)!;
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

describe("bulkFrontierExploreServer monte carlo (wave 15)", () => {
  it("claims multiple tiles using monte carlo prefetch", async () => {
    const { db, userId } = buildBulkFrontierMonteCarloDb();
    mockGetAdminDb.mockReturnValue(db);
    const out = await bulkFrontierExploreServer(userId, 2);
    expect(out.tiles.length).toBeGreaterThanOrEqual(1);
    expect(out.player.turnsRemaining).toBeLessThan(8);
  });
});

describe("changeCasteServer phase guard (wave 15)", () => {
  it("throws when player has no caste yet", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: null,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 1000 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(changeCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GameCasteChangeUnavailableError,
    );
  });

  it("throws when new caste matches current caste", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          stats: { ...BASE_PLAYER.stats, tilesHeld: 1000 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(changeCasteServer("u1", "red")).rejects.toBeInstanceOf(
      GameCasteChangeUnavailableError,
    );
  });

  it("throws GameCasteChangeUnavailableError below tile threshold", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          casteChangesUsed: 0,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 50 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(changeCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GameCasteChangeUnavailableError,
    );
  });

  it("throws when caste change already used", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          casteChangesUsed: 1,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 1000 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(changeCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GameCasteChangeUnavailableError,
    );
  });

  it("throws GameInvalidPhaseError outside play", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "explore",
          caste: "red",
          stats: { ...BASE_PLAYER.stats, tilesHeld: 1000 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(changeCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GameInvalidPhaseError,
    );
  });
});

describe("attackTileServer defender caste guard (wave 15)", () => {
  it("throws GameInvalidPhaseError when defender caste is null", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: { ...BASE_DEFENDER, caste: null },
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });
});

describe("flyoverTileServer guards (wave 15)", () => {
  it("throws GameInvalidPhaseError when attacker is not in play", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 0, air: 10, siege: 0 },
    });
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, phase: "explore" },
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      flyoverTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 0, air: 5, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("throws GameNotAdjacentError when target is not neighboring source", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 0, air: 10, siege: 0 },
    });
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: { ...tiles.source, neighborTileIds: [] },
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      flyoverTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 0, air: 5, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameNotAdjacentError);
  });
});

describe("summonSpecialUnitServer (wave 15)", () => {
  it("stations an unassigned special unit on an owned tile", async () => {
    const instance = {
      instanceId: "su-w15",
      defId: "red-forge-bound",
      spawnedAtTurn: 1,
    };
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          summonableSpecialUnits: [instance],
        },
      },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await summonSpecialUnitServer({
      userId: "u1",
      instanceId: "su-w15",
      targetTileId: "t1",
    });
    expect(result.tileId).toBe("t1");
    expect(result.player.summonableSpecialUnits?.[0]?.stationedTileId).toBe("t1");
    expect(tx.update).toHaveBeenCalled();
  });

  it("throws GamePlayerNotFoundError when player is missing", async () => {
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({})),
      })),
      runTransaction: jest.fn(async (cb: (tx: unknown) => unknown) => {
        const tx = {
          get: jest.fn().mockResolvedValue({ exists: false }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      summonSpecialUnitServer({
        userId: "u1",
        instanceId: "missing",
        tileId: "t1",
      }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });
});

describe("meditateHeroServer success (wave 15)", () => {
  it("sets meditatingUntil when a slot is available", async () => {
    const hero = { ...magicHeroOnTile, meditatingUntil: undefined };
    const playerRef = { id: "u1", __p: true as const };
    const tileRef = { id: "t1", __t: true as const };
    const tileData = { ...BASE_TILE, hero };
    const ownedTileDoc = makeDoc("t1", tileData);
    const tx = {
      get: jest.fn((ref: typeof playerRef | typeof tileRef) => {
        if (ref.__p) {
          return Promise.resolve({
            exists: true,
            data: () => ({ ...BASE_PLAYER, turnsRemaining: 5, turnsSpentTotal: 9 }),
          });
        }
        if (ref.__t) {
          return Promise.resolve({ exists: true, data: () => tileData });
        }
        return Promise.resolve({ exists: false });
      }),
      update: jest.fn(),
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((col: string) => {
        if (col === "game_players") return { doc: jest.fn(() => playerRef) };
        if (col === "game_tiles") {
          return {
            doc: jest.fn(() => tileRef),
            where: jest.fn(() => makeChain({ docs: [ownedTileDoc] })),
          };
        }
        if (col === "game_heroes") {
          return { doc: jest.fn(() => ({ id: hero.id })) };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    });
    const now = new Date("2026-06-15T12:00:00.000Z");
    const out = await meditateHeroServer({ callerUserId: "u1", tileId: "t1", now });
    expect(out.hero?.meditatingUntil).toBeDefined();
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("pepTalkHeroServer success (wave 15)", () => {
  function buildPepTalkDb() {
    const hero = { ...farmHeroOnTile, stamina: 5 };
    const playerRef = { id: "u1", __p: true as const };
    const tileRef = { id: "t1", __t: true as const };
    const tileData = { ...BASE_TILE, tileId: "t1", ownerId: "u1", hero };
    const tx = {
      get: jest.fn((ref: typeof playerRef | typeof tileRef) => {
        if (ref.__p) {
          return Promise.resolve({
            exists: true,
            data: () => ({ ...BASE_PLAYER, turnsRemaining: 0, turnsSpentTotal: 9 }),
          });
        }
        if (ref.__t) {
          return Promise.resolve({ exists: true, data: () => tileData });
        }
        return Promise.resolve({ exists: false });
      }),
      update: jest.fn(),
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((col: string) => {
        if (col === "game_players") return { doc: jest.fn(() => playerRef) };
        if (col === "game_tiles") {
          return {
            doc: jest.fn(() => tileRef),
            where: jest.fn(() => makeChain({ docs: [makeDoc("t1", tileData)] })),
          };
        }
        if (col === "game_heroes") {
          return { doc: jest.fn(() => ({ id: hero.id })) };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    });
    return { tx };
  }

  it("tops up hero stamina at zero turns", async () => {
    const { tx } = buildPepTalkDb();
    const out = await pepTalkHeroServer({ callerUserId: "u1", tileId: "t1" });
    expect(out.hero?.stamina).toBeGreaterThan(5);
    expect(tx.update).toHaveBeenCalledTimes(2);
  });
});

describe("redistributeUnitsServer dest guards (wave 15)", () => {
  it("throws GameTileNotOwnedError when destination is foreign", async () => {
    const { db } = buildRedistributeMutationDb({
      player: { ...BASE_PLAYER, recentRedistributions: [] },
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
        units: { ground: 5, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("throws GameTileFullError when destination would exceed capacity", async () => {
    const { db } = buildRedistributeMutationDb({
      player: { ...BASE_PLAYER, caste: "red", recentRedistributions: [] },
      source: {
        ...BASE_TILE,
        tileId: "s",
        type: "military",
        neighborTileIds: ["d"],
        units: { ground: 50, air: 0, siege: 0 },
      },
      dest: {
        ...BASE_TILE,
        tileId: "d",
        type: "military",
        units: { ground: 999, air: 0, siege: 0 },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 20, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameTileFullError);
  });

  it("throws GameNotAdjacentError when dest is not a neighbor", async () => {
    const { db } = buildRedistributeMutationDb({
      player: { ...BASE_PLAYER, recentRedistributions: [] },
      source: {
        ...BASE_TILE,
        tileId: "s",
        neighborTileIds: ["other"],
        units: { ground: 10, air: 0, siege: 0 },
      },
      dest: { ...BASE_TILE, tileId: "d", ownerId: "u1" },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 1, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameNotAdjacentError);
  });
});
