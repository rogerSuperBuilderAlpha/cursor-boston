/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * Branch-coverage push for `app/game/_lib/dashboard-actions.ts`.
 * Each test below targets an uncovered conditional path the main spec
 * doesn't hit:
 *   - optional response fields missing (`if (data.player)`, `if (data.tile)` ...)
 *   - `?? fallback` defaults (no report → "Spell cast", no produced → 0, etc.)
 *   - catch-paths with non-Error rejections (string throws)
 *   - server-failure paths on every helper (default fallback message)
 *   - `castArmageddon` with `setWorldMeta` absent, with `shouldTriggerResolve`
 *     true, with missing successChance/seasonNumber/sealsBroken fields
 *   - `castSpell` siege/disarm payload slices, no `data.attrition.targetTile`
 *   - `asMapTile` null-coalescing on missing ownerId / armedDefenseSpellId
 */

import {
  adminGrant,
  armDefenseSpell,
  attack,
  bulkDistribute,
  castArmageddon,
  castIntelSpell,
  castSpell,
  createPlayer,
  distributeTile,
  farExpedition,
  flyover,
  frontierExplore,
  recruitUnits,
  setPlayerName,
  siege,
  spendArtifact,
  type DashboardMutators,
} from "@/app/game/_lib/dashboard-actions";

function makeUser(uid = "me") {
  return {
    uid,
    getIdToken: jest.fn().mockResolvedValue(`token-${uid}`),
  } as unknown as Parameters<typeof attack>[0];
}

function makeMutators(): DashboardMutators & {
  __spies: {
    setError: jest.Mock;
    setPlayer: jest.Mock;
    setRecentReports: jest.Mock;
    mergeOwnedTiles: jest.Mock;
    mergeBorderTiles: jest.Mock;
    mergeArtifacts: jest.Mock;
    setWorldMeta: jest.Mock;
  };
} {
  const setError = jest.fn();
  const setPlayer = jest.fn();
  let reports: unknown[] = [];
  const setRecentReports = jest.fn((updater: (prev: unknown[]) => unknown[]) => {
    reports = updater(reports);
  });
  const mergeOwnedTiles = jest.fn();
  const mergeBorderTiles = jest.fn();
  const mergeArtifacts = jest.fn();
  const setWorldMeta = jest.fn();
  return {
    setError,
    setPlayer,
    setRecentReports,
    mergeOwnedTiles,
    mergeBorderTiles,
    mergeArtifacts,
    setWorldMeta,
    __spies: {
      setError,
      setPlayer,
      setRecentReports,
      mergeOwnedTiles,
      mergeBorderTiles,
      mergeArtifacts,
      setWorldMeta,
    },
  };
}

