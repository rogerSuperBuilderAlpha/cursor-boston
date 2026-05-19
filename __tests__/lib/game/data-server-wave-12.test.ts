/**
 * @jest-environment node
 *
 * Wave 12 — remaining data-server branches: combat outcomes, spell kinds,
 * explore/distribute artifacts, build air/siege/cap, summons, preview,
 * eligibility, last stand, hero errors, redistribute, defensive stance on.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/world-gen", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/world-gen")>(
    "@/lib/game/world-gen",
  );
  return {
    ...actual,
    makeSeededRng: actual.makeSeededRng,
  };
});

jest.mock("@/lib/game/turn-report", () => ({
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
  buildCastSpellReport: jest.fn(() => ({ kind: "cast" })),
  buildDistributeReport: jest.fn(() => ({ kind: "distribute" })),
  buildExploreReport: jest.fn(() => ({ kind: "explore" })),
  buildBuildReport: jest.fn(() => ({ kind: "build" })),
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
  recordDefenseDisarmInTx: jest.fn(),
  recordIntelEffectInTx: jest.fn(),
  recordSiegeDebuffInTx: jest.fn(),
}));
jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn(),
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
import { rollArtifact } from "@/lib/game/artifacts";
import { ALL_ARTIFACTS } from "@/lib/game/content/artifacts";
import {
  attackPreviewServer,
  attackTileServer,
  buildUnitsServer,
  castSpellServer,
  declareLastStandServer,
  distributeTileServer,
  exploreNextTileServer,
  GameDefensiveStanceCapError,
  GameHeroAlreadyMeditatingError,
  GameHeroNotFoundError,
  GameHeroNotOwnedError,
  GameInsufficientUnitsError,
  GameInvalidSpellError,
  GameLastStandCooldownError,
  GameLastStandNoThreatError,
  GameLastStandRequiresZeroTurnsError,
  GameShieldedError,
  GameSpecialUnitAlreadyStationedError,
  GameSpecialUnitNotFoundError,
  GameUnitCapExceededError,
  getOwnedMapTilesServer,
  getPlayerEligibilityServer,
  meditateHeroServer,
  pepTalkHeroServer,
  redistributeUnitsServer,
  summonSpecialUnitServer,
  toggleDefensiveStanceServer,
  unsummonSpecialUnitServer,
} from "@/lib/game/data-server";
import { recordDefenseDisarmInTx, recordSiegeDebuffInTx } from "@/lib/game/intel-effects";
import type { UnitStack } from "@/lib/game/types";
import {
  LAST_STAND_COOLDOWN_MS,
  LAST_STAND_THREAT_WINDOW_MS,
} from "@/lib/game/types";
import {
  makeChain,
  makeDoc,
  makeFakeDb,
  makeQuerySnap,
} from "@/__tests__/_helpers/firebase-admin-mock";
import {
  BASE_ATTACKER,
  BASE_DEFENDER,
  BASE_PLAYER,
  BASE_TILE,
  buildCombatMutationDb,
  buildGameMutationDb,
  buildRedistributeMutationDb,
  makeAdjacentCombatTiles,
} from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRollArtifact = rollArtifact as jest.MockedFunction<typeof rollArtifact>;

const SAMPLE_ARTIFACT = ALL_ARTIFACTS[0]!;

function foodLandDocs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `food-${i}`,
    data: {
      ...BASE_TILE,
      tileId: `food-${i}`,
      type: "food" as const,
      units: { ground: 0, air: 0, siege: 0 },
    },
  }));
}

function combatDb(overrides?: Partial<Parameters<typeof buildCombatMutationDb>[0]>) {
  const tiles = makeAdjacentCombatTiles();
  return buildCombatMutationDb({
    attacker: BASE_ATTACKER,
    defender: BASE_DEFENDER,
    source: tiles.source,
    target: tiles.target,
    sourceTileId: tiles.sourceTileId,
    targetTileId: tiles.targetTileId,
    ownedTileDocs: [{ id: tiles.sourceTileId, data: tiles.source }],
    ...overrides,
  });
}

function shieldedPlayer(overrides: Record<string, unknown> = {}) {
  return {
    ...BASE_DEFENDER,
    shieldUntil: new Date(Date.now() + 86_400_000),
    shieldDropAtTurn: 999,
    turnsSpentTotal: 0,
    ...overrides,
  };
}

function withHeroesCollection(db: ReturnType<typeof buildGameMutationDb>["db"]) {
  const baseCollection = db.collection.getMockImplementation()!;
  db.collection = jest.fn((name: string) => {
    if (name === "game_heroes") {
      return { doc: jest.fn((id: string) => ({ id })) };
    }
    return baseCollection(name);
  });
  return db;
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
    const { db } = buildCombatMutationDb({
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
    if (result.combat.outcome === outcome) {
      return result;
    }
  }
  throw new Error(`Could not produce combat outcome "${outcome}" within 250 seeds`);
  } finally {
    uuidSpy.mockRestore();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRollArtifact.mockReturnValue(null);
});

describe("attackTileServer combat outcomes", () => {
  it("repelled: defender keeps the tile", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 3, air: 0, siege: 0 },
      targetUnits: { ground: 400, air: 50, siege: 50 },
    });
    const result = await attackUntilOutcome(
      "repelled",
      () => ({
        source: {
          ...tiles.source,
          baseUnits: { ground: 0, air: 0, siege: 0 },
        },
        target: {
          ...tiles.target,
          baseUnits: { ground: 200, air: 0, siege: 0 },
        },
      }),
      { ground: 3, air: 0, siege: 0 },
    );
    expect(result.targetTile.ownerId).toBe("u2");
  });

  it("stalemate: neither side captures the tile", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 40, air: 40, siege: 40 },
      targetUnits: { ground: 40, air: 40, siege: 40 },
    });
    const result = await attackUntilOutcome(
      "stalemate",
      () => ({
        attacker: { ...BASE_ATTACKER, caste: "white" },
        defender: { ...BASE_DEFENDER, caste: "white" },
        source: tiles.source,
        target: tiles.target,
      }),
      { ground: 40, air: 40, siege: 40 },
    );
    expect(result.targetTile.ownerId).toBe("u2");
    expect(result.combat.outcome).toBe("stalemate");
  });

  it("captured: attacker takes ownership on a decisive win", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 120, air: 0, siege: 0 },
      targetUnits: { ground: 1, air: 0, siege: 0 },
    });
    const result = await attackUntilOutcome(
      "captured",
      () => ({ source: tiles.source, target: tiles.target }),
      { ground: 80, air: 0, siege: 0 },
    );
    expect(result.targetTile.ownerId).toBe("u1");
  });
});

describe("castSpellServer spell categories", () => {
  it("siege branch records debuff magnitude", async () => {
    const { db } = combatDb();
    mockGetAdminDb.mockReturnValue(db as never);
    const tiles = makeAdjacentCombatTiles();
    const result = await castSpellServer({
      attackerId: "u1",
      spellId: "red-siege-firebreath",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    expect(result.siege).toBeDefined();
    expect(recordSiegeDebuffInTx).toHaveBeenCalled();
  });

  it("disarm branch records defense disarm fraction", async () => {
    const { db } = combatDb();
    mockGetAdminDb.mockReturnValue(db as never);
    const tiles = makeAdjacentCombatTiles();
    const result = await castSpellServer({
      attackerId: "u1",
      spellId: "red-disarm-cinderbreak",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    expect(result.disarm).toBeDefined();
    expect(recordDefenseDisarmInTx).toHaveBeenCalled();
  });

  it("attrition branch kills units on the target tile", async () => {
    const tiles = makeAdjacentCombatTiles({
      targetUnits: { ground: 30, air: 0, siege: 0 },
    });
    const { db } = combatDb({ source: tiles.source, target: tiles.target });
    mockGetAdminDb.mockReturnValue(db as never);
    const result = await castSpellServer({
      attackerId: "u1",
      spellId: "red-attrition-emberswarm",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    expect(result.attrition).toBeDefined();
    expect(result.attrition!.targetTile.units.ground).toBeLessThan(30);
  });

  it("throws GameInvalidSpellError for non cast-able spell types", async () => {
    const { db } = combatDb();
    mockGetAdminDb.mockReturnValue(db as never);
    const tiles = makeAdjacentCombatTiles();
    await expect(
      castSpellServer({
        attackerId: "u1",
        spellId: "red-production-forge-boon",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });
});

describe("exploreNextTileServer artifact roll", () => {
  it("stages an artifact when rollArtifact returns a definition", async () => {
    mockRollArtifact.mockReturnValue(SAMPLE_ARTIFACT);
    const { db, tx } = buildGameMutationDb({
      unrevealedDocs: [{ id: "t1", data: { ...BASE_TILE, type: "unrevealed" } }],
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "explore",
          turnsRemaining: 5,
          tilesExplored: 10,
          caste: "red",
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, type: "unrevealed" } },
    });
    withHeroesCollection(db);
    mockGetAdminDb.mockReturnValue(db);

    const result = await exploreNextTileServer("u1");
    expect(result.artifact).not.toBeNull();
    expect(result.artifact?.definitionId).toBe(SAMPLE_ARTIFACT.id);
    expect(tx.set).toHaveBeenCalled();
  });
});

describe("distributeTileServer land types", () => {
  const distributable = ["military", "food", "magic", "unassigned"] as const;

  it.each(distributable)("assigns type %s and spends a turn", async (landType) => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          turnsRemaining: 8,
          caste: "red",
        },
      },
      tile: {
        exists: true,
        data: { ...BASE_TILE, type: "unassigned" as const },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await distributeTileServer("u1", "t1", landType);
    expect(result.tile.type).toBe(landType);
    expect(result.player.turnsRemaining).toBe(7);
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("buildUnitsServer unit types and cap", () => {
  it("recruits air units on a military tile", async () => {
    const mil = { ...BASE_TILE, type: "military" as const, units: { ground: 0, air: 0, siege: 0 } };
    const { db } = buildGameMutationDb({
      ownedTileDocs: [{ id: "t1", data: mil }, ...foodLandDocs(12)],
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          stats: { unitsAlive: 0, tilesHeld: 100 },
        },
      },
      tile: { exists: true, data: mil },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await buildUnitsServer("u1", "t1", "air");
    expect(result.tile.units.air).toBeGreaterThan(0);
    expect(result.produced).toBeGreaterThan(0);
  });

  it("recruits siege units on a military tile", async () => {
    const mil = { ...BASE_TILE, type: "military" as const, units: { ground: 0, air: 0, siege: 0 } };
    const { db } = buildGameMutationDb({
      ownedTileDocs: [{ id: "t1", data: mil }, ...foodLandDocs(12)],
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          stats: { unitsAlive: 0, tilesHeld: 100 },
        },
      },
      tile: { exists: true, data: mil },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await buildUnitsServer("u1", "t1", "siege");
    expect(result.tile.units.siege).toBeGreaterThan(0);
  });

  it("throws GameUnitCapExceededError when recruitment would exceed cap", async () => {
    const { db } = buildGameMutationDb({
      ownedTileDocs: [{ id: "t1", data: { ...BASE_TILE, type: "military" as const } }],
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          stats: { ...BASE_PLAYER.stats, unitsAlive: 999_999 },
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, type: "military" as const } },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(buildUnitsServer("u1", "t1", "ground")).rejects.toBeInstanceOf(
      GameUnitCapExceededError,
    );
  });
});

describe("summonSpecialUnitServer / unsummonSpecialUnitServer", () => {
  const poolEntry = {
    instanceId: "spec-w12",
    definitionId: "red-special-1",
    stationedTileId: undefined as string | undefined,
  };

  it("throws GameSpecialUnitNotFoundError for unknown instance", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: { ...BASE_PLAYER, phase: "play", summonableSpecialUnits: [] },
      },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      summonSpecialUnitServer({
        userId: "u1",
        instanceId: "missing",
        targetTileId: "t1",
      }),
    ).rejects.toBeInstanceOf(GameSpecialUnitNotFoundError);
  });

  it("throws GameSpecialUnitAlreadyStationedError when already deployed", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          summonableSpecialUnits: [{ ...poolEntry, stationedTileId: "t1" }],
        },
      },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      summonSpecialUnitServer({
        userId: "u1",
        instanceId: "spec-w12",
        targetTileId: "t2",
      }),
    ).rejects.toBeInstanceOf(GameSpecialUnitAlreadyStationedError);
  });

  it("stations then recalls a special unit", async () => {
    const summonDb = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          summonableSpecialUnits: [poolEntry],
        },
      },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(summonDb.db);

    const stationed = await summonSpecialUnitServer({
      userId: "u1",
      instanceId: "spec-w12",
      targetTileId: "t1",
    });
    expect(stationed.player.summonableSpecialUnits?.[0].stationedTileId).toBe("t1");

    const { player } = await unsummonSpecialUnitServer({
      userId: "u1",
      instanceId: "spec-w12",
    });
    expect(player.summonableSpecialUnits?.[0].stationedTileId).toBeUndefined();
  });

  it("unsummon is a no-op when the unit is already in the pool", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          summonableSpecialUnits: [poolEntry],
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    const { player } = await unsummonSpecialUnitServer({
      userId: "u1",
      instanceId: "spec-w12",
    });
    expect(player.summonableSpecialUnits?.[0].stationedTileId).toBeUndefined();
  });
});

describe("attackPreviewServer", () => {
  it("throws GameShieldedError when the defender is shielded", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = combatDb({
      defender: shieldedPlayer({ userId: "u2", caste: "blue" }),
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

  it("clamps requested units to deployable stack on the source tile", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 4, air: 0, siege: 0 },
      targetUnits: { ground: 10, air: 0, siege: 0 },
    });
    const { db } = combatDb({
      source: {
        ...tiles.source,
        baseUnits: { ground: 2, air: 0, siege: 0 },
      },
      target: tiles.target,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const preview = await attackPreviewServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 99, air: 0, siege: 0 },
      offenseSpellId: null,
    });

    const sent =
      preview.combat.attackerLosses.ground +
      preview.combat.attackerLosses.air +
      preview.combat.attackerLosses.siege;
    expect(sent).toBeLessThanOrEqual(6);
    expect(preview.defender.shielded).toBe(false);
  });
});

describe("getOwnedMapTilesServer", () => {
  it("returns many owned tiles including hero metadata", async () => {
    const docs = Array.from({ length: 24 }, (_, i) =>
      makeDoc(`tile-${i}`, {
        tileId: `tile-${i}`,
        q: i,
        r: 0,
        type: i % 3 === 0 ? "food" : "military",
        ownerId: "u1",
        units: { ground: i, air: 0, siege: 0 },
        ...(i === 0
          ? {
              hero: {
                id: "hero-map",
                ownerId: "u1",
                tileId: "tile-0",
                class: "farm",
                specialty: "food",
                name: "Scout",
                caste: "red",
                stamina: 10,
                staminaMax: 20,
                emergedAtTurn: 1,
                lastEngagedAtTurn: 1,
              },
            }
          : {}),
      }),
    );
    const tilesChain = makeChain({});
    const sub = makeChain({});
    sub.get = jest.fn().mockResolvedValue(makeQuerySnap(docs));
    tilesChain.where = jest.fn().mockReturnValue(tilesChain);
    tilesChain.select = jest.fn().mockReturnValue(sub);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => tilesChain),
    });

    const tiles = await getOwnedMapTilesServer("u1");
    expect(tiles).toHaveLength(24);
    expect(tiles[0]?.hero?.id).toBe("hero-map");
    expect(tiles[1]?.hero).toBeUndefined();
  });
});

describe("getPlayerEligibilityServer", () => {
  it("returns null githubLogin when user doc is missing", async () => {
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({
        collections: {
          users: { byId: {} },
          pullRequests: makeChain({ docs: [] }),
        },
      }).db,
    );

    const result = await getPlayerEligibilityServer("no-user");
    expect(result.githubLogin).toBeNull();
    expect(result.mergedPrCountThisWeek).toBe(0);
    expect(result.nextRolloverIso).toMatch(/^\d{4}-/);
  });

  it("counts merged PRs in the current eligibility window", async () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({
        collections: {
          users: {
            byId: {
              u1: makeDoc("u1", { github: { login: "wave12-player" } }),
            },
          },
          pullRequests: makeChain({
            docs: [
              makeDoc("pr1", {
                userId: "u1",
                state: "merged",
                mergedAt: new Date("2026-05-18T00:00:00.000Z"),
              }),
              makeDoc("pr2", {
                userId: "u1",
                state: "merged",
                mergedAt: new Date("2026-05-17T00:00:00.000Z"),
              }),
            ],
          }),
        },
      }).db,
    );

    const result = await getPlayerEligibilityServer("u1", now);
    expect(result.githubLogin).toBe("wave12-player");
    expect(result.mergedPrCountThisWeek).toBe(2);
    expect(result.windowStartIso).toMatch(/^\d{4}-/);
  });

  it("logs and returns zero PR count when the pullRequests query fails", async () => {
    const failingChain = makeChain({ docs: [] });
    failingChain.get = jest.fn().mockRejectedValue(new Error("index missing"));

    mockGetAdminDb.mockReturnValue(
      makeFakeDb({
        collections: {
          users: {
            byId: {
              u1: makeDoc("u1", { github: { login: "err-player" } }),
            },
          },
          pullRequests: failingChain,
        },
      }).db,
    );

    const result = await getPlayerEligibilityServer("u1");
    expect(result.githubLogin).toBe("err-player");
    expect(result.mergedPrCountThisWeek).toBe(0);
  });
});

describe("declareLastStandServer", () => {
  const now = new Date("2026-05-19T15:00:00.000Z");

  it("declares last stand on a threatened tile at zero turns", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          turnsRemaining: 0,
          lastStandUsedAt: new Date(now.getTime() - LAST_STAND_COOLDOWN_MS - 1),
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          lastAttackedAt: new Date(now.getTime() - LAST_STAND_THREAT_WINDOW_MS + 60_000),
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    const tile = await declareLastStandServer({
      callerUserId: "u1",
      tileId: "t1",
      now,
    });
    expect(tile.activeLastStand).toBeDefined();
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it("throws GameLastStandRequiresZeroTurnsError when turns remain", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, turnsRemaining: 3 } },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          lastAttackedAt: new Date(now.getTime() - 60_000),
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      declareLastStandServer({ callerUserId: "u1", tileId: "t1", now }),
    ).rejects.toBeInstanceOf(GameLastStandRequiresZeroTurnsError);
  });

  it("throws GameLastStandCooldownError during cooldown", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          turnsRemaining: 0,
          lastStandUsedAt: now,
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          lastAttackedAt: new Date(now.getTime() - 60_000),
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      declareLastStandServer({ callerUserId: "u1", tileId: "t1", now }),
    ).rejects.toBeInstanceOf(GameLastStandCooldownError);
  });

  it("throws GameLastStandNoThreatError when the tile was not recently attacked", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          turnsRemaining: 0,
          lastStandUsedAt: new Date(now.getTime() - LAST_STAND_COOLDOWN_MS - 1),
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          lastAttackedAt: new Date(now.getTime() - LAST_STAND_THREAT_WINDOW_MS - 60_000),
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      declareLastStandServer({ callerUserId: "u1", tileId: "t1", now }),
    ).rejects.toBeInstanceOf(GameLastStandNoThreatError);
  });
});

describe("pepTalkHeroServer / meditateHeroServer error paths", () => {
  const foreignHero = {
    id: "hero-foreign",
    ownerId: "u2",
    tileId: "t1",
    class: "farm" as const,
    specialty: "food" as const,
    name: "Not Yours",
    caste: "blue" as const,
    stamina: 8,
    staminaMax: 20,
    emergedAtTurn: 1,
    lastEngagedAtTurn: 1,
  };

  it("pepTalkHeroServer throws GameHeroNotOwnedError for another player's hero", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, turnsRemaining: 0 } },
      tile: { exists: true, data: { ...BASE_TILE, hero: foreignHero } },
    });
    withHeroesCollection(db);
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1" }),
    ).rejects.toBeInstanceOf(GameHeroNotOwnedError);
  });

  it("pepTalkHeroServer throws GameHeroNotFoundError when tile has no hero", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, turnsRemaining: 0 } },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1" }),
    ).rejects.toBeInstanceOf(GameHeroNotFoundError);
  });

  it("meditateHeroServer throws GameHeroNotOwnedError for foreign hero", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
      tile: { exists: true, data: { ...BASE_TILE, hero: foreignHero } },
    });
    withHeroesCollection(db);
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1" }),
    ).rejects.toBeInstanceOf(GameHeroNotOwnedError);
  });

  it("meditateHeroServer throws GameHeroAlreadyMeditatingError when hero is meditating", async () => {
    const meditatingHero = {
      ...foreignHero,
      ownerId: "u1",
      meditatingUntil: new Date(Date.now() + 3600_000),
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "game_tiles") {
          return {
            doc: jest.fn(() => ({ __kind: "tile" })),
            where: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(makeQuerySnap([])),
            })),
          };
        }
        if (name === "game_players") {
          return { doc: jest.fn(() => ({ __kind: "player" })) };
        }
        if (name === "game_heroes") {
          return { doc: jest.fn(() => ({})) };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn((ref: { __kind?: string }) => {
            if (ref.__kind === "player") {
              return Promise.resolve({
                exists: true,
                data: () => ({ ...BASE_PLAYER, turnsSpentTotal: 5 }),
              });
            }
            return Promise.resolve({
              exists: true,
              data: () => ({ ...BASE_TILE, hero: meditatingHero }),
            });
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    });

    await expect(
      meditateHeroServer({ callerUserId: "u1", tileId: "t1" }),
    ).rejects.toBeInstanceOf(GameHeroAlreadyMeditatingError);
  });
});

describe("redistributeUnitsServer success", () => {
  it("moves units between adjacent owned tiles", async () => {
    const { db } = buildRedistributeMutationDb({
      player: { ...BASE_PLAYER, recentRedistributions: [] },
      source: {
        ...BASE_TILE,
        tileId: "s",
        neighborTileIds: ["d"],
        units: { ground: 12, air: 0, siege: 0 },
      },
      dest: {
        ...BASE_TILE,
        tileId: "d",
        ownerId: "u1",
        units: { ground: 0, air: 0, siege: 0 },
      },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const result = await redistributeUnitsServer({
      callerUserId: "u1",
      sourceTileId: "s",
      destTileId: "d",
      units: { ground: 6, air: 0, siege: 0 },
    });

    expect(result.source.units.ground).toBe(6);
    expect(result.dest.units.ground).toBeGreaterThan(0);
  });
});

describe("toggleDefensiveStanceServer activate success", () => {
  it("activates defensive stance when under the cap", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          activeDefensiveStanceCount: 0,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 250 },
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, defensiveStance: null } },
    });
    mockGetAdminDb.mockReturnValue(db);

    const tile = await toggleDefensiveStanceServer({
      callerUserId: "u1",
      tileId: "t1",
      desiredActive: true,
    });

    expect(tile.defensiveStance?.active).toBe(true);
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it("no-op when stance is already active", async () => {
    const since = new Date();
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          activeDefensiveStanceCount: 1,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 250 },
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          defensiveStance: {
            active: true,
            since,
            lockedUntil: new Date(since.getTime() + 60_000),
          },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    const tile = await toggleDefensiveStanceServer({
      callerUserId: "u1",
      tileId: "t1",
      desiredActive: true,
    });

    expect(tile.defensiveStance?.active).toBe(true);
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe("flyoverTileServer insufficient units guard", () => {
  it("throws GameInsufficientUnitsError when source lacks air units", async () => {
    const { flyoverTileServer } = await import("@/lib/game/data-server");
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 10, air: 0, siege: 0 },
    });
    const { db } = combatDb({ source: tiles.source, target: tiles.target });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      flyoverTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 0, air: 5, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameInsufficientUnitsError);
  });
});

describe("toggleDefensiveStanceServer cap guard", () => {
  it("throws GameDefensiveStanceCapError when activating at cap", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          activeDefensiveStanceCount: 10,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 200 },
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, defensiveStance: null } },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      toggleDefensiveStanceServer({
        callerUserId: "u1",
        tileId: "t1",
        desiredActive: true,
      }),
    ).rejects.toBeInstanceOf(GameDefensiveStanceCapError);
  });
});
