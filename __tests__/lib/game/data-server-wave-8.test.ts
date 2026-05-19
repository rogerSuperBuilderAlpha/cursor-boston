/**
 * @jest-environment node
 *
 * Wave 8 — more success / branch coverage for data-server mutations + map reads.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

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

jest.mock("@/lib/game/turn-report", () => ({
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
  buildCastSpellReport: jest.fn(() => ({ kind: "cast" })),
  buildFlyoverReport: jest.fn(() => ({ kind: "flyover" })),
  buildExploreReport: jest.fn(() => ({
    action: "explore",
    narrative: [],
    outcome: {},
  })),
}));

jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));

jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn().mockResolvedValue({
    id: "ir-wave8",
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
  return { ...actual, maybeEmergeHero: jest.fn(() => null) };
});

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import { computeArmageddonSuccessChanceFromMultiplier } from "@/lib/game/content/armageddon";
import {
  castArmageddonServer,
  flyoverTileServer,
  GameMeditationSlotFullError,
  GameRedistributeRateLimitError,
  getOwnedMapTilesServer,
  meditateHeroServer,
  pepTalkHeroServer,
  redistributeUnitsServer,
  spendArtifactServer,
} from "@/lib/game/data-server";
import type { GameHero } from "@/lib/game/types";
import { REDISTRIBUTE_MAX_PER_DAY } from "@/lib/game/types";
import {
  makeChain,
  makeDoc,
  makeQuerySnap,
  tsLikeMs,
} from "@/__tests__/_helpers/firebase-admin-mock";
import {
  BASE_ATTACKER,
  BASE_DEFENDER,
  BASE_PLAYER,
  BASE_TILE,
  buildCombatMutationDb,
  buildRedistributeMutationDb,
  makeAdjacentCombatTiles,
} from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockArmaChance = computeArmageddonSuccessChanceFromMultiplier as jest.MockedFunction<
  typeof computeArmageddonSuccessChanceFromMultiplier
>;

beforeEach(() => {
  mockGetAdminDb.mockReset();
  mockArmaChance.mockReset();
  mockArmaChance.mockReturnValue(1);
});

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

function buildHeroTilesDbWave8(
  heroOverrides: Partial<GameHero>,
  opts?: {
    extraOwnedDocs?: Array<{ id: string; data: Record<string, unknown> }>;
  },
) {
  const hero: GameHero = {
    id: "hero-wave8",
    ownerId: "h-u1",
    tileId: "tHero",
    class: "magic",
    specialty: "armageddon",
    name: "Seer",
    caste: "red",
    stamina: 3,
    staminaMax: 20,
    emergedAtTurn: 0,
    lastEngagedAtTurn: 5,
    ...heroOverrides,
  };

  const playerRef = { id: "h-u1", __p: true as const };
  const tileRef = { id: "tHero", __t: true as const };

  const tileData = {
    tileId: "tHero",
    ownerId: "h-u1",
    units: {},
    hero,
    neighborTileIds: [] as string[],
  };

  const tx = {
    get: jest.fn((ref: typeof playerRef | typeof tileRef) => {
      if (ref.__p) {
        return Promise.resolve({
          exists: true,
          data: () => ({
            userId: "h-u1",
            turnsRemaining: 0,
            turnsSpentTotal: 12,
          }),
        });
      }
      if (ref.__t) {
        return Promise.resolve({
          exists: true,
          data: () => tileData,
        });
      }
      return Promise.resolve({ exists: false });
    }),
    update: jest.fn(),
  };

  const ownedDocs = [
    ...(opts?.extraOwnedDocs ?? []),
    { id: "tHero", data: tileData },
  ].map((d) => makeDoc(d.id, d.data));

  mockGetAdminDb.mockReturnValue({
    collection: jest.fn((col: string) => {
      if (col === "game_players") return { doc: jest.fn(() => playerRef), where: jest.fn() };
      if (col === "game_tiles") {
        return {
          doc: jest.fn(() => tileRef),
          where: jest.fn((_f: string, _op: string, uid: unknown) =>
            uid === "h-u1" ? makeChain({ docs: ownedDocs }) : makeChain({ docs: [] }),
          ),
        };
      }
      if (col === "game_heroes") {
        return {
          doc: jest.fn((_hid: string) => ({ __h: true, id: _hid })),
        };
      }
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  });

  return { tx, tileData };
}

describe("pepTalkHeroServer", () => {
  it("does not raise stamina above staminaMax", async () => {
    const { tx } = buildHeroTilesDbWave8({ stamina: 20, staminaMax: 20 });
    const out = await pepTalkHeroServer({
      callerUserId: "h-u1",
      tileId: "tHero",
      now: new Date("2026-05-06T06:06:06.606Z"),
    });
    expect(out.hero?.stamina).toBe(20);
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("meditateHeroServer", () => {
  it("counts meditating heroes via Timestamp.toDate() in the pre-scan", async () => {
    const now = new Date("2026-05-10T10:00:00.000Z");
    const otherTile = {
      tileId: "tOther",
      ownerId: "h-u1",
      units: {},
      neighborTileIds: [] as string[],
      hero: {
        id: "hero-other",
        ownerId: "h-u1",
        meditatingUntil: { toDate: () => new Date(now.getTime() + 3_600_000) },
      },
    };
    buildHeroTilesDbWave8(
      { meditatingUntil: undefined },
      { extraOwnedDocs: [{ id: "tOther", data: otherTile }] },
    );
    await expect(
      meditateHeroServer({
        callerUserId: "h-u1",
        tileId: "tHero",
        now,
      }),
    ).rejects.toBeInstanceOf(GameMeditationSlotFullError);
  });

  it("allows meditation after an expired Date meditatingUntil", async () => {
    const now = new Date("2026-05-10T12:00:00.000Z");
    const { tx } = buildHeroTilesDbWave8({
      meditatingUntil: new Date(now.getTime() - 60_000),
    });
    await meditateHeroServer({
      callerUserId: "h-u1",
      tileId: "tHero",
      now,
    });
    const heroPatch = tx.update.mock.calls.find(
      (c) => typeof c[1] === "object" && c[1] !== null && "hero" in (c[1] as object),
    )?.[1] as { hero?: { meditatingUntil?: Date } } | undefined;
    expect(heroPatch?.hero?.meditatingUntil instanceof Date).toBe(true);
    expect(heroPatch!.hero!.meditatingUntil!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("clears stale non-Date meditatingUntil in tx (Timestamp shape, already expired)", async () => {
    const now = new Date("2026-05-10T12:30:00.000Z");
    const { tx } = buildHeroTilesDbWave8({
      meditatingUntil: {
        toDate: () => new Date(now.getTime() - 60_000),
      } as unknown as Date,
    });
    await meditateHeroServer({
      callerUserId: "h-u1",
      tileId: "tHero",
      now,
    });
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("castArmageddonServer", () => {
  it("deducts turns but does not break a seal when the roll fails", async () => {
    mockArmaChance.mockReturnValue(0);
    const userId = "arma-fail-u1";

    const playerRef = { id: userId, __p: true as const };
    const worldRef = { id: "singleton", __w: true as const };

    const landsChain = makeChain({
      docs: [
        makeDoc("m1", {
          tileId: "m1",
          ownerId: userId,
          type: "magic",
        }),
      ],
    });
    landsChain.where = jest.fn(() => landsChain);

    const sealsBrokenBefore = 2;

    const playerTxn = {
      userId,
      displayName: "Gambler",
      caste: "red" as const,
      phase: "play" as const,
      turnsRemaining: 120,
      turnsSpentTotal: 50,
      seasonNumber: 1,
      stats: {
        tilesHeld: 10_050,
        unitsAlive: 1,
      },
      activeUpgrades: {},
      armageddonCastsAttempted: 0,
      armageddonSealsBroken: 0,
      productionSpellsActive: [],
    };

    const tx = {
      get: jest.fn((ref: { __p?: boolean; __w?: boolean }) => {
        if (ref.__p) {
          return Promise.resolve({
            exists: true,
            id: userId,
            data: () => playerTxn,
          });
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

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return {
            doc: jest.fn(() => playerRef),
            where: jest.fn(),
          };
        }
        if (name === "game_world_meta") {
          return {
            doc: jest.fn(() => worldRef),
          };
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
    });

    const res = await castArmageddonServer({ userId, now: new Date("2026-05-11T11:11:11.111Z") });

    expect(res.success).toBe(false);
    expect(res.sealsBroken).toBe(sealsBrokenBefore);
    expect(res.shouldTriggerResolve).toBe(false);
    expect(res.player.armageddonSealsBroken).toBe(0);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledWith(playerRef, expect.any(Object));
  });
});

describe("spendArtifactServer", () => {
  it("marks an offense artifact used without intel follow-up", async () => {
    const artifactRef = { __kind: "artifact" };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_artifacts") {
          return { doc: jest.fn(() => artifactRef) };
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
                  id: "art-offense",
                  ownerId: "u1",
                  used: false,
                  definitionId: "common-rusted-spearhead",
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
      artifactId: "art-offense",
    });
    expect(out.artifact.used).toBe(true);
    expect(out.intelReport).toBeUndefined();
  });
});

describe("flyoverTileServer", () => {
  it("splits air deployment across super stack and baseUnits", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 0, air: 3, siege: 0 },
      targetUnits: { ground: 2, air: 0, siege: 0 },
    });
    const source = {
      ...tiles.source,
      baseUnits: { ground: 0, air: 12, siege: 0 },
    };
    const { db, tx } = combatDb({
      source,
      ownedTileDocs: [{ id: tiles.sourceTileId, data: source }],
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const result = await flyoverTileServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 0, air: 5, siege: 0 },
    });

    expect(result.combat).toBeDefined();
    expect(result.sourceTile.baseUnits?.air).toBeDefined();
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("redistributeUnitsServer", () => {
  it("ignores redistribution entries older than 24h when counting the rolling window", async () => {
    const now = new Date("2026-05-12T12:00:00.000Z");
    const staleMs = now.getTime() - 25 * 60 * 60 * 1000;
    const { db } = buildRedistributeMutationDb({
      player: {
        ...BASE_PLAYER,
        recentRedistributions: [
          tsLikeMs(staleMs),
          tsLikeMs(staleMs + 1),
          { toMillis: () => now.getTime() - 60_000 },
        ],
      },
      source: {
        ...BASE_TILE,
        tileId: "s",
        neighborTileIds: ["d"],
        units: { ground: 10, air: 0, siege: 0 },
      },
      dest: { ...BASE_TILE, tileId: "d", ownerId: "u1", units: { ground: 0, air: 0, siege: 0 } },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const result = await redistributeUnitsServer({
      callerUserId: "u1",
      sourceTileId: "s",
      destTileId: "d",
      units: { ground: 4, air: 0, siege: 0 },
      now,
    });

    expect(result.dest.units.ground).toBe(Math.floor(4 * 0.92));
  });

  it("throws when the rolling window already has REDISTRIBUTE_MAX_PER_DAY entries", async () => {
    const now = new Date("2026-05-12T15:00:00.000Z");
    const recent = Array.from({ length: REDISTRIBUTE_MAX_PER_DAY }, (_, i) =>
      tsLikeMs(now.getTime() - (i + 1) * 60_000),
    );
    const { db } = buildRedistributeMutationDb({
      player: {
        ...BASE_PLAYER,
        recentRedistributions: recent,
      },
      source: {
        ...BASE_TILE,
        tileId: "s",
        neighborTileIds: ["d"],
        units: { ground: 10, air: 0, siege: 0 },
      },
      dest: { ...BASE_TILE, tileId: "d", ownerId: "u1", units: { ground: 0, air: 0, siege: 0 } },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 1, air: 0, siege: 0 },
        now,
      }),
    ).rejects.toBeInstanceOf(GameRedistributeRateLimitError);
  });
});

describe("getOwnedMapTilesServer", () => {
  it("nulls missing ownerId and armedDefenseSpellId, and omits hero when absent", async () => {
    const tilesChain = makeChain({});
    const sub = makeChain({});
    sub.get = jest
      .fn()
      .mockResolvedValue(
        makeQuerySnap([
          makeDoc("edge", {
            tileId: "edge",
            q: 0,
            r: 1,
            type: "military",
            units: { ground: 1, air: 0, siege: 0 },
          }),
        ]),
      );
    tilesChain.where = jest.fn().mockReturnValue(tilesChain);
    tilesChain.select = jest.fn().mockReturnValue(sub);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => tilesChain),
    });

    const out = await getOwnedMapTilesServer("u-edge");
    expect(out).toHaveLength(1);
    expect(out[0]?.ownerId).toBeNull();
    expect(out[0]?.armedDefenseSpellId).toBeNull();
    expect("hero" in (out[0] as object)).toBe(false);
  });
});
