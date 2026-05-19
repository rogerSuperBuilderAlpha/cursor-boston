/**
 * @jest-environment node
 *
 * OpenSSF 80% sprint — intel artifact spend, hero convert, declareLastStand.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn().mockResolvedValue({
    id: "ir-intel-art",
    targetTileId: "1_0",
    scope: "tile",
    capturedAtTurn: 3,
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
  return {
    ...actual,
    maybeEmergeHero: jest.fn(() => null),
    conversionSuccessChance: jest.fn(() => 1),
  };
});
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import { declareLastStandServer, spendArtifactServer } from "@/lib/game/data-server";
import { makeDoc } from "@/__tests__/_helpers/firebase-admin-mock";
import { BASE_PLAYER, BASE_TILE, buildGameMutationDb } from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("spendArtifactServer intel branch", () => {
  it("builds intel report for intel artifacts with a target tile", async () => {
    const artifactRef = { __kind: "artifact" };
    const playerDoc = {
      get: jest.fn().mockResolvedValue(
        makeDoc("u1", { ...BASE_PLAYER, turnsSpentTotal: 4 }),
      ),
    };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_artifacts") {
          return { doc: jest.fn(() => artifactRef) };
        }
        if (name === "game_players") {
          return { doc: jest.fn(() => playerDoc) };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn((ref: { __kind?: string }) => {
            if (ref.__kind === "artifact") {
              return Promise.resolve({
                exists: true,
                data: () => ({
                  id: "art-intel",
                  ownerId: "u1",
                  used: false,
                  definitionId: "common-whispered-map",
                  foundAtTurn: 2,
                }),
              });
            }
            return Promise.resolve({ exists: false, data: () => undefined });
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);

    const out = await spendArtifactServer({
      userId: "u1",
      artifactId: "art-intel",
      targetTileId: "1_0",
    });
    expect(out.intelReport?.id).toBe("ir-intel-art");
    expect(out.artifact.used).toBe(true);
  });
});

describe("declareLastStandServer", () => {
  it("activates last stand when threatened and off cooldown", async () => {
    const recent = new Date(Date.now() - 60_000);
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          turnsRemaining: 0,
          lastStandCooldownUntil: null,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 50 },
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          lastAttackedAt: recent,
          activeLastStand: null,
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    const tile = await declareLastStandServer({
      callerUserId: "u1",
      tileId: "t1",
    });
    expect(tile.activeLastStand).toBeTruthy();
    expect(tx.update).toHaveBeenCalled();
  });
});