function mockFetchOnce(json: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(json),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const TILE_MIN = {
  // Use a tile with no ownerId / armedDefenseSpellId set so `asMapTile`
  // exercises both `?? null` fallback branches.
  tileId: "5_5",
  q: 5,
  r: 5,
  type: "unassigned",
  units: { ground: 0, siege: 0, air: 0 },
};

const FAKE_TILE = {
  tileId: "1_2",
  q: 1,
  r: 2,
  type: "military",
  ownerId: "me",
  units: { ground: 10, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const FAKE_ENEMY_TILE = {
  ...FAKE_TILE,
  tileId: "3_4",
  ownerId: "foe",
};

const FAKE_PLAYER = { id: "me", turnsRemaining: 100 };

beforeEach(() => {
  jest.resetAllMocks();
});

describe("asMapTile null-coalescing (via single-tile actions)", () => {
  it("recruitUnits: tile missing ownerId + armedDefenseSpellId hits both `?? null` branches", async () => {
    mockFetchOnce({ success: true, tile: TILE_MIN, produced: 3 });
    const mut = makeMutators();
    await recruitUnits(makeUser(), "5_5", "ground", mut);
    expect(mut.__spies.mergeOwnedTiles).toHaveBeenCalledWith([
      expect.objectContaining({ ownerId: null, armedDefenseSpellId: null }),
    ]);
  });
});

describe("asErrorMessage fallback default branch", () => {
  it("uses the per-helper default fallback when error is an empty object", async () => {
    // error is `{}` (no `.message`), not a string → asErrorMessage returns fallback.
    mockFetchOnce({ success: false, error: {} });
    const mut = makeMutators();
    await recruitUnits(makeUser(), "1_2", "ground", mut);
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Recruit failed");
  });
});

describe("createPlayer", () => {
  it("falls back to default message when caught exception isn't an Error", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("plain string") as unknown as typeof fetch;
    const setError = jest.fn();
    const refetch = jest.fn();
    await createPlayer(makeUser(), "Roger", { setError }, refetch);
    expect(setError).toHaveBeenLastCalledWith("Failed to create player");
    expect(refetch).not.toHaveBeenCalled();
  });

  it("falls back to default message when server returns no error field", async () => {
    mockFetchOnce({ success: false });
    const setError = jest.fn();
    const refetch = jest.fn();
    await createPlayer(makeUser(), "Roger", { setError }, refetch);
    expect(setError).toHaveBeenLastCalledWith("Failed to create player");
  });
});

describe("setPlayerName", () => {
  it("skips setPlayer when response omits `player` field", async () => {
    mockFetchOnce({ success: true });
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await setPlayerName(makeUser(), "Name", { setError, setPlayer });
    expect(setPlayer).not.toHaveBeenCalled();
  });

  it("uses default fallback message when fetch throws a non-Error", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("kaboom") as unknown as typeof fetch;
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await setPlayerName(makeUser(), "Name", { setError, setPlayer });
    expect(setError).toHaveBeenLastCalledWith("Failed to save name");
  });

  it("falls back to default message when server returns no error field", async () => {
    mockFetchOnce({ success: false });
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await setPlayerName(makeUser(), "Name", { setError, setPlayer });
    expect(setError).toHaveBeenLastCalledWith("Failed to save name");
  });
});

describe("adminGrant", () => {
  it("skips setPlayer when response omits `player` field", async () => {
    mockFetchOnce({ success: true });
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await adminGrant(makeUser(), { setError, setPlayer });
    expect(setPlayer).not.toHaveBeenCalled();
  });

  it("falls back to default message on non-Error rejection", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("nope") as unknown as typeof fetch;
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await adminGrant(makeUser(), { setError, setPlayer });
    expect(setError).toHaveBeenLastCalledWith("Grant failed");
  });

  it("falls back to default message when server omits error", async () => {
    mockFetchOnce({ success: false });
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await adminGrant(makeUser(), { setError, setPlayer });
    expect(setError).toHaveBeenLastCalledWith("Grant failed");
  });
});

describe("frontierExplore — branch flips on optional fields", () => {
  it("skips setPlayer + mergeOwnedTiles when response omits `player`/`tiles`", async () => {
    mockFetchOnce({ success: true, reports: [] });
    const mut = makeMutators();
    await frontierExplore(makeUser(), 3, mut, jest.fn());
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.mergeOwnedTiles).not.toHaveBeenCalled();
  });

  it("does NOT push to setRecentReports when reports array is empty", async () => {
    mockFetchOnce({ success: true, reports: [], tiles: [], player: FAKE_PLAYER });
    const mut = makeMutators();
    await frontierExplore(makeUser(), 1, mut, jest.fn());
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
  });

  it("treats non-array `reports` field as empty (consumeReports `Array.isArray` else branch)", async () => {
    mockFetchOnce({
      success: true,
      reports: undefined,
      tiles: [],
      player: FAKE_PLAYER,
    });
    const mut = makeMutators();
    const setProgress = jest.fn();
    await frontierExplore(makeUser(), 1, mut, setProgress);
    // done=0 when reports field is not an array
    expect(setProgress).toHaveBeenCalledWith({
      done: 0,
      total: 1,
      artifactsFound: 0,
    });
  });

  it("server error without error field uses 'Explore failed' default", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    await frontierExplore(makeUser(), 5, mut, jest.fn());
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Explore failed");
  });
});

describe("bulkDistribute — branch flips", () => {
  function tile(id: string, type: "military" | "unassigned" = "unassigned") {
    return {
      tileId: id,
      q: 0,
      r: 0,
      type,
      ownerId: "me",
      units: { ground: 0, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    };
  }

  it("server failure → default fallback message", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    await bulkDistribute(
      makeUser(),
      {
        targetType: "magic",
        count: 1,
        sourceFilter: () => true,
        sourceLabel: "all",
        tiles: [tile("a")],
      },
      mut,
      jest.fn(),
    );
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Distribute failed");
  });

  it("skips setPlayer + mergeOwnedTiles when response omits them", async () => {
    mockFetchOnce({ success: true, reports: [] });
    const mut = makeMutators();
    await bulkDistribute(
      makeUser(),
      {
        targetType: "magic",
        count: 1,
        sourceFilter: () => true,
        sourceLabel: "all",
        tiles: [tile("a")],
      },
      mut,
      jest.fn(),
    );
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.mergeOwnedTiles).not.toHaveBeenCalled();
  });
});

