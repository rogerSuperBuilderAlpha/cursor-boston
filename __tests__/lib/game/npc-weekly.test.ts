/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #75 — NPC weekly cron (empty world path).
 */
import { getAdminDb } from "@/lib/firebase-admin";
import {
  attackTileServer,
  bulkBuildUnitsServer,
  castProductionSpellServer,
} from "@/lib/game/data-server";
import { runNpcWeeklyServer } from "@/lib/game/npc-weekly";
import { rebuildWorldSnapshotServer } from "@/lib/game/world-snapshot";
import type { GamePlayer, GameTile } from "@/lib/game/types";

const mockPlayersGet = jest.fn();
const mockTilesGet = jest.fn().mockResolvedValue({ docs: [] });
const mockPlayerUpdate = jest.fn().mockResolvedValue(undefined);

const mockCastProductionSpellServer = castProductionSpellServer as jest.MockedFunction<
  typeof castProductionSpellServer
>;
const mockBulkBuildUnitsServer = bulkBuildUnitsServer as jest.MockedFunction<
  typeof bulkBuildUnitsServer
>;
const mockAttackTileServer = attackTileServer as jest.MockedFunction<typeof attackTileServer>;
const mockRebuildWorldSnapshotServer = rebuildWorldSnapshotServer as jest.MockedFunction<
  typeof rebuildWorldSnapshotServer
>;

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => {
      if (name === "game_players") {
        return {
          where: () => ({
            get: mockPlayersGet,
          }),
        };
      }
      if (name === "game_tiles") {
        return {
          get: mockTilesGet,
          where: () => ({
            get: jest.fn().mockResolvedValue({ docs: [] }),
          }),
        };
      }
      return { where: jest.fn(), doc: jest.fn(), get: jest.fn() };
    },
  })),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

jest.mock("@/lib/game/data-server", () => ({
  attackTileServer: jest.fn(),
  bulkBuildUnitsServer: jest.fn(),
  castProductionSpellServer: jest.fn(),
}));

jest.mock("@/lib/game/world-snapshot", () => ({
  rebuildWorldSnapshotServer: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const WEEK = "2026-05-18T05:30:00.000Z";

function npcDoc(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      userId: id,
      displayName: id,
      isNpc: true,
      caste: "red",
      phase: "play",
      turnsRemaining: 100,
      turnsSpentTotal: 0,
      lastWeeklyGrantWeekStart: "2020-01-01T00:00:00.000Z",
      stats: { unitsAlive: 0, tilesHeld: 3 },
      productionSpellsActive: [],
      ...extra,
    }),
  };
}

function tileDoc(
  tileId: string,
  ownerId: string,
  type: "military" | "food",
  neighborTileIds: string[],
  units = { ground: 20, siege: 0, air: 0 },
) {
  return {
    id: tileId,
    data: () => ({
      tileId,
      ownerId,
      type,
      neighborTileIds,
      units,
      q: 0,
      r: 0,
    }),
  };
}

function basePlayer(id: string, extra: Record<string, unknown> = {}): GamePlayer {
  return {
    userId: id,
    displayName: id,
    isNpc: true,
    caste: "red",
    phase: "play",
    turnsRemaining: 100,
    turnsSpentTotal: 0,
    lastWeeklyGrantWeekStart: "2020-01-01T00:00:00.000Z",
    stats: { unitsAlive: 0, tilesHeld: 3 },
    productionSpellsActive: [],
    ...extra,
  } as GamePlayer;
}

function makeTwoNpcWorldDb(tiles: ReturnType<typeof tileDoc>[]) {
  return {
    collection: (name: string) => {
      if (name === "game_players") {
        return {
          where: () => ({ get: mockPlayersGet }),
          doc: () => ({ update: mockPlayerUpdate }),
        };
      }
      if (name === "game_tiles") {
        return {
          get: mockTilesGet,
          where: (_field: string, _op: string, ownerId: string) => ({
            get: jest.fn().mockResolvedValue({
              docs: tiles.filter((d) => d.data().ownerId === ownerId),
            }),
          }),
        };
      }
      return { where: jest.fn(), doc: jest.fn(), get: jest.fn() };
    },
  };
}

