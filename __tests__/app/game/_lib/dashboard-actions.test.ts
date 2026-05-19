/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
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

// Minimal mock of the firebase User shape — every action helper only ever
// touches `.uid` and `.getIdToken()`.
function makeUser(uid = "me") {
  return {
    uid,
    getIdToken: jest.fn().mockResolvedValue(`token-${uid}`),
  } as unknown as Parameters<typeof attack>[0];
}

function makeMutators(): DashboardMutators & {
  // Surface the underlying jest mocks so individual tests can assert on calls.
  __spies: {
    setError: jest.Mock;
    setPlayer: jest.Mock;
    setRecentReports: jest.Mock;
    mergeOwnedTiles: jest.Mock;
    mergeBorderTiles: jest.Mock;
    mergeArtifacts: jest.Mock;
  };
} {
  const setError = jest.fn();
  const setPlayer = jest.fn();
  // Actually invoke the updater fn (rather than just capturing it as a stub)
  // so the inline `(prev) => [...]` arrows in dashboard-actions are exercised
  // — keeps function-coverage off the floor.
  let reports: unknown[] = [];
  const setRecentReports = jest.fn((updater: (prev: unknown[]) => unknown[]) => {
    reports = updater(reports);
  });
  const mergeOwnedTiles = jest.fn();
  const mergeBorderTiles = jest.fn();
  const mergeArtifacts = jest.fn();
  return {
    setError,
    setPlayer,
    setRecentReports,
    mergeOwnedTiles,
    mergeBorderTiles,
    mergeArtifacts,
    __spies: {
      setError,
      setPlayer,
      setRecentReports,
      mergeOwnedTiles,
      mergeBorderTiles,
      mergeArtifacts,
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
  q: 3,
  r: 4,
  ownerId: "foe",
};

const FAKE_PLAYER = { id: "me", turnsRemaining: 100 };
const FAKE_REPORT = { turnIndex: 1, summary: "did a thing" };

beforeEach(() => {
  jest.resetAllMocks();
});

describe("recruitUnits", () => {
  it("posts the tileId + unitType, merges tile + player, returns produced", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      tile: FAKE_TILE,
      player: FAKE_PLAYER,
      report: FAKE_REPORT,
      produced: 10,
    });
    const mut = makeMutators();
    const out = await recruitUnits(makeUser(), "1_2", "ground", mut);
    expect(out).toEqual({ produced: 10, reportSummary: "did a thing" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/build",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tileId: "1_2", unitType: "ground" }),
      })
    );
    expect(mut.__spies.setPlayer).toHaveBeenCalledWith(FAKE_PLAYER);
    expect(mut.__spies.mergeOwnedTiles).toHaveBeenCalledWith([
      expect.objectContaining({ tileId: FAKE_TILE.tileId }),
    ]);
    expect(mut.__spies.setError).toHaveBeenCalledWith(null);
  });

  it("surfaces server error message via setError", async () => {
    mockFetchOnce({ success: false, error: { message: "Need 5 turns" } });
    const mut = makeMutators();
    const out = await recruitUnits(makeUser(), "1_2", "siege", mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Need 5 turns");
  });

  it("falls back to default error when error is missing", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    await recruitUnits(makeUser(), "1_2", "air", mut);
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Recruit failed");
  });

  it("accepts a string error too (legacy server shape)", async () => {
    mockFetchOnce({ success: false, error: "raw string error" });
    const mut = makeMutators();
    await recruitUnits(makeUser(), "1_2", "ground", mut);
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("raw string error");
  });
});

describe("armDefenseSpell", () => {
  it("posts tileId + spellId and merges the tile", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      tile: FAKE_TILE,
      player: FAKE_PLAYER,
      report: FAKE_REPORT,
    });
    const mut = makeMutators();
    const out = await armDefenseSpell(makeUser(), "1_2", "blue-shield-1", mut);
    expect(out).toEqual({ reportSummary: "did a thing" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/spell/arm",
      expect.objectContaining({
        body: JSON.stringify({ tileId: "1_2", spellId: "blue-shield-1" }),
      })
    );
    expect(mut.__spies.mergeOwnedTiles).toHaveBeenCalled();
  });

  it("surfaces error on failure", async () => {
    mockFetchOnce({ success: false, error: "no caste" });
    const mut = makeMutators();
    const out = await armDefenseSpell(makeUser(), "1_2", "x", mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("no caste");
  });
});