describe("farExpedition — every optional-field branch", () => {
  it("omits owned-tile + border-tile + report merges when those fields absent", async () => {
    mockFetchOnce({
      success: true,
      // no tile / enemyTile / report / player / targetEnemyTileId
    });
    const mut = makeMutators();
    const out = await farExpedition(makeUser(), mut);
    // tileId + enemyTileId both fall back to "" via `?? ""`
    expect(out).toEqual({ tileId: "", enemyTileId: "" });
    expect(mut.__spies.mergeOwnedTiles).not.toHaveBeenCalled();
    expect(mut.__spies.mergeBorderTiles).not.toHaveBeenCalled();
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
  });

  it("falls back to default message when fetch throws non-Error", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("string-only") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await farExpedition(makeUser(), mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith(
      "Far Expedition failed",
    );
  });

  it("uses default fallback when server returns no error field", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    await farExpedition(makeUser(), mut);
    expect(mut.__spies.setError).toHaveBeenLastCalledWith(
      "Far Expedition failed",
    );
  });
});

describe("castIntelSpell — branch flips", () => {
  it("falls back to default message when fetch throws non-Error", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("oh no") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await castIntelSpell(makeUser(), "spell", "tile", mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Spy spell failed");
  });

  it("skips setPlayer + setRecentReports when response omits player/report", async () => {
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await castIntelSpell(makeUser(), "spell", "tile", mut);
    expect(out).toEqual({ intelReport: undefined, detected: false });
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
  });
});

describe("attack — branch flips", () => {
  it("falls back to default message when fetch throws non-Error", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("network") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await attack(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 1, siege: 0, air: 0 },
        offenseSpellId: null,
      },
      mut,
    );
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Attack failed");
  });

  it("skips all optional merges when response only has success", async () => {
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await attack(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 1, siege: 0, air: 0 },
        offenseSpellId: null,
      },
      mut,
    );
    // Every field hits a `?? null`/`?? ""` fallback branch
    expect(out).toEqual({
      outcome: "",
      reportSummary: "",
      intelReport: null,
      combat: null,
      report: null,
      targetTile: null,
    });
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.mergeOwnedTiles).not.toHaveBeenCalled();
    expect(mut.__spies.mergeBorderTiles).not.toHaveBeenCalled();
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
  });

  it("uses default fallback when server returns no error field", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    await attack(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 1, siege: 0, air: 0 },
        offenseSpellId: null,
      },
      mut,
    );
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Attack failed");
  });
});

describe("recruitUnits — branch flips", () => {
  it("falls back to default fallback message on non-Error rejection", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("blip") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await recruitUnits(makeUser(), "1_2", "air", mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Recruit failed");
  });

  it("skips setPlayer/mergeOwnedTiles/setRecentReports when fields omitted; produced defaults to 0", async () => {
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await recruitUnits(makeUser(), "1_2", "air", mut);
    expect(out).toEqual({ produced: 0, reportSummary: "" });
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.mergeOwnedTiles).not.toHaveBeenCalled();
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
  });

  it("`produced` non-number coerces to 0 via the typeof guard else branch", async () => {
    mockFetchOnce({ success: true, produced: "ten" });
    const mut = makeMutators();
    const out = await recruitUnits(makeUser(), "1_2", "air", mut);
    expect(out?.produced).toBe(0);
  });
});

describe("armDefenseSpell — branch flips", () => {
  it("falls back to default fallback message on non-Error rejection", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("blip") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await armDefenseSpell(makeUser(), "1_2", "spell", mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Arm spell failed");
  });

  it("server failure → default fallback message", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    await armDefenseSpell(makeUser(), "1_2", "spell", mut);
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Arm spell failed");
  });

  it("skips setPlayer + mergeOwnedTiles + setRecentReports when omitted; reportSummary defaults to ''", async () => {
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await armDefenseSpell(makeUser(), "1_2", "spell", mut);
    expect(out).toEqual({ reportSummary: "" });
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.mergeOwnedTiles).not.toHaveBeenCalled();
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
  });
});

