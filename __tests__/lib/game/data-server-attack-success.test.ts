/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — attack/cast/preview/flyover/redistribute success paths.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
  buildCastSpellReport: jest.fn(() => ({ kind: "cast" })),
  buildFlyoverReport: jest.fn(() => ({ kind: "flyover" })),
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
jest.mock("@/lib/game/discord-game", () => ({
  notifyConquest: jest.fn(),
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
import {
  attackPreviewServer,
  attackTileServer,
  castSpellServer,
  flyoverTileServer,
  GameInsufficientUnitsError,
  GameNotAdjacentError,
  GameTileFullError,
  redistributeUnitsServer,
} from "@/lib/game/data-server";
import { recordSiegeDebuffInTx } from "@/lib/game/intel-effects";
import {
  BASE_ATTACKER,
  BASE_DEFENDER,
  BASE_PLAYER,
  BASE_TILE,
  buildCombatMutationDb,
  makeAdjacentCombatTiles,
} from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

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

describe("attackTileServer success", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves a minimal adjacent attack and writes txn updates", async () => {
    const { db, tx } = combatDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const tiles = makeAdjacentCombatTiles();
    const result = await attackTileServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 10, air: 0, siege: 0 },
      offenseSpellId: null,
    });

    expect(result.combat).toBeDefined();
    expect(result.attack.attackerId).toBe("u1");
    expect(result.attack.defenderId).toBe("u2");
    expect(tx.update).toHaveBeenCalled();
    expect(tx.set).toHaveBeenCalled();
    expect(result.attackerPlayer.turnsRemaining).toBeLessThan(BASE_ATTACKER.turnsRemaining);
  });

  it("honors heroAction spare — combat won but tile stays with defender", async () => {
    const tiles = makeAdjacentCombatTiles();
    const targetHero = {
      id: "hero-1",
      ownerId: "u2",
      tileId: tiles.targetTileId,
      class: "military" as const,
      specialty: "ground" as const,
      name: "Sir Test",
      caste: "blue" as const,
      stamina: 10,
      staminaMax: 20,
      emergedAtTurn: 1,
      lastEngagedAtTurn: 1,
    };
    const { db } = combatDb({
      target: { ...tiles.target, hero: targetHero },
      defender: { ...BASE_DEFENDER, turnsSpentTotal: 50 },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const result = await attackTileServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 50, air: 0, siege: 0 },
      offenseSpellId: null,
      heroAction: "spare",
    });

    expect(result.combat.outcome).toBe("captured");
    expect(result.targetTile.ownerId).toBe("u2");
    expect(result.targetTile.hero?.id).toBe("hero-1");
  });
});

describe("attackPreviewServer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns combat projection without writes", async () => {
    const { db } = combatDb();
    mockGetAdminDb.mockReturnValue(db as never);
    const tiles = makeAdjacentCombatTiles();

    const preview = await attackPreviewServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 5, air: 0, siege: 0 },
      offenseSpellId: null,
    });

    expect(preview.combat).toBeDefined();
    expect(preview.defender.userId).toBe("u2");
    expect(preview.effects.siegeDebuffMagnitude).toBe(0);
  });
});

describe("castSpellServer success", () => {
  beforeEach(() => jest.clearAllMocks());

  it("casts a siege spell and records debuff in tx", async () => {
    const { db, tx } = combatDb();
    mockGetAdminDb.mockReturnValue(db as never);
    const tiles = makeAdjacentCombatTiles();

    const result = await castSpellServer({
      attackerId: "u1",
      spellId: "red-siege-firebreath",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });

    expect(result.siege).toBeDefined();
    expect(result.siege!.magnitudeApplied).toBeGreaterThanOrEqual(0);
    expect(recordSiegeDebuffInTx).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
    expect(result.player.turnsRemaining).toBeLessThan(BASE_ATTACKER.turnsRemaining);
  });

  it("casts a disarm spell", async () => {
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
    expect(result.disarm!.fractionApplied).toBeGreaterThanOrEqual(0);
  });

  it("casts an attrition spell and reduces target units", async () => {
    const tiles = makeAdjacentCombatTiles({
      targetUnits: { ground: 20, air: 0, siege: 0 },
    });
    const { db, tx } = combatDb({
      source: tiles.source,
      target: tiles.target,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const result = await castSpellServer({
      attackerId: "u1",
      spellId: "red-attrition-emberswarm",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });

    expect(result.attrition).toBeDefined();
    expect(result.attrition!.targetTile.units.ground).toBeLessThan(20);
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("flyoverTileServer success", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves an air-only flyover", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 0, air: 10, siege: 0 },
      targetUnits: { ground: 1, air: 0, siege: 0 },
    });
    const { db, tx } = combatDb({
      source: tiles.source,
      target: tiles.target,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const result = await flyoverTileServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 0, air: 5, siege: 0 },
    });

    expect(result.combat).toBeDefined();
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("redistributeUnitsServer success", () => {
  beforeEach(() => jest.clearAllMocks());

  it("moves units between adjacent owned tiles with transit loss", async () => {
    const sourceRef = { __kind: "source" as const, id: "s" };
    const destRef = { __kind: "dest" as const, id: "d" };
    const playerRef = { __kind: "player" as const, id: "u1" };
    const sourceTile = {
      ...BASE_TILE,
      tileId: "s",
      neighborTileIds: ["d"],
      units: { ground: 10, air: 0, siege: 0 },
    };
    const destTile = { ...BASE_TILE, tileId: "d", ownerId: "u1", units: { ground: 0, air: 0, siege: 0 } };
    const playerDoc = { ...playerRef };
    const sourceDoc = { ...sourceRef };
    const destDoc = { ...destRef };

    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return { doc: jest.fn(() => playerDoc) };
        }
        if (name === "game_tiles") {
          return {
            doc: jest.fn((id: string) => (id === "s" ? sourceDoc : id === "d" ? destDoc : { id })),
          };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn((ref: { __kind?: string; id?: string }) => {
            if (ref.__kind === "player") {
              return Promise.resolve({
                exists: true,
                data: () => ({ ...BASE_PLAYER, recentRedistributions: [] }),
              });
            }
            if (ref.__kind === "source") {
              return Promise.resolve({ exists: true, data: () => sourceTile });
            }
            if (ref.__kind === "dest") {
              return Promise.resolve({ exists: true, data: () => destTile });
            }
            return Promise.resolve({ exists: false });
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const result = await redistributeUnitsServer({
      callerUserId: "u1",
      sourceTileId: "s",
      destTileId: "d",
      units: { ground: 5, air: 0, siege: 0 },
    });

    expect(result.source.units.ground).toBe(5);
    expect(result.dest.units.ground).toBe(4);
  });
});

describe("attackTileServer deeper guards", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws GameInsufficientUnitsError when source lacks units", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 1, air: 0, siege: 0 },
    });
    const { db } = combatDb({ source: tiles.source, target: tiles.target });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 10, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameInsufficientUnitsError);
  });

  it("throws GameTileFullError when send exceeds defender tile headroom", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 200, air: 0, siege: 0 },
      targetUnits: { ground: 699, air: 0, siege: 0 },
    });
    const { db } = combatDb({ source: tiles.source, target: tiles.target });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 3, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameTileFullError);
  });

  it("throws GameNotAdjacentError when source is not a neighbor", async () => {
    const tiles = makeAdjacentCombatTiles();
    const source = { ...tiles.source, neighborTileIds: [] as string[] };
    const { db } = combatDb({ source, target: tiles.target });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameNotAdjacentError);
  });
});