describe("distributeTile", () => {
  it("posts tileId + type + count=1", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      tile: FAKE_TILE,
      player: FAKE_PLAYER,
      report: FAKE_REPORT,
    });
    const mut = makeMutators();
    await distributeTile(makeUser(), "1_2", "military", mut);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/setup/distribute",
      expect.objectContaining({
        body: JSON.stringify({ tileId: "1_2", type: "military", count: 1 }),
      })
    );
  });

  it("returns the report summary on success", async () => {
    mockFetchOnce({
      success: true,
      tile: FAKE_TILE,
      player: FAKE_PLAYER,
      report: { summary: "Tile changed to military · 1 turn spent" },
    });
    const mut = makeMutators();
    const out = await distributeTile(makeUser(), "1_2", "military", mut);
    expect(out?.reportSummary).toMatch(/Tile changed to military/);
  });

  it("returns null + sets error on failure", async () => {
    mockFetchOnce({ success: false, error: { message: "wrong phase" } });
    const mut = makeMutators();
    const out = await distributeTile(makeUser(), "1_2", "food", mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("wrong phase");
  });
});

describe("attack", () => {
  it("aliases attackerPlayer→setPlayer, sourceTile→mergeOwnedTiles", async () => {
    mockFetchOnce({
      success: true,
      attackerPlayer: FAKE_PLAYER,
      sourceTile: FAKE_TILE,
      targetTile: FAKE_ENEMY_TILE,
      attack: { outcome: "victory" },
      report: { summary: "Captured 3_4" },
    });
    const mut = makeMutators();
    const out = await attack(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 5, siege: 0, air: 0 },
        offenseSpellId: null,
      },
      mut
    );
    expect(out?.outcome).toBe("victory");
    expect(out?.reportSummary).toBe("Captured 3_4");
    expect(mut.__spies.setPlayer).toHaveBeenCalledWith(FAKE_PLAYER);
    expect(mut.__spies.mergeOwnedTiles).toHaveBeenCalledWith([
      expect.objectContaining({ tileId: FAKE_TILE.tileId }),
    ]);
    // Enemy tile (ownerId "foe", not "me") routes through mergeBorderTiles.
    expect(mut.__spies.mergeBorderTiles).toHaveBeenCalledWith([
      expect.objectContaining({ tileId: FAKE_ENEMY_TILE.tileId }),
    ]);
  });

  it("routes captured target tile through mergeOwnedTiles when ownerId === user.uid", async () => {
    const captured = { ...FAKE_ENEMY_TILE, ownerId: "me" };
    mockFetchOnce({
      success: true,
      attackerPlayer: FAKE_PLAYER,
      sourceTile: FAKE_TILE,
      targetTile: captured,
      attack: { outcome: "captured" },
      report: { summary: "Captured" },
    });
    const mut = makeMutators();
    await attack(
      makeUser("me"),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 5, siege: 0, air: 0 },
        offenseSpellId: null,
      },
      mut
    );
    // Both source and the now-captured target tiles end up in mergeOwnedTiles.
    expect(mut.__spies.mergeOwnedTiles).toHaveBeenCalledTimes(2);
    expect(mut.__spies.mergeBorderTiles).not.toHaveBeenCalled();
  });

  it("returns intelReport when present in response", async () => {
    const intel = { targetTileId: "3_4", target: { units: {} } };
    mockFetchOnce({
      success: true,
      attackerPlayer: FAKE_PLAYER,
      sourceTile: FAKE_TILE,
      targetTile: FAKE_ENEMY_TILE,
      attack: { outcome: "victory" },
      report: { summary: "x" },
      intelReport: intel,
    });
    const mut = makeMutators();
    const out = await attack(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 5, siege: 0, air: 0 },
        offenseSpellId: null,
      },
      mut
    );
    expect(out?.intelReport).toEqual(intel);
  });

  it("returns combat + report + targetTile so the row can render BattleReport", async () => {
    const combat = {
      outcome: "captured",
      unitsDeployed: { ground: 5, siege: 0, air: 0 },
      unitsClampedFromCapacity: 0,
      attackPower: 100,
      defensePower: 50,
      attackerLosses: { ground: 1, siege: 0, air: 0 },
      defenderLosses: { ground: 4, siege: 2, air: 1 },
      underdogApplied: false,
      supplyMultiplier: 1,
      rng: { attackerRoll: 1.0, defenderRoll: 1.0 },
      appliedSpells: { offenseId: null, defenseId: null },
    };
    const report = { summary: "Captured 3_4", narrative: ["a", "b"] };
    mockFetchOnce({
      success: true,
      attackerPlayer: FAKE_PLAYER,
      sourceTile: FAKE_TILE,
      targetTile: FAKE_ENEMY_TILE,
      attack: { outcome: "victory" },
      report,
      combat,
    });
    const mut = makeMutators();
    const out = await attack(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 5, siege: 0, air: 0 },
        offenseSpellId: null,
      },
      mut
    );
    expect(out?.combat).toEqual(combat);
    expect(out?.report).toEqual(report);
    expect(out?.targetTile).toEqual(FAKE_ENEMY_TILE);
  });

  it("returns combat=null when older server response omits the field", async () => {
    mockFetchOnce({
      success: true,
      attackerPlayer: FAKE_PLAYER,
      sourceTile: FAKE_TILE,
      targetTile: FAKE_ENEMY_TILE,
      attack: { outcome: "victory" },
      report: { summary: "x" },
      // intentionally no `combat` field
    });
    const mut = makeMutators();
    const out = await attack(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 5, siege: 0, air: 0 },
        offenseSpellId: null,
      },
      mut
    );
    expect(out?.combat).toBeNull();
  });

  it("returns null on failure", async () => {
    mockFetchOnce({ success: false, error: "no border" });
    const mut = makeMutators();
    const out = await attack(
      makeUser(),
      {
        sourceTileId: "1_2",
        targetTileId: "3_4",
        units: { ground: 1, siege: 0, air: 0 },
        offenseSpellId: null,
      },
      mut
    );
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("no border");
  });
});