describe("distributeTile — branch flips", () => {
  it("server failure with no error field → default fallback", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    await distributeTile(makeUser(), "1_2", "magic", mut);
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Distribute failed");
  });

  it("non-Error rejection → default fallback", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("io") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await distributeTile(makeUser(), "1_2", "magic", mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Distribute failed");
  });

  it("skips optional merges + defaults reportSummary to '' when all optional fields omitted", async () => {
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await distributeTile(makeUser(), "1_2", "magic", mut);
    expect(out).toEqual({ reportSummary: "" });
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.mergeOwnedTiles).not.toHaveBeenCalled();
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
  });
});

describe("spendArtifact — branch flips", () => {
  it("server failure without error field → default fallback", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    await spendArtifact(makeUser(), "art-1", null, mut);
    expect(mut.__spies.setError).toHaveBeenLastCalledWith(
      "Artifact use failed",
    );
  });

  it("non-Error rejection → default fallback", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("io") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await spendArtifact(makeUser(), "art-1", null, mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith(
      "Artifact use failed",
    );
  });

  it("skips mergeArtifacts when artifact field absent; intelReport defaults to null", async () => {
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await spendArtifact(makeUser(), "art-1", "tile", mut);
    expect(out).toEqual({ intelReport: null });
    expect(mut.__spies.mergeArtifacts).not.toHaveBeenCalled();
  });
});

describe("siege — branch flips", () => {
  it("server failure with no error field → default fallback", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    await siege(
      makeUser(),
      { sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Siege failed");
  });

  it("non-Error rejection → default fallback", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("io") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await siege(
      makeUser(),
      { sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Siege failed");
  });

  it("skips player + report merges; magnitude/summary fall back to defaults", async () => {
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await siege(
      makeUser(),
      { sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out).toEqual({ reportSummary: "Siege", siegeTotalMagnitude: 0 });
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
  });

  it("siegeTotalMagnitude non-number coerces to 0 via the typeof guard else branch", async () => {
    mockFetchOnce({
      success: true,
      siegeTotalMagnitude: "bad",
      report: { summary: "x" },
    });
    const mut = makeMutators();
    const out = await siege(
      makeUser(),
      { sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out?.siegeTotalMagnitude).toBe(0);
  });
});

describe("flyover — branch flips", () => {
  it("server failure with no error field → default fallback", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    const out = await flyover(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 0, siege: 0, air: 5 },
      },
      mut,
    );
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Flyover failed");
  });

  it("non-Error rejection → default fallback", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("io") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await flyover(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 0, siege: 0, air: 5 },
      },
      mut,
    );
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Flyover failed");
  });

  it("skips every merge when optional fields omitted; defaults populate the return", async () => {
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await flyover(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 0, siege: 0, air: 5 },
      },
      mut,
    );
    expect(out).toEqual({
      reportSummary: "Flyover",
      combat: null,
      report: null,
      targetTile: null,
    });
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.mergeOwnedTiles).not.toHaveBeenCalled();
    expect(mut.__spies.mergeBorderTiles).not.toHaveBeenCalled();
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
  });
});

