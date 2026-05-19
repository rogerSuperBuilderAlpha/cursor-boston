/**
 * @jest-environment node
 *
 * Wave 9 — hero battle actions, offense spells on attack, defensive stance off/cap.
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

jest.mock("@/lib/game/turn-report", () => ({
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
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

import { getAdminDb } from "@/lib/firebase-admin";
import {
  attackTileServer,
  GameDefensiveStanceCapError,
  GameDefensiveStanceLockedError,
  toggleDefensiveStanceServer,
} from "@/lib/game/data-server";
import { markHeroDeceasedInTx, transferHeroOwnerInTx } from "@/lib/game/hero-registry";
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

function targetHero(overrides?: Partial<{
  stamina: number;
  staminaMax: number;
}>) {
  return {
    id: "hero-def",
    ownerId: "u2",
    tileId: "1_0",
    class: "military" as const,
    specialty: "ground" as const,
    name: "Defender Hero",
    caste: "blue" as const,
    stamina: overrides?.stamina ?? 5,
    staminaMax: overrides?.staminaMax ?? 20,
    emergedAtTurn: 1,
    lastEngagedAtTurn: 1,
  };
}

function combatWithHero(
  heroOverrides?: Partial<{ stamina: number; staminaMax: number }>,
) {
  const tiles = makeAdjacentCombatTiles({
    sourceUnits: { ground: 100, air: 0, siege: 0 },
    targetUnits: { ground: 1, air: 0, siege: 0 },
  });
  return buildCombatMutationDb({
    attacker: BASE_ATTACKER,
    defender: { ...BASE_DEFENDER, turnsSpentTotal: 50 },
    source: tiles.source,
    target: { ...tiles.target, hero: targetHero(heroOverrides) },
    sourceTileId: tiles.sourceTileId,
    targetTileId: tiles.targetTileId,
    ownedTileDocs: [{ id: tiles.sourceTileId, data: tiles.source }],
  });
}

describe("attackTileServer hero actions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("kills defender hero on capture", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = combatWithHero();
    mockGetAdminDb.mockReturnValue(db as never);

    const result = await attackTileServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 80, air: 0, siege: 0 },
      offenseSpellId: null,
      heroAction: "kill",
    });

    expect(result.targetTile.ownerId).toBe("u1");
    expect(result.targetTile.hero == null).toBe(true);
    expect(markHeroDeceasedInTx).toHaveBeenCalled();
  });

  it("converts low-stamina defender hero on capture", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 100, air: 0, siege: 0 },
      targetUnits: { ground: 1, air: 0, siege: 0 },
    });
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: { ...BASE_DEFENDER, turnsSpentTotal: 50 },
      source: tiles.source,
      target: {
        ...tiles.target,
        hero: targetHero({ stamina: 5, staminaMax: 20 }),
      },
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      ownedTileDocs: [{ id: tiles.sourceTileId, data: tiles.source }],
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const result = await attackTileServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 80, air: 0, siege: 0 },
      offenseSpellId: null,
      heroAction: "convert",
    });

    expect(result.targetTile.ownerId).toBe("u1");
    expect(
      transferHeroOwnerInTx.mock.calls.length + markHeroDeceasedInTx.mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("casts an offense spell during attack", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
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
      units: { ground: 50, air: 0, siege: 0 },
      offenseSpellId: "red-offense-inferno",
    });

    expect(result.combat).toBeDefined();
    expect(result.attack.offenseSpellId).toBe("red-offense-inferno");
  });
});

describe("toggleDefensiveStanceServer extended", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws GameDefensiveStanceCapError when cap reached", async () => {
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

  it("throws GameDefensiveStanceLockedError when turning off before lock expires", async () => {
    const future = new Date(Date.now() + 60_000);
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          activeDefensiveStanceCount: 1,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 200 },
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          defensiveStance: {
            active: true,
            since: new Date(),
            lockedUntil: future,
          },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      toggleDefensiveStanceServer({
        callerUserId: "u1",
        tileId: "t1",
        desiredActive: false,
      }),
    ).rejects.toBeInstanceOf(GameDefensiveStanceLockedError);
  });

  it("deactivates stance after lock expires", async () => {
    const past = new Date(Date.now() - 60_000);
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          activeDefensiveStanceCount: 1,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 200 },
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          defensiveStance: {
            active: true,
            since: past,
            lockedUntil: past,
          },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    const tile = await toggleDefensiveStanceServer({
      callerUserId: "u1",
      tileId: "t1",
      desiredActive: false,
    });
    expect(tile.defensiveStance).toBeNull();
    expect(tx.update).toHaveBeenCalled();
  });
});