describe("spendArtifact", () => {
  const FAKE_ARTIFACT = {
    id: "art-1",
    ownerId: "me",
    definitionId: "whispered-map",
    rarity: "common",
    type: "intel",
    used: true,
  };

  it("includes targetTileId only when provided", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      artifact: FAKE_ARTIFACT,
    });
    const mut = makeMutators();
    await spendArtifact(makeUser(), "art-1", "3_4", mut);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/artifact/use",
      expect.objectContaining({
        body: JSON.stringify({ artifactId: "art-1", targetTileId: "3_4" }),
      })
    );
  });

  it("omits targetTileId when null", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      artifact: FAKE_ARTIFACT,
    });
    const mut = makeMutators();
    await spendArtifact(makeUser(), "art-1", null, mut);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/artifact/use",
      expect.objectContaining({
        body: JSON.stringify({ artifactId: "art-1" }),
      })
    );
  });

  it("calls mergeArtifacts with the returned artifact", async () => {
    mockFetchOnce({ success: true, artifact: FAKE_ARTIFACT });
    const mut = makeMutators();
    await spendArtifact(makeUser(), "art-1", "3_4", mut);
    expect(mut.__spies.mergeArtifacts).toHaveBeenCalledWith([FAKE_ARTIFACT]);
  });

  it("returns intelReport when present", async () => {
    const intel = { targetTileId: "3_4", target: { units: {} } };
    mockFetchOnce({
      success: true,
      artifact: FAKE_ARTIFACT,
      intelReport: intel,
    });
    const mut = makeMutators();
    const out = await spendArtifact(makeUser(), "art-1", "3_4", mut);
    expect(out?.intelReport).toEqual(intel);
  });

  it("returns null + sets error on failure", async () => {
    mockFetchOnce({ success: false, error: "already used" });
    const mut = makeMutators();
    const out = await spendArtifact(makeUser(), "art-1", null, mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("already used");
  });
});