describe("runNpcWeeklyServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayersGet.mockResolvedValue({ docs: [] });
    mockTilesGet.mockResolvedValue({ docs: [] });
    mockGetAdminDb.mockReturnValue({
      collection: (name: string) => {
        if (name === "game_players") {
          return {
            where: () => ({ get: mockPlayersGet }),
            doc: () => ({ update: mockPlayerUpdate }),
          };
        }
        if (name === "game_tiles") {
          return {
            get: mockTilesGet,
            where: () => ({
              get: jest.fn().mockResolvedValue({ docs: [] }),
            }),
          };
        }
        return { where: jest.fn(), doc: jest.fn(), get: jest.fn() };
      },
    });
  });

  it("returns an empty summary when there are no NPCs", async () => {
    const summary = await runNpcWeeklyServer({ dryRun: true });
    expect(summary.scanned).toBe(0);
    expect(summary.granted).toBe(0);
    expect(summary.perPlayer).toEqual([]);
    expect(summary.totals.errors).toBe(0);
  });

  it("dry-runs spell, build, and attack phases for an NPC world", async () => {
    const tiles = [
      tileDoc("t1", "npc-a", "military", ["t2"]),
      tileDoc("t2", "npc-b", "military", ["t1"], { ground: 5, siege: 0, air: 0 }),
      tileDoc("f1", "npc-a", "food", []),
      tileDoc("f2", "npc-b", "food", []),
    ];
    mockPlayersGet.mockResolvedValue({
      docs: [npcDoc("npc-a"), npcDoc("npc-b")],
    });
    mockTilesGet.mockResolvedValue({ docs: tiles });
    const db = {
      collection: (name: string) => {
        if (name === "game_players") {
          return {
            where: () => ({ get: mockPlayersGet }),
            doc: () => ({ update: jest.fn() }),
          };
        }
        if (name === "game_tiles") {
          return {
            get: mockTilesGet,
            where: () => ({
              get: jest.fn().mockResolvedValue({
                docs: tiles.filter((d) => d.data().ownerId === "npc-a"),
              }),
            }),
          };
        }
        return { where: jest.fn(), doc: jest.fn(), get: jest.fn() };
      },
    };
    mockGetAdminDb.mockReturnValue(db);

    const summary = await runNpcWeeklyServer({
      dryRun: true,
      weekStartIso: WEEK,
      limit: 2,
    });
    expect(summary.scanned).toBe(2);
    expect(summary.granted).toBe(2);
    expect(summary.perPlayer.length).toBe(2);
    const first = summary.perPlayer[0]!;
    expect(first.persona).toBeTruthy();
    expect(first.spellsCast + first.builds + first.attacks).toBeGreaterThan(0);
  });

  it("skips NPCs already granted for the week", async () => {
    mockPlayersGet.mockResolvedValue({
      docs: [npcDoc("npc-a", { lastWeeklyGrantWeekStart: WEEK })],
    });
    const summary = await runNpcWeeklyServer({
      dryRun: true,
      weekStartIso: WEEK,
    });
    expect(summary.scanned).toBe(1);
    expect(summary.skippedAlreadyGranted).toBe(1);
    expect(summary.granted).toBe(0);
  });

  it("throws when Firebase Admin is not initialized", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    await expect(runNpcWeeklyServer()).rejects.toThrow(
      "Firebase Admin not initialized",
    );
  });

  it("with dryRun false calls data-server actions and increments summary totals", async () => {
    const tiles = [
      tileDoc("t1", "npc-a", "military", ["t2"]),
      tileDoc("t2", "npc-b", "military", ["t1"], { ground: 5, siege: 0, air: 0 }),
      tileDoc("f1", "npc-a", "food", []),
      tileDoc("f2", "npc-a", "food", []),
      tileDoc("f3", "npc-a", "food", []),
      tileDoc("f4", "npc-b", "food", []),
    ];
    mockPlayersGet.mockResolvedValue({
      docs: [npcDoc("npc-a")],
    });
    mockTilesGet.mockResolvedValue({ docs: tiles });
    mockGetAdminDb.mockReturnValue(makeTwoNpcWorldDb(tiles));

    let player = basePlayer("npc-a", { turnsRemaining: 200 });
    mockCastProductionSpellServer.mockImplementation(async () => {
      player = {
        ...player,
        turnsRemaining: player.turnsRemaining - 5,
        turnsSpentTotal: player.turnsSpentTotal + 5,
      };
      return { player, report: { kind: "cast" } as never, artifact: null };
    });
    mockBulkBuildUnitsServer.mockImplementation(async () => {
      player = {
        ...player,
        turnsRemaining: Math.max(0, player.turnsRemaining - 25),
        turnsSpentTotal: player.turnsSpentTotal + 25,
        stats: { ...player.stats, unitsAlive: player.stats.unitsAlive + 50 },
      };
      return {
        player,
        tiles: [],
        produced: 50,
        reports: [],
        artifacts: [],
      };
    });
    mockAttackTileServer.mockImplementation(async (args) => {
      player = {
        ...player,
        turnsRemaining: player.turnsRemaining - 1,
        turnsSpentTotal: player.turnsSpentTotal + 1,
      };
      const sourceTile = tiles[0]!.data() as GameTile;
      const targetTile = {
        ...(tiles[1]!.data() as GameTile),
        ownerId: args.attackerId,
        units: { ground: 0, siege: 0, air: 0 },
      };
      return {
        attack: { outcome: "captured" } as never,
        attackerPlayer: player,
        defenderPlayer: basePlayer("npc-b"),
        sourceTile: { ...sourceTile, units: { ground: 10, siege: 0, air: 0 } },
        targetTile,
        report: { kind: "attack" } as never,
        combat: {} as never,
        artifact: null,
      };
    });

    const summary = await runNpcWeeklyServer({
      dryRun: false,
      weekStartIso: WEEK,
      limit: 1,
    });

    expect(mockPlayerUpdate).toHaveBeenCalled();
    expect(mockRebuildWorldSnapshotServer).toHaveBeenCalled();
    expect(summary.granted).toBe(1);
    expect(
      summary.totals.spellsCast + summary.totals.builds + summary.totals.attacks,
    ).toBeGreaterThan(0);
    expect(summary.totals.builds).toBeGreaterThan(0);
    if (summary.totals.spellsCast > 0) {
      expect(mockCastProductionSpellServer).toHaveBeenCalled();
    }
    expect(mockBulkBuildUnitsServer).toHaveBeenCalled();
    if (summary.totals.attacks > 0) {
      expect(mockAttackTileServer).toHaveBeenCalled();
      expect(summary.totals.captured + summary.totals.repelled + summary.totals.stalemate).toBeGreaterThan(0);
    }
  });

  it("skips spend phases when NPC has no caste", async () => {
    mockPlayersGet.mockResolvedValue({
      docs: [npcDoc("npc-a", { caste: null })],
    });
    const summary = await runNpcWeeklyServer({
      dryRun: true,
      weekStartIso: WEEK,
    });
    expect(summary.granted).toBe(1);
    expect(summary.perPlayer).toHaveLength(1);
    expect(summary.perPlayer[0]).toMatchObject({
      builds: 0,
      attacks: 0,
      spellsCast: 0,
      captured: 0,
    });
    expect(summary.totals.builds).toBe(0);
    expect(summary.totals.attacks).toBe(0);
    expect(summary.totals.spellsCast).toBe(0);
  });

  it("non-dry run invokes production spells for magus persona NPCs", async () => {
    const magusUid = "npc-1";
    const tiles = [
      tileDoc("t1", magusUid, "military", ["t2"]),
      tileDoc("t2", "npc-b", "military", ["t1"], { ground: 5, siege: 0, air: 0 }),
      tileDoc("f1", magusUid, "food", []),
      tileDoc("f2", magusUid, "food", []),
      tileDoc("f3", magusUid, "food", []),
    ];
    mockPlayersGet.mockResolvedValue({
      docs: [npcDoc(magusUid)],
    });
    mockTilesGet.mockResolvedValue({ docs: tiles });
    mockGetAdminDb.mockReturnValue(makeTwoNpcWorldDb(tiles));

    mockCastProductionSpellServer.mockResolvedValue({
      player: basePlayer(magusUid, { turnsRemaining: 70 }),
      report: { kind: "cast" } as never,
      artifact: null,
    });
    mockBulkBuildUnitsServer.mockResolvedValue({
      player: basePlayer(magusUid, { turnsRemaining: 40 }),
      tiles: [],
      produced: 30,
      reports: [],
      artifacts: [],
    });
    mockAttackTileServer.mockResolvedValue({
      attack: { outcome: "repelled" } as never,
      attackerPlayer: basePlayer(magusUid),
      defenderPlayer: basePlayer("npc-b"),
      sourceTile: tiles[0]!.data() as GameTile,
      targetTile: tiles[1]!.data() as GameTile,
      report: { kind: "attack" } as never,
      combat: {} as never,
      artifact: null,
    });

    const summary = await runNpcWeeklyServer({
      dryRun: false,
      weekStartIso: WEEK,
      limit: 1,
    });

    const row = summary.perPlayer.find((p) => p.uid === magusUid);
    expect(row).toBeDefined();
    expect(row!.spellsCast).toBeGreaterThan(0);
    expect(row!.builds).toBeGreaterThan(0);
    expect(summary.totals.spellsCast).toBeGreaterThan(0);
    expect(summary.totals.builds).toBeGreaterThan(0);
    expect(mockCastProductionSpellServer).toHaveBeenCalled();
    expect(mockBulkBuildUnitsServer).toHaveBeenCalled();
  });

  it("records repelled and stalemate attack outcomes", async () => {
    const tiles = [
      tileDoc("t1", "npc-a", "military", ["t2"]),
      tileDoc("t2", "npc-b", "military", ["t1"], { ground: 5, siege: 0, air: 0 }),
      tileDoc("f1", "npc-a", "food", []),
      tileDoc("f2", "npc-a", "food", []),
      tileDoc("f3", "npc-a", "food", []),
      tileDoc("f4", "npc-b", "food", []),
    ];
    mockPlayersGet.mockResolvedValue({
      docs: [npcDoc("npc-a"), npcDoc("npc-b")],
    });
    mockTilesGet.mockResolvedValue({ docs: tiles });
    mockGetAdminDb.mockReturnValue(makeTwoNpcWorldDb(tiles));

    let attackCall = 0;
    let player = basePlayer("npc-a", { turnsRemaining: 200 });
    mockCastProductionSpellServer.mockImplementation(async () => {
      player = { ...player, turnsRemaining: player.turnsRemaining - 5 };
      return { player, report: { kind: "cast" } as never, artifact: null };
    });
    mockBulkBuildUnitsServer.mockImplementation(async () => {
      player = {
        ...player,
        turnsRemaining: Math.max(0, player.turnsRemaining - 25),
        stats: { ...player.stats, unitsAlive: player.stats.unitsAlive + 50 },
      };
      return { player, tiles: [], produced: 50, reports: [], artifacts: [] };
    });
    mockAttackTileServer.mockImplementation(async () => {
      attackCall += 1;
      const outcome = attackCall % 2 === 1 ? "repelled" : "stalemate";
      player = {
        ...player,
        turnsRemaining: player.turnsRemaining - 1,
        turnsSpentTotal: player.turnsSpentTotal + 1,
      };
      return {
        attack: { outcome } as never,
        attackerPlayer: player,
        defenderPlayer: basePlayer("npc-b"),
        sourceTile: tiles[0]!.data() as GameTile,
        targetTile: tiles[1]!.data() as GameTile,
        report: { kind: "attack" } as never,
        combat: {} as never,
        artifact: null,
      };
    });

    const summary = await runNpcWeeklyServer({
      dryRun: false,
      weekStartIso: WEEK,
      limit: 1,
    });

    expect(mockAttackTileServer).toHaveBeenCalled();
    expect(summary.totals.repelled + summary.totals.stalemate).toBeGreaterThan(0);
    expect(summary.totals.captured).toBe(0);
  });

  it("skips shielded NPC defenders when picking attack targets", async () => {
    const shieldUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tiles = [
      tileDoc("t1", "npc-a", "military", ["t2"]),
      tileDoc("t2", "npc-b", "military", ["t1"], { ground: 20, siege: 0, air: 0 }),
      tileDoc("f1", "npc-a", "food", []),
      tileDoc("f2", "npc-a", "food", []),
    ];
    mockPlayersGet.mockResolvedValue({
      docs: [
        npcDoc("npc-a"),
        npcDoc("npc-b", {
          shieldUntil,
          shieldDropAtTurn: 999_999,
          turnsSpentTotal: 0,
        }),
      ],
    });
    mockTilesGet.mockResolvedValue({ docs: tiles });
    mockGetAdminDb.mockReturnValue(makeTwoNpcWorldDb(tiles));

    const summary = await runNpcWeeklyServer({
      dryRun: false,
      weekStartIso: WEEK,
      limit: 1,
    });

    expect(mockAttackTileServer).not.toHaveBeenCalled();
    expect(summary.totals.attacks).toBe(0);
  });

  it("logs spell and bulk-build errors without aborting the weekly summary", async () => {
    const tiles = [
      tileDoc("t1", "npc-a", "military", []),
      tileDoc("f1", "npc-a", "food", []),
      tileDoc("f2", "npc-a", "food", []),
      tileDoc("f3", "npc-a", "food", []),
    ];
    mockPlayersGet.mockResolvedValue({ docs: [npcDoc("npc-a")] });
    mockTilesGet.mockResolvedValue({ docs: tiles });
    mockGetAdminDb.mockReturnValue(makeTwoNpcWorldDb(tiles));

    mockCastProductionSpellServer.mockRejectedValue(new Error("spell cap"));
    mockBulkBuildUnitsServer.mockRejectedValue(new Error("food cap"));

    const summary = await runNpcWeeklyServer({
      dryRun: false,
      weekStartIso: WEEK,
      limit: 1,
    });

    expect(summary.granted).toBe(1);
    expect(summary.totals.errors).toBeGreaterThan(0);
    expect(summary.perPlayer[0]?.errorCount).toBeGreaterThan(0);
  });

  it("stops bulk builds early when data-server reports stoppedEarly", async () => {
    const tiles = [
      tileDoc("t1", "npc-a", "military", []),
      tileDoc("f1", "npc-a", "food", []),
      tileDoc("f2", "npc-a", "food", []),
      tileDoc("f3", "npc-a", "food", []),
    ];
    mockPlayersGet.mockResolvedValue({ docs: [npcDoc("npc-a")] });
    mockTilesGet.mockResolvedValue({ docs: tiles });
    mockGetAdminDb.mockReturnValue(makeTwoNpcWorldDb(tiles));

    mockCastProductionSpellServer.mockResolvedValue({
      player: basePlayer("npc-a", { turnsRemaining: 90 }),
      report: { kind: "cast" } as never,
      artifact: null,
    });
    mockBulkBuildUnitsServer.mockResolvedValue({
      player: basePlayer("npc-a", { turnsRemaining: 60, stats: { unitsAlive: 50, tilesHeld: 3 } }),
      tiles: [],
      produced: 10,
      reports: [],
      artifacts: [],
      stoppedEarly: true,
    });

    const summary = await runNpcWeeklyServer({
      dryRun: false,
      weekStartIso: WEEK,
      limit: 1,
    });

    expect(summary.totals.builds).toBeGreaterThan(0);
    expect(mockBulkBuildUnitsServer).toHaveBeenCalled();
  });

  it("continues when world snapshot rebuild fails after grants", async () => {
    const tiles = [tileDoc("t1", "npc-a", "military", []), tileDoc("f1", "npc-a", "food", [])];
    mockPlayersGet.mockResolvedValue({ docs: [npcDoc("npc-a")] });
    mockTilesGet.mockResolvedValue({ docs: tiles });
    mockGetAdminDb.mockReturnValue(makeTwoNpcWorldDb(tiles));
    mockRebuildWorldSnapshotServer.mockRejectedValue(new Error("snapshot down"));

    const summary = await runNpcWeeklyServer({
      dryRun: false,
      weekStartIso: WEEK,
      limit: 1,
    });

    expect(summary.granted).toBe(1);
    expect(mockRebuildWorldSnapshotServer).toHaveBeenCalled();
  });

  it("does not rebuild world snapshot on dry run even when grants would apply", async () => {
    mockPlayersGet.mockResolvedValue({ docs: [npcDoc("npc-a")] });
    mockTilesGet.mockResolvedValue({
      docs: [tileDoc("t1", "npc-a", "military", []), tileDoc("f1", "npc-a", "food", [])],
    });

    await runNpcWeeklyServer({ dryRun: true, weekStartIso: WEEK, limit: 1 });

    expect(mockRebuildWorldSnapshotServer).not.toHaveBeenCalled();
  });

  it("honors limit and only processes one NPC", async () => {
    const tiles = [
      tileDoc("t1", "npc-a", "military", ["t2"]),
      tileDoc("t2", "npc-b", "military", ["t1"]),
      tileDoc("f1", "npc-a", "food", []),
      tileDoc("f2", "npc-b", "food", []),
    ];
    mockPlayersGet.mockResolvedValue({
      docs: [npcDoc("npc-a"), npcDoc("npc-b")],
    });
    mockTilesGet.mockResolvedValue({ docs: tiles });
    mockGetAdminDb.mockReturnValue(makeTwoNpcWorldDb(tiles));

    const summary = await runNpcWeeklyServer({
      dryRun: true,
      weekStartIso: WEEK,
      limit: 1,
    });

    expect(summary.scanned).toBe(2);
    expect(summary.granted).toBe(1);
    expect(summary.perPlayer).toHaveLength(1);
  });
});