describe("castSpell — branch flips", () => {
  it("server failure with no error field → default fallback", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    const out = await castSpell(
      makeUser(),
      { spellId: "x", sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Spell cast failed");
  });

  it("non-Error rejection → default fallback", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("io") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await castSpell(
      makeUser(),
      { spellId: "x", sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Spell cast failed");
  });

  it("returns the siege payload slice when present", async () => {
    mockFetchOnce({
      success: true,
      siege: { magnitudeApplied: 1, totalMagnitudeAfter: 2 },
      report: { summary: "Siege" },
    });
    const mut = makeMutators();
    const out = await castSpell(
      makeUser(),
      { spellId: "siege-spell", sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out?.siege).toEqual({ magnitudeApplied: 1, totalMagnitudeAfter: 2 });
    // No `attrition` so mergeBorderTiles must not be called.
    expect(mut.__spies.mergeBorderTiles).not.toHaveBeenCalled();
  });

  it("returns the disarm payload slice when present", async () => {
    mockFetchOnce({
      success: true,
      disarm: { fractionApplied: 0.5 },
    });
    const mut = makeMutators();
    const out = await castSpell(
      makeUser(),
      { spellId: "disarm", sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out?.disarm).toEqual({ fractionApplied: 0.5 });
    // Missing report → falls back to "Spell cast"
    expect(out?.reportSummary).toBe("Spell cast");
  });

  it("attrition without targetTile does NOT call mergeBorderTiles (the `?.targetTile` guard)", async () => {
    mockFetchOnce({
      success: true,
      attrition: { unitsKilled: { ground: 1, siege: 0, air: 0 } },
    });
    const mut = makeMutators();
    const out = await castSpell(
      makeUser(),
      { spellId: "attrition", sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out?.attrition?.unitsKilled).toEqual({
      ground: 1,
      siege: 0,
      air: 0,
    });
    expect(mut.__spies.mergeBorderTiles).not.toHaveBeenCalled();
  });

  it("skips setPlayer + setRecentReports when those fields omitted", async () => {
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await castSpell(
      makeUser(),
      { spellId: "x", sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out?.reportSummary).toBe("Spell cast");
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
    expect(mut.__spies.setRecentReports).not.toHaveBeenCalled();
  });
});

describe("castArmageddon — branch flips", () => {
  it("server failure with no error field → default fallback + returns null", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    const out = await castArmageddon(makeUser(), mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith(
      "Armageddon cast failed",
    );
  });

  it("non-Error rejection → default fallback", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("io") as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await castArmageddon(makeUser(), mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith(
      "Armageddon cast failed",
    );
  });

  it("skips setWorldMeta when the optional mutator is undefined", async () => {
    mockFetchOnce({
      success: true,
      sealBroken: false,
      successChance: 0.1,
      sealsBroken: 1,
      seasonNumber: 1,
      shouldTriggerResolve: false,
    });
    const mut = makeMutators();
    // Strip setWorldMeta so the `if (mut.setWorldMeta)` else-branch is taken.
    delete (mut as Partial<DashboardMutators>).setWorldMeta;
    const out = await castArmageddon(makeUser(), mut);
    expect(out).toEqual({
      sealBroken: false,
      successChance: 0.1,
      sealsBroken: 1,
      seasonNumber: 1,
      shouldTriggerResolve: false,
    });
    expect(mut.__spies.setWorldMeta).not.toHaveBeenCalled();
  });

  it("sets armageddonState to 'resolving' when shouldTriggerResolve is true", async () => {
    mockFetchOnce({
      success: true,
      sealBroken: true,
      successChance: 1,
      sealsBroken: 7,
      seasonNumber: 3,
      shouldTriggerResolve: true,
    });
    const mut = makeMutators();
    const out = await castArmageddon(makeUser(), mut);
    expect(out?.shouldTriggerResolve).toBe(true);
    expect(mut.__spies.setWorldMeta).toHaveBeenCalledWith(
      expect.objectContaining({ armageddonState: "resolving" }),
    );
  });

  it("number/boolean fallbacks fire when response omits all the optional numeric fields", async () => {
    // No successChance / sealsBroken / seasonNumber / sealBroken /
    // shouldTriggerResolve — `?? 0` / `Boolean(undefined)` paths.
    mockFetchOnce({ success: true });
    const mut = makeMutators();
    const out = await castArmageddon(makeUser(), mut);
    expect(out).toEqual({
      sealBroken: false,
      successChance: 0,
      sealsBroken: 0,
      seasonNumber: 1,
      shouldTriggerResolve: false,
    });
    // setWorldMeta still called (since `mut.setWorldMeta` is defined),
    // and armageddonState defaults to "active" (resolve=false).
    expect(mut.__spies.setWorldMeta).toHaveBeenCalledWith(
      expect.objectContaining({ armageddonState: "active" }),
    );
  });

  it("skips setPlayer when response omits `player` field", async () => {
    mockFetchOnce({
      success: true,
      sealBroken: true,
      successChance: 0.2,
      sealsBroken: 2,
      seasonNumber: 1,
      shouldTriggerResolve: false,
    });
    const mut = makeMutators();
    await castArmageddon(makeUser(), mut);
    expect(mut.__spies.setPlayer).not.toHaveBeenCalled();
  });
});