describe("farExpedition", () => {
  it("merges owned tile, then border tile, then pushes report", async () => {
    const newOwn = { ...FAKE_TILE, tileId: "0_0" };
    mockFetchOnce({
      success: true,
      tile: newOwn,
      enemyTile: FAKE_ENEMY_TILE,
      player: FAKE_PLAYER,
      report: FAKE_REPORT,
      targetEnemyTileId: "3_4",
    });
    const mut = makeMutators();
    const out = await farExpedition(makeUser(), mut);
    expect(out).toEqual({ tileId: "0_0", enemyTileId: "3_4" });
    // Order matters: owned-tile merge must happen before border-tile merge
    // so the cache's "is this tile a border tile?" check sees the new own tile.
    const ownedOrder = mut.__spies.mergeOwnedTiles.mock.invocationCallOrder[0];
    const borderOrder = mut.__spies.mergeBorderTiles.mock.invocationCallOrder[0];
    expect(ownedOrder).toBeLessThan(borderOrder!);
    expect(mut.__spies.setRecentReports).toHaveBeenCalled();
  });

  it("returns null + sets error on failure", async () => {
    mockFetchOnce({ success: false, error: { message: "no enemies" } });
    const mut = makeMutators();
    const out = await farExpedition(makeUser(), mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("no enemies");
  });

  it("handles network error (fetch throws)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    const mut = makeMutators();
    const out = await farExpedition(makeUser(), mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("offline");
  });
});

describe("castIntelSpell", () => {
  it("posts spellId + targetTileId, returns intelReport + detected flag", async () => {
    const intel = { targetTileId: "3_4", target: { units: {} } };
    const fetchMock = mockFetchOnce({
      success: true,
      player: FAKE_PLAYER,
      report: FAKE_REPORT,
      intelReport: intel,
      detected: true,
    });
    const mut = makeMutators();
    const out = await castIntelSpell(
      makeUser(),
      "blue-intel-1",
      "3_4",
      mut
    );
    expect(out).toEqual({ intelReport: intel, detected: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/spy",
      expect.objectContaining({
        body: JSON.stringify({ spellId: "blue-intel-1", targetTileId: "3_4" }),
      })
    );
    expect(mut.__spies.setPlayer).toHaveBeenCalledWith(FAKE_PLAYER);
    expect(mut.__spies.setRecentReports).toHaveBeenCalled();
  });

  it("defaults detected to false when missing", async () => {
    mockFetchOnce({
      success: true,
      intelReport: { targetTileId: "3_4" },
    });
    const mut = makeMutators();
    const out = await castIntelSpell(makeUser(), "x", "3_4", mut);
    expect(out?.detected).toBe(false);
  });

  it("returns null on server failure", async () => {
    mockFetchOnce({ success: false });
    const mut = makeMutators();
    const out = await castIntelSpell(makeUser(), "x", "3_4", mut);
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Spy spell failed");
  });
});

describe("frontierExplore", () => {
  it("sets progress, consumes reports, merges tiles + player", async () => {
    const reports = [
      { turnIndex: 1, summary: "claimed 1", artifactFound: false },
      { turnIndex: 2, summary: "claimed 2 (artifact!)", artifactFound: true },
    ];
    mockFetchOnce({
      success: true,
      reports,
      tiles: [FAKE_TILE],
      player: FAKE_PLAYER,
    });
    const mut = makeMutators();
    const setProgress = jest.fn();
    await frontierExplore(makeUser(), 5, mut, setProgress);
    expect(setProgress).toHaveBeenCalledWith({
      done: 0,
      total: 5,
      artifactsFound: 0,
    });
    expect(setProgress).toHaveBeenCalledWith({
      done: 2,
      total: 5,
      artifactsFound: 1,
    });
    expect(setProgress).toHaveBeenLastCalledWith(null);
    expect(mut.__spies.setRecentReports).toHaveBeenCalled();
    expect(mut.__spies.setPlayer).toHaveBeenCalledWith(FAKE_PLAYER);
    expect(mut.__spies.mergeOwnedTiles).toHaveBeenCalledWith([FAKE_TILE]);
  });

  it("clamps count between 1 and 50", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      reports: [],
      tiles: [],
      player: FAKE_PLAYER,
    });
    await frontierExplore(makeUser(), 9999, makeMutators(), jest.fn());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/explore/bulk",
      expect.objectContaining({ body: JSON.stringify({ count: 50 }) })
    );
  });

  it("surfaces stoppedEarly with a count prefix", async () => {
    mockFetchOnce({
      success: true,
      reports: [{ turnIndex: 1, summary: "x", artifactFound: false }],
      tiles: [],
      player: FAKE_PLAYER,
      stoppedEarly: "no more frontier",
    });
    const mut = makeMutators();
    await frontierExplore(makeUser(), 10, mut, jest.fn());
    expect(mut.__spies.setError).toHaveBeenCalledWith(
      "Claimed 1 / 10: no more frontier"
    );
  });

  it("returns early on server failure", async () => {
    mockFetchOnce({ success: false, error: "no auth" });
    const mut = makeMutators();
    await frontierExplore(makeUser(), 5, mut, jest.fn());
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("no auth");
  });

  it("clamps count to 1 when given 0 or negative values", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      reports: [],
      tiles: [],
      player: FAKE_PLAYER,
    });
    await frontierExplore(makeUser(), 0, makeMutators(), jest.fn());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/explore/bulk",
      expect.objectContaining({ body: JSON.stringify({ count: 1 }) })
    );
  });

  it("handles network errors via the catch path", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    const mut = makeMutators();
    const setProgress = jest.fn();
    await frontierExplore(makeUser(), 5, mut, setProgress);
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("offline");
    expect(setProgress).toHaveBeenLastCalledWith(null);
  });

  it("handles non-Error rejections via the fallback message", async () => {
    global.fetch = jest.fn().mockRejectedValue("just a string") as unknown as typeof fetch;
    const mut = makeMutators();
    await frontierExplore(makeUser(), 5, mut, jest.fn());
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Explore failed");
  });
});

describe("bulkDistribute", () => {
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

  it("returns immediately with an error when no source tiles match", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const mut = makeMutators();
    await bulkDistribute(
      makeUser(),
      {
        targetType: "military",
        count: 5,
        sourceFilter: () => false,
        sourceLabel: "unassigned",
        tiles: [tile("a"), tile("b")],
      },
      mut,
      jest.fn()
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mut.__spies.setError).toHaveBeenCalledWith(
      "No unassigned tiles to distribute."
    );
  });

  it("posts the filtered source tile ids and target type", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      reports: [],
      tiles: [],
      player: FAKE_PLAYER,
    });
    await bulkDistribute(
      makeUser(),
      {
        targetType: "food",
        count: 2,
        sourceFilter: (t) => t.type === "unassigned",
        sourceLabel: "unassigned",
        tiles: [tile("a"), tile("b"), tile("c", "military"), tile("d")],
      },
      makeMutators(),
      jest.fn()
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/distribute/bulk",
      expect.objectContaining({
        body: JSON.stringify({ tileIds: ["a", "b"], type: "food" }),
      })
    );
  });

  it("handles fetch rejection gracefully", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("net down")) as unknown as typeof fetch;
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
      jest.fn()
    );
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("net down");
  });

  it("falls back to default error when rejection has no message", async () => {
    global.fetch = jest.fn().mockRejectedValue("oops") as unknown as typeof fetch;
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
      jest.fn()
    );
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("Distribute failed");
  });

  it("surfaces stoppedEarly with the configured prefix", async () => {
    mockFetchOnce({
      success: true,
      reports: [{ turnIndex: 1, summary: "ok", artifactFound: false }],
      tiles: [],
      player: FAKE_PLAYER,
      stoppedEarly: "ran out of turns",
    });
    const mut = makeMutators();
    await bulkDistribute(
      makeUser(),
      {
        targetType: "magic",
        count: 5,
        sourceFilter: (t) => t.type === "unassigned",
        sourceLabel: "unassigned",
        tiles: [tile("a"), tile("b")],
      },
      mut,
      jest.fn()
    );
    expect(mut.__spies.setError).toHaveBeenCalledWith(
      "Stopped early after 1 / 2: ran out of turns"
    );
  });
});

describe("createPlayer / setPlayerName / adminGrant", () => {
  it("createPlayer refetches on success", async () => {
    mockFetchOnce({ success: true });
    const refetch = jest.fn().mockResolvedValue(undefined);
    const setError = jest.fn();
    await createPlayer(makeUser(), "Roger", { setError }, refetch);
    expect(setError).toHaveBeenCalledWith(null);
    expect(refetch).toHaveBeenCalled();
  });

  it("createPlayer skips refetch + sets error on failure", async () => {
    mockFetchOnce({ success: false, error: "name taken" });
    const refetch = jest.fn();
    const setError = jest.fn();
    await createPlayer(makeUser(), "Roger", { setError }, refetch);
    expect(refetch).not.toHaveBeenCalled();
    expect(setError).toHaveBeenLastCalledWith("name taken");
  });

  it("setPlayerName patches player on success", async () => {
    mockFetchOnce({ success: true, player: FAKE_PLAYER });
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await setPlayerName(makeUser(), "New Name", { setError, setPlayer });
    expect(setPlayer).toHaveBeenCalledWith(FAKE_PLAYER);
  });

  it("setPlayerName surfaces error on failure", async () => {
    mockFetchOnce({ success: false, error: "name taken" });
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await setPlayerName(makeUser(), "X", { setError, setPlayer });
    expect(setError).toHaveBeenLastCalledWith("name taken");
    expect(setPlayer).not.toHaveBeenCalled();
  });

  it("adminGrant patches player on success", async () => {
    mockFetchOnce({ success: true, player: FAKE_PLAYER });
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await adminGrant(makeUser(), { setError, setPlayer });
    expect(setPlayer).toHaveBeenCalledWith(FAKE_PLAYER);
  });

  it("adminGrant surfaces error on failure", async () => {
    mockFetchOnce({ success: false, error: { message: "not admin" } });
    const setError = jest.fn();
    const setPlayer = jest.fn();
    await adminGrant(makeUser(), { setError, setPlayer });
    expect(setError).toHaveBeenLastCalledWith("not admin");
  });
});

describe("siege", () => {
  it("posts source + target tile ids and returns siege magnitude", async () => {
    const fetchMock = mockFetchOnce({
      success: true,
      player: FAKE_PLAYER,
      report: { summary: "Siege laid" },
      siegeTotalMagnitude: 2,
    });
    const mut = makeMutators();
    const out = await siege(
      makeUser(),
      { sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out).toEqual({ reportSummary: "Siege laid", siegeTotalMagnitude: 2 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/game/siege",
      expect.objectContaining({
        body: JSON.stringify({ sourceTileId: "1_2", targetTileId: "3_4" }),
      }),
    );
    expect(mut.__spies.setPlayer).toHaveBeenCalledWith(FAKE_PLAYER);
  });

  it("returns null on failure", async () => {
    mockFetchOnce({ success: false, error: "too far" });
    const mut = makeMutators();
    const out = await siege(
      makeUser(),
      { sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out).toBeNull();
    expect(mut.__spies.setError).toHaveBeenLastCalledWith("too far");
  });
});

describe("flyover", () => {
  it("merges source + border target tiles from response", async () => {
    mockFetchOnce({
      success: true,
      attackerPlayer: FAKE_PLAYER,
      sourceTile: FAKE_TILE,
      targetTile: FAKE_ENEMY_TILE,
      report: { summary: "Flyover complete" },
    });
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
    expect(out?.reportSummary).toBe("Flyover complete");
    expect(mut.__spies.mergeOwnedTiles).toHaveBeenCalled();
    expect(mut.__spies.mergeBorderTiles).toHaveBeenCalled();
  });
});

describe("castSpell", () => {
  it("returns siege/disarm/attrition payload slices", async () => {
    mockFetchOnce({
      success: true,
      player: FAKE_PLAYER,
      report: { summary: "Attrition" },
      attrition: {
        unitsKilled: { ground: 2, siege: 0, air: 0 },
        targetTile: FAKE_ENEMY_TILE,
      },
    });
    const mut = makeMutators();
    const out = await castSpell(
      makeUser(),
      { spellId: "red-attrition", sourceTileId: "1_2", targetTileId: "3_4" },
      mut,
    );
    expect(out?.attrition?.unitsKilled).toEqual({ ground: 2, siege: 0, air: 0 });
    expect(mut.__spies.mergeBorderTiles).toHaveBeenCalled();
  });
});

describe("castArmageddon", () => {
  it("patches world meta when setWorldMeta is wired", async () => {
    mockFetchOnce({
      success: true,
      player: FAKE_PLAYER,
      sealBroken: true,
      successChance: 0.25,
      sealsBroken: 3,
      seasonNumber: 2,
      shouldTriggerResolve: false,
    });
    const mut = makeMutators();
    const setWorldMeta = jest.fn();
    const out = await castArmageddon(makeUser(), { ...mut, setWorldMeta });
    expect(out).toEqual({
      sealBroken: true,
      successChance: 0.25,
      sealsBroken: 3,
      seasonNumber: 2,
      shouldTriggerResolve: false,
    });
    expect(setWorldMeta).toHaveBeenCalledWith(
      expect.objectContaining({ sealsBroken: 3, seasonNumber: 2 }),
    );
  });
});

